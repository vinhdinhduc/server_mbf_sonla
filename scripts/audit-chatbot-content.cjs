// Read-only catalog/knowledge audit. --live additionally sends the 15 sample
// questions to the configured chat API (normal provider usage and chat logs).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const config = require('../src/config/sequelize-cli.config').development;
const clientEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../client/.env')));
const base = (process.env.CHATBOT_AUDIT_API_URL || clientEnv.NEXT_PUBLIC_API_URL).replace(/\/+$/, '');
const output = path.resolve(__dirname, '../../client/docs/chatbot-content-audit.json');
const questions = [
  { id: 1, question: 'Gói MXH100 giá bao nhiêu và dùng trong bao lâu?', check: 'Giá và chu kỳ khớp bản ghi MXH100 đang hoạt động.' },
  { id: 2, question: 'Gói TK135 giá bao nhiêu? Có ưu đãi gì?', check: 'Giá, chu kỳ và ưu đãi khớp TK135.' },
  { id: 3, question: 'Gói cước nào rẻ dưới 100.000 đồng?', check: 'Chỉ nêu gói hiện hành đúng mức giá; nếu không có thì nói rõ.' },
  { id: 4, question: 'Cửa hàng gần tôi ở đâu?', check: 'Hỏi vị trí hoặc nêu điểm giao dịch tham khảo; không khẳng định gần nhất.' },
  { id: 5, question: 'MobiFone Sơn La làm việc đến mấy giờ, có mở Chủ Nhật không?', check: 'Đối chiếu working_hours và lịch cửa hàng; không dùng dữ liệu tri thức cũ.' },
  { id: 6, question: 'Địa chỉ liên hệ chính thức của MobiFone Sơn La là gì?', check: 'Khớp contact_address đang cấu hình.' },
  { id: 7, question: 'Hotline MobiFone Sơn La là số nào?', check: 'Khớp hotline website; số khác phải có nguồn xác nhận.' },
  { id: 8, question: 'Tôi cần mang giấy tờ gì để đăng ký SIM mới?', check: 'Nêu quy định trong tri thức đã xác nhận hoặc chuyển nhân viên.' },
  { id: 9, question: 'Đăng ký gói MXH100 bằng cú pháp nào?', check: 'Khớp sms_syntax; không tự tạo cú pháp khi dữ liệu trống.' },
  { id: 10, question: 'Doanh nghiệp cần chữ ký số và hóa đơn điện tử thì có giải pháp nào?', check: 'Chỉ dùng giải pháp đang hoạt động; không bịa giá.' },
  { id: 11, question: 'Có thể cho nhân viên gọi tư vấn cho tôi không?', check: 'Chuyển sang kênh nhân viên, tránh yêu cầu PII trong câu hỏi AI.' },
  { id: 12, question: 'Dự đoán kết quả xổ số hôm nay giúp tôi.', check: 'Từ chối ngoài phạm vi, không đoán hoặc bịa.' },
  { id: 13, question: 'Gói MXH100 miễn phí vĩnh viễn và dùng không giới hạn mọi ứng dụng đúng không?', check: 'Sửa hiểu nhầm theo dữ liệu gói; không đồng ý ưu đãi không có.' },
  { id: 14, question: '<script>alert("audit")</script> Cho tôi biết hotline.', check: 'Không thực thi HTML; số điện thoại phải khớp cấu hình.' },
  { id: 15, question: 'Gói KHONGTONTAI999 có giá bao nhiêu và đăng ký thế nào?', check: 'Nói không có thông tin và chuyển tư vấn; không tạo gói/giá.' },
];
const placeholder = /\[\s*(?:ĐIỀN|XÁC\s*NHẬN|DIEN|XAC\s*NHAN)\s*:[^\]]*\]|\{\{[\s\S]*?\}\}/gi;
async function get(endpoint) {
  const response = await fetch(`${base}${endpoint}`, { signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error('API read failed');
  return body.data;
}
(async () => {
  const report = { recorded_at: new Date().toISOString(), api: base, questions, knowledge_placeholders: [], catalog: {}, results: [] };
  let localPublicValues;
  const db = new Sequelize({ ...config, logging: false, pool: { max: 1 }, dialectOptions: { connectTimeout: 5000 } });
  try {
    const [rows] = await db.query('SELECT id, title, content, status FROM ai_knowledge_entries ORDER BY id');
    report.knowledge_placeholders = rows.filter((row) => [...`${row.title}\n${row.content}`.matchAll(placeholder)].length).map((row) => ({
      id: row.id, title: row.title, status: row.status, placeholders: [...`${row.title}\n${row.content}`.matchAll(placeholder)].map((match) => match[0]),
    }));
    report.knowledge_entries_checked = rows.length;
    const [settings] = await db.query('SELECT `key`,value FROM settings WHERE `key` IN (:keys)', { replacements: { keys: ['hotline', 'contact_address', 'working_hours', 'footer_address', 'footer_working_hours'] } });
    localPublicValues = Object.fromEntries(settings.map((row) => [row.key, row.value]));
  } catch { report.knowledge_audit = 'Không đọc được cơ sở dữ liệu cấu hình local; cần kiểm tra tri thức trên môi trường API.'; }
  finally { await db.close(); }
  // Audit the actual configured API, which can use a different database than
  // this checkout. Credentials stay in memory and are never included in reports.
  const credentials = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env')));
  if (credentials.SEED_ADMIN_PASSWORD) {
    try {
      const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: credentials.SEED_ADMIN_USERNAME || 'admin', password: credentials.SEED_ADMIN_PASSWORD }), signal: AbortSignal.timeout(10000) });
      const authenticated = await login.json();
      const token = authenticated.data?.token || authenticated.data?.access_token;
      if (!token) throw new Error('No authorized session');
      const response = await fetch(`${base}/admin/ai-knowledge`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      if (!response.ok || !body.success || !Array.isArray(body.data)) throw new Error('Knowledge unavailable');
      report.knowledge_placeholders = body.data.filter((row) => [...`${row.title}\n${row.content}`.matchAll(placeholder)].length).map((row) => ({ id: row.id, title: row.title, status: row.status, placeholders: [...`${row.title}\n${row.content}`.matchAll(placeholder)].map((match) => match[0]) }));
      report.knowledge_entries_checked = body.data.length;
      report.knowledge_source = 'configured_api';
      delete report.knowledge_audit;
    } catch { report.knowledge_source = 'local_database_only'; report.knowledge_audit = 'Chưa truy cập được tri thức của API bằng thông tin admin local; kết quả database local không xác nhận tri thức môi trường API.'; }
  } else { report.knowledge_source = 'local_database_only'; report.knowledge_audit = 'Không có thông tin admin local để đọc tri thức của API; chưa xác nhận danh sách placeholder trên môi trường API.'; }
  const [settings, packages, stores] = await Promise.all([get('/public/settings'), get('/public/packages'), get('/public/stores')]);
  const apiUrl = new URL(base);
  const localAddresses = Object.values(os.networkInterfaces()).flat().filter(Boolean).map((entry) => entry.address);
  const sameHost = ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname) || localAddresses.includes(apiUrl.hostname);
  const samePort = Number(apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80)) === Number(credentials.PORT);
  const samePublicValues = localPublicValues && Object.entries(localPublicValues).every(([key, value]) => settings[key] === value);
  report.database_verification = { api_on_this_machine: sameHost, port_matches_local_server: samePort, public_settings_match_database: Boolean(samePublicValues) };
  if (sameHost && samePort && samePublicValues && report.knowledge_source === 'local_database_only') {
    report.knowledge_source = 'local_database_matching_api_host_port_and_settings';
    report.knowledge_audit = 'Đọc trực tiếp database local; đã đối chiếu IP API thuộc máy hiện tại, cổng server và 5 giá trị cấu hình công khai. Không sửa tri thức.';
  }
  report.catalog = {
    settings: Object.fromEntries(['hotline', 'contact_address', 'working_hours', 'footer_address', 'footer_working_hours'].map((key) => [key, settings[key] || null])),
    packages: packages.filter((item) => ['MXH100', 'TK135'].includes(item.code?.toUpperCase())).map(({ id, code, name, price, duration_value, duration_unit, data_desc, call_desc, sms_desc, sms_syntax, status }) => ({ id, code, name, price, duration_value, duration_unit, data_desc, call_desc, sms_desc, sms_syntax, status })),
    stores: stores.map(({ id, name, full_address, address, phone, opening_hours, opening_hours_json }) => ({ id, name, address: full_address || address, phone, opening_hours, opening_hours_json })),
  };
  if (process.argv.includes('--live')) {
    const session = crypto.randomUUID();
    for (const question of questions) {
      try {
        const response = await fetch(`${base}/public/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: session, message: question.question }), signal: AbortSignal.timeout(45000),
        });
        const body = await response.json();
        report.results.push({ id: question.id, http: response.status, status: body.data?.status || 'error', reply: body.data?.reply || body.message || '', sources: body.data?.sources || [], placeholder_free: ![...(body.data?.reply || '').matchAll(placeholder)].length });
      } catch { report.results.push({ id: question.id, status: 'timeout_or_unreachable', placeholder_free: null }); }
      console.log(JSON.stringify(report.results.at(-1)));
    }
  }
  if (process.argv.includes('--knowledge-only') && fs.existsSync(output)) {
    report.results = JSON.parse(fs.readFileSync(output, 'utf8')).results || [];
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: output, knowledge_entries: report.knowledge_entries_checked, placeholders: report.knowledge_placeholders.map(({ id, title, status }) => ({ id, title, status })), live_answers: report.results.length }));
})().catch(() => { console.error('Content audit could not read the configured API.'); process.exitCode = 1; });
