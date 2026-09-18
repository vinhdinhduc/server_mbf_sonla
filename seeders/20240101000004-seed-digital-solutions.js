const aiSlug = 'chinh-ly-so-hoa-tai-lieu-bang-ai-llm';
const caSlug = 'chu-ky-so-mobifone-ca';

const aiFeatures = [
  ['settings', 'Quản trị hệ thống', 'Quản lý người dùng, vai trò và cấu hình vận hành.'],
  ['folder-cog', 'Cấu hình dự án', 'Thiết lập dự án, tiêu chí xử lý và quy trình số hóa.'],
  ['scan-search', 'Rà soát OCR', 'Kiểm tra và hiệu chỉnh kết quả nhận dạng ký tự.'],
  ['layers', 'Rà soát phân loại', 'Đối soát nhóm tài liệu trước khi hoàn thiện hồ sơ.'],
  ['list-ordered', 'Đánh số tờ / trang', 'Đánh số tự động, nhất quán theo quy tắc của dự án.'],
  ['scan-line', 'Số hóa tài liệu', 'Hỗ trợ quy trình số hóa tài liệu giấy bằng AI và LLM.'],
  ['file-output', 'Xuất mục lục / nhãn hộp', 'Tạo dữ liệu mục lục và nhãn hộp phục vụ lưu trữ.'],
];

const caFeatures = [
  ['shield-check', 'Xác thực danh tính', 'Đảm bảo người ký được xác thực trước khi ký số.'],
  [
    'file-signature',
    'Ký số văn bản',
    'Ký trên tài liệu điện tử với giá trị pháp lý theo quy định.',
  ],
  ['lock-keyhole', 'Bảo mật khóa ký', 'Khóa ký được bảo vệ trên SIM PKI hoặc USB Token.'],
  ['stamp', 'Dấu thời gian', 'Ghi nhận thời điểm ký để tăng khả năng kiểm tra và đối soát.'],
  ['laptop', 'Tích hợp hệ thống', 'Phù hợp với các nền tảng nghiệp vụ cần ký số tập trung.'],
  [
    'smartphone',
    'Ký trên nhiều thiết bị',
    'Hỗ trợ nhu cầu ký số linh hoạt của cá nhân và tổ chức.',
  ],
  [
    'headphones',
    'Hỗ trợ triển khai',
    'Được tư vấn lựa chọn gói và hỗ trợ trong quá trình sử dụng.',
  ],
];

