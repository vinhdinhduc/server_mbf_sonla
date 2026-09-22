import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { AuthUserPayload } from '../types/express';
import { AppError } from '../utils/AppError';
import { User } from '../models/User.model';
import { Store } from '../models/Store.model';
import { dateKeys, fillDateSeries } from '../utils/dashboardDates';

type Row = Record<string, string | number | null>;
const cache = new Map<string, { expires: number; value: unknown }>();
const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const parseDay = (value: string) => {
  if (!datePattern.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
};

async function rows(sql: string, replacements: Record<string, unknown>): Promise<Row[]> {
  return sequelize.query<Row>(sql, { replacements, type: QueryTypes.SELECT });
}

function total(data: Row[], field = 'value') {
  return data.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

export const dashboardService = {
  async get(user: AuthUserPayload, fromInput?: string, toInput?: string, requestedStoreId?: number) {
    const today = day(new Date());
    const from = fromInput || day(new Date(Date.now() - 29 * 86400000));
    const to = toInput || today;
    const fromTime = parseDay(from);
    const toTime = parseDay(to);
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime || (toTime - fromTime) / 86400000 >= 366) {
      throw AppError.badRequest('Khoảng thời gian không hợp lệ hoặc dài hơn 366 ngày');
    }
    if (requestedStoreId !== undefined && (!Number.isSafeInteger(requestedStoreId) || requestedStoreId <= 0)) {
      throw AppError.badRequest('Cửa hàng không hợp lệ');
    }
    const isTeller = user.role === 'giao_dich_vien';
    const isEditor = user.role === 'chuyen_vien';
    const isStaff = user.role === 'nhan_vien';
    const account = isTeller ? await User.findByPk(user.id) : null;
    if (isTeller && (!account?.store_id || (requestedStoreId && requestedStoreId !== account.store_id))) {
      throw AppError.forbidden('Chỉ được xem dữ liệu cửa hàng của mình');
    }
    const storeId = isTeller ? account!.store_id : user.role === 'admin' ? requestedStoreId : undefined;
    const store = storeId ? await Store.findByPk(storeId) : null;
    if (storeId && !store) throw AppError.badRequest('Cửa hàng không tồn tại');
    const key = [user.role, isStaff ? user.id : '', storeId || '', from, to].join(':');
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    const dates = dateKeys(from, to);
    const length = dates.length;
    const previousTo = day(new Date(Date.parse(`${from}T00:00:00Z`) - 86400000));
    const previousFrom = day(new Date(Date.parse(`${from}T00:00:00Z`) - length * 86400000));
    const p = { from, to, previousFrom, previousTo, storeId, storeName: store?.name, userId: user.id, today };
    const regScope = isTeller ? ' AND delivery_method = \'store\' AND delivery_store = :storeName' : isStaff ? ' AND assigned_to = :userId' : storeId ? ' AND delivery_method = \'store\' AND delivery_store = :storeName' : '';
    const appointmentScope = storeId ? ' AND store_id = :storeId' : isStaff ? ' AND assigned_to = :userId' : '';
    const contentOnly = isEditor;
    const content = await Promise.all([
      rows("SELECT DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) AS date, COUNT(*) AS value FROM news WHERE status='published' AND DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) BETWEEN :from AND :to GROUP BY date", p),
      rows("SELECT DATE(CONVERT_TZ(subscribed_at,'+00:00','+07:00')) AS date, COUNT(*) AS value FROM newsletter_subscribers WHERE status='subscribed' AND DATE(CONVERT_TZ(subscribed_at,'+00:00','+07:00')) BETWEEN :from AND :to GROUP BY date", p),
      rows("SELECT DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) AS date, COUNT(*) AS value FROM news WHERE status='published' AND DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) BETWEEN :previousFrom AND :previousTo GROUP BY date", p),
      rows("SELECT DATE(CONVERT_TZ(subscribed_at,'+00:00','+07:00')) AS date, COUNT(*) AS value FROM newsletter_subscribers WHERE status='subscribed' AND DATE(CONVERT_TZ(subscribed_at,'+00:00','+07:00')) BETWEEN :previousFrom AND :previousTo GROUP BY date", p),
    ]);
    const active = contentOnly ? [] : await Promise.all([
      rows(`SELECT DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) AS date, status, COUNT(*) AS value FROM registration_groups WHERE DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) BETWEEN :from AND :to${regScope} GROUP BY date,status`, p),
      rows(`SELECT DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) AS date, status, COUNT(*) AS value FROM registration_groups WHERE DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) BETWEEN :previousFrom AND :previousTo${regScope} GROUP BY date,status`, p),
      isTeller || isStaff ? Promise.resolve([]) : rows("SELECT DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) AS date, status, COUNT(*) AS value FROM contact_messages WHERE DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) BETWEEN :from AND :to GROUP BY date,status", p),
      rows(`SELECT appointment_date AS date, status, COUNT(*) AS value FROM store_appointments WHERE appointment_date BETWEEN :from AND :to${appointmentScope} GROUP BY date,status`, p),
      rows(`SELECT store_id AS label, COUNT(*) AS value FROM store_appointments WHERE appointment_date BETWEEN :from AND :to${appointmentScope} GROUP BY store_id ORDER BY value DESC LIMIT 10`, p),
      rows("SELECT status, subscription_type, COUNT(*) AS value FROM sim_numbers GROUP BY status,subscription_type", p),
      rows("SELECT sim_type AS label, COUNT(*) AS value FROM sim_numbers WHERE status='sold' GROUP BY sim_type ORDER BY value DESC", p),
      rows(`SELECT ri.type AS label, COUNT(*) AS value FROM registration_items ri JOIN registration_groups rg ON rg.id=ri.registration_group_id WHERE DATE(CONVERT_TZ(rg.created_at,'+00:00','+07:00')) BETWEEN :from AND :to${regScope.replace(/delivery_/g, 'rg.delivery_').replace('assigned_to', 'rg.assigned_to')} GROUP BY ri.type ORDER BY value DESC LIMIT 5`, p),
      isTeller || isStaff ? Promise.resolve([]) : rows("SELECT status, COUNT(*) AS value FROM contact_messages WHERE DATE(CONVERT_TZ(created_at,'+00:00','+07:00')) BETWEEN :previousFrom AND :previousTo GROUP BY status", p),
      rows(`SELECT status, COUNT(*) AS value FROM store_appointments WHERE appointment_date BETWEEN :previousFrom AND :previousTo${appointmentScope} GROUP BY status`, p),
    ]);
    const [registrations = [], previous = [], contacts = [], appointments = [], stores = [], inventory = [], sold = [], products = [], previousContacts = [], previousAppointments = []] = active;
    const byDay = (data: Row[], status?: string) => fillDateSeries(dates, data.filter((r) => !status || r.status === status).map((r) => ({ date: String(r.date), value: Number(r.value) })));
    const statusCounts = (data: Row[]) => Object.entries(data.reduce<Record<string, number>>((out, r) => { const k = String(r.status); out[k] = (out[k] || 0) + Number(r.value); return out; }, {})).map(([label, value]) => ({ label, value }));
    const kpi = (label: string, value: number, previousValue: number, series: { date: string; value: number }[], href: string) => ({ label, value, previous: previousValue, change: previousValue ? Math.round((value - previousValue) * 100 / previousValue) : null, sparkline: series.slice(-7), href });
    const regSeries = byDay(registrations);
    const newsSeries = byDay(content[0]);
    const newsletterSeries = byDay(content[1]);
    const kpis = contentOnly ? [
      kpi('Tin đã đăng', total(content[0]), total(content[2]), newsSeries, '/admin/news'),
      kpi('Đăng ký newsletter', total(content[1]), total(content[3]), newsletterSeries, '/admin/newsletter'),
    ] : [
      kpi('Đăng ký mới', total(registrations), total(previous), regSeries, '/admin/orders'),
      kpi('Chờ xử lý', total(registrations.filter((r) => ['moi','dang_xu_ly'].includes(String(r.status)))), total(previous.filter((r) => ['moi','dang_xu_ly'].includes(String(r.status)))), regSeries, '/admin/orders'),
      kpi('Đăng ký hoàn thành', total(registrations.filter((r) => r.status === 'hoan_thanh')), total(previous.filter((r) => r.status === 'hoan_thanh')), byDay(registrations, 'hoan_thanh'), '/admin/orders'),
      ...(!isTeller && !isStaff ? [kpi('Liên hệ chưa phản hồi', total(contacts.filter((r) => r.status === 'moi')), total(previousContacts.filter((r) => r.status === 'moi')), byDay(contacts, 'moi'), '/admin/contacts')] : []),
      kpi('Lịch hẹn hôm nay', total(appointments.filter((r) => r.date === today)), total(previousAppointments), byDay(appointments), '/admin/appointments'),
      ...(!isTeller && !isStaff ? [kpi('Sim còn hàng', total(inventory.filter((r) => r.status === 'available')), 0, byDay([]), '/admin/sims')] : []),
      ...(!isTeller && !isStaff ? [kpi('Tin đã đăng', total(content[0]), total(content[2]), newsSeries, '/admin/news'), kpi('Đăng ký newsletter', total(content[1]), total(content[3]), newsletterSeries, '/admin/newsletter')] : []),
    ];
    const charts = contentOnly ? [{ title: 'Tin đăng theo ngày', kind: 'line', data: newsSeries }, { title: 'Newsletter theo ngày', kind: 'line', data: newsletterSeries }] : [
      { title: 'Đăng ký theo ngày', kind: 'line', data: regSeries },
      { title: 'Đăng ký hoàn thành', kind: 'line', data: byDay(registrations, 'hoan_thanh') },
      { title: 'Trạng thái đăng ký', kind: 'donut', data: statusCounts(registrations) },
      { title: 'Sản phẩm đăng ký', kind: 'bar', data: products },
      ...(!isTeller && !isStaff ? [{ title: 'Lịch hẹn theo cửa hàng', kind: 'bar', data: stores }, { title: 'Kho sim', kind: 'donut', data: inventory.map((r) => ({ label: `${r.status} / ${r.subscription_type}`, value: r.value })) }, { title: 'Sim đã bán theo loại', kind: 'bar', data: sold }] : []),
      ...(!isTeller && !isStaff ? [{ title: 'Liên hệ theo ngày', kind: 'line', data: byDay(contacts) }] : []),
      { title: 'Lịch hẹn theo ngày', kind: 'line', data: byDay(appointments) },
    ];
    const urgency = contentOnly ? [] : await Promise.all([
      rows(`SELECT COUNT(*) AS value FROM registration_groups WHERE status='moi' AND created_at < :overdueBefore${regScope}`, { ...p, overdueBefore: new Date(Date.now() - 86400000) }),
      isTeller || isStaff ? Promise.resolve([]) : rows("SELECT COUNT(*) AS value FROM contact_messages WHERE status='moi' AND created_at < :overdueBefore", { ...p, overdueBefore: new Date(Date.now() - 86400000) }),
      isTeller || isStaff ? Promise.resolve([]) : rows("SELECT COUNT(*) AS value FROM sim_numbers WHERE status='reserved' AND reserved_until < :now", { ...p, now: new Date() }),
    ]);
    const urgent = contentOnly ? [] : [
      { label: 'Đăng ký mới quá 24 giờ', count: total(urgency[0]), href: '/admin/orders' },
      ...(!isTeller && !isStaff ? [{ label: 'Liên hệ chưa phản hồi quá 24 giờ', count: total(urgency[1]), href: '/admin/contacts' }, { label: 'Sim giữ quá hạn', count: total(urgency[2]), href: '/admin/sims' }] : []),
      { label: 'Lịch hẹn hôm nay', count: total(appointments.filter((r) => r.date === today)), href: '/admin/appointments' },
    ].filter((item) => item.count > 0);
    const activity = user.role === 'admin' ? await rows('SELECT action,module,target_id,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10', p) : [];
    const value = { from, to, updated_at: new Date().toISOString(), kpis, charts, urgent, activity };
    cache.set(key, { expires: Date.now() + 60000, value });
    return value;
  },
};