const caFaqs = [
  [
    'Chữ ký số MobiFone CA là gì?',
    'Là dịch vụ chứng thực chữ ký số do MobiFone cung cấp cho cá nhân, tổ chức và doanh nghiệp.',
  ],
  [
    'SIM PKI khác gì USB Token?',
    'SIM PKI lưu khóa ký trên SIM; USB Token là thiết bị chuyên dụng cắm vào máy tính.',
  ],
  [
    'Chữ ký số có giá trị pháp lý không?',
    'Có, khi đáp ứng điều kiện về chứng thư số và quy trình ký theo quy định hiện hành.',
  ],
  [
    'Có thể dùng chữ ký số trên điện thoại không?',
    'Có thể, tùy loại chứng thư và hệ thống tích hợp hỗ trợ ký trên thiết bị di động.',
  ],
  [
    'Thời hạn của gói chữ ký số là bao lâu?',
    'Thời hạn phụ thuộc gói đăng ký; thông tin cụ thể được xác nhận trong hợp đồng.',
  ],
  [
    'Doanh nghiệp cần chuẩn bị gì để đăng ký?',
    'Chuẩn bị hồ sơ định danh và giấy tờ pháp lý theo tư vấn của MobiFone CA.',
  ],
  [
    'Có thể gia hạn trước khi hết hạn không?',
    'Có. Nên gia hạn sớm để tránh gián đoạn việc ký và giao dịch điện tử.',
  ],
  [
    'Mất USB Token phải làm gì?',
    'Liên hệ ngay bộ phận hỗ trợ để khóa chứng thư và được hướng dẫn cấp lại.',
  ],
  [
    'Quên mã PIN xử lý thế nào?',
    'Không thử nhiều lần; liên hệ hỗ trợ để kiểm tra và xử lý theo chính sách bảo mật.',
  ],
  [
    'Có thể dùng cho hóa đơn điện tử không?',
    'Có thể dùng khi nền tảng hóa đơn điện tử đã tích hợp chứng thư tương ứng.',
  ],
  [
    'Có thể ký nhiều loại văn bản không?',
    'Có, miễn định dạng và hệ thống nghiệp vụ hỗ trợ chữ ký số tương ứng.',
  ],
  [
    'Một gói dùng được cho nhiều người không?',
    'Tùy loại chứng thư; mỗi khóa ký cần được quản lý đúng chủ thể được cấp.',
  ],
  [
    'MobiFone có hỗ trợ cài đặt không?',
    'Có, nhân viên hỗ trợ hướng dẫn cài đặt và kích hoạt theo gói dịch vụ.',
  ],
  [
    'Làm sao kiểm tra chữ ký hợp lệ?',
    'Dùng chức năng kiểm tra chữ ký của phần mềm hoặc nền tảng nhận văn bản.',
  ],
  ['Liên hệ tư vấn ở đâu?', 'Liên hệ MobiFone Sơn La để được tư vấn gói phù hợp nhu cầu.'],
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      'solutions',
      [
        {
          name: 'Chỉnh lý, Số hóa tài liệu bằng AI & LLM',
          slug: aiSlug,
          category: 'chuyen_doi_so',
          thumbnail: '/uploads/logo_ngan-1789370348641.png',
          summary:
            'Giải pháp hỗ trợ chỉnh lý, rà soát và số hóa tài liệu với AI & LLM, phù hợp cho các dự án lưu trữ quy mô lớn.',
          content:
            '<p>Giải pháp hỗ trợ số hóa tài liệu từ khâu cấu hình dự án, rà soát OCR, phân loại, đánh số tờ/trang đến xuất mục lục và nhãn hộp.</p><p>Kiến trúc triển khai có thể được tư vấn theo yêu cầu bảo mật và quy mô của từng cơ quan, đơn vị.</p>',
          target_customers:
            'Cơ quan Đảng, cơ quan nhà nước; lực lượng Công an nhân dân; đơn vị lưu trữ và doanh nghiệp có khối lượng hồ sơ lớn.',
          legal_basis:
            'Thông tư 16/2023/TT-BNV; Thông tư 05/2025/TT-BNV; Nghị định 30/2020/NĐ-CP; Hướng dẫn 40-HD/VPTW.',
          brochure_url: null,
          video_url: null,
          is_hot: true,
          status: 'active',
        },
        {
          name: 'Chữ ký số MobiFone CA',
          slug: caSlug,
          category: 'chuyen_doi_so',
          thumbnail: '/uploads/logo_ngan-1789370348641.png',
          summary:
            'Chữ ký số cho cá nhân, tổ chức và doanh nghiệp với lựa chọn SIM PKI, USB Token và tích hợp hệ thống.',
          content:
            '<p>MobiFone CA giúp cá nhân và tổ chức xác thực, ký số và giao dịch điện tử thuận tiện trên các nền tảng nghiệp vụ.</p><p>Liên hệ MobiFone Sơn La để được tư vấn lựa chọn loại chứng thư, thiết bị và chu kỳ phù hợp.</p>',
          target_customers:
            'Cá nhân, doanh nghiệp, hộ kinh doanh, cơ quan nhà nước và tổ chức có nhu cầu giao dịch điện tử.',
          legal_basis: null,
          brochure_url: null,
          video_url: null,
          is_hot: true,
          status: 'active',
        },
      ],
      { ignoreDuplicates: true },
    );

    const solutions = await queryInterface.sequelize.query(
      'SELECT id, slug FROM solutions WHERE slug IN (:slugs)',
      { replacements: { slugs: [aiSlug, caSlug] }, type: Sequelize.QueryTypes.SELECT },
    );
    const ids = Object.fromEntries(solutions.map((row) => [row.slug, row.id]));

    const seededSolutionIds = [ids[aiSlug], ids[caSlug]];
    await queryInterface.bulkDelete('solution_features', { solution_id: seededSolutionIds });
    await queryInterface.bulkDelete('solution_pricing', { solution_id: seededSolutionIds });
    await queryInterface.bulkDelete('solution_faqs', { solution_id: seededSolutionIds });
    await queryInterface.bulkDelete('solution_gallery', { solution_id: seededSolutionIds });

    await queryInterface.bulkInsert('solution_features', [
      ...aiFeatures.map(([icon, title, description], index) => ({
        solution_id: ids[aiSlug],
        icon,
        title,
        description,
        sort_order: index,
      })),
      ...caFeatures.map(([icon, title, description], index) => ({
        solution_id: ids[caSlug],
        icon,
        title,
        description,
        sort_order: index,
      })),
    ]);
    await queryInterface.bulkInsert(
      'solution_pricing',
      Array.from({ length: 8 }, (_, index) => ({
        solution_id: ids[caSlug],
        package_code: `CA-${String(index + 1).padStart(2, '0')}`,
        package_name: [
          'SIM PKI cá nhân',
          'SIM PKI doanh nghiệp',
          'USB Token cá nhân',
          'USB Token doanh nghiệp',
          'Ký số tích hợp cơ bản',
          'Ký số tích hợp nâng cao',
          'Gói gia hạn SIM PKI',
          'Gói gia hạn USB Token',
        ][index],
        price: 0,
        cycle_months: 12,
        condition_note: 'Liên hệ để nhận báo giá và điều kiện áp dụng hiện hành',
        sort_order: index,
      })),
    );
    await queryInterface.bulkInsert(
      'solution_faqs',
      caFaqs.map(([question, answer], index) => ({
        solution_id: ids[caSlug],
        question,
        answer,
        sort_order: index,
      })),
    );
    await queryInterface.bulkInsert('solution_gallery', [
      {
        solution_id: ids[aiSlug],
        image_url: '/uploads/logo_ngan-1789370348641.png',
        caption: 'Tổng quan giải pháp số hóa tài liệu',
        sort_order: 0,
      },
      {
        solution_id: ids[caSlug],
        image_url: '/uploads/logo_ngan-1789370348641.png',
        caption: 'Minh họa dịch vụ chữ ký số MobiFone CA',
        sort_order: 0,
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    const solutions = await queryInterface.sequelize.query(
      'SELECT id FROM solutions WHERE slug IN (:slugs)',
      {
        replacements: { slugs: [aiSlug, caSlug] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );
    const ids = solutions.map((row) => row.id);
    await queryInterface.bulkDelete('solution_features', { solution_id: ids });
    await queryInterface.bulkDelete('solution_pricing', { solution_id: ids });
    await queryInterface.bulkDelete('solution_faqs', { solution_id: ids });
    await queryInterface.bulkDelete('solution_gallery', { solution_id: ids });
    await queryInterface.bulkDelete('solutions', { slug: [aiSlug, caSlug] });
  },
};
