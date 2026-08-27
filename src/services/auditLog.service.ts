import { Op } from 'sequelize';
import { AuditLog } from '../models/AuditLog.model';
import { User } from '../models/User.model';
import { ListAuditLogQueryDto } from '../validators/auditLog.validator';

/**
 * auditLog.service.ts - CHI co method tao (create) va doc (find).
 * TUYET DOI khong duoc them method update/delete cho AuditLog, ke ca noi bo
 * (muc 5.17). Viec ghi log tu dong da duoc middlewares/auditLogger.middleware.ts
 * dam nhiem qua AuditLog.create() truc tiep tren model - service nay chi phuc vu
 * doc du lieu cho man hinh Audit log (chi admin, read-only tuyet doi - muc 4).
 */
export const auditLogService = {
  async find(query: ListAuditLogQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.user_id) where.user_id = query.user_id;
    if (query.module) where.module = query.module;
    if (query.action) where.action = query.action;
    if (query.from || query.to) {
      where.created_at = {
        ...(query.from ? { [Op.gte]: query.from } : {}),
        ...(query.to ? { [Op.lte]: query.to } : {}),
      };
    }

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'full_name'] }],
      order: [['created_at', 'DESC']],
      limit: query.page_size,
      offset: (query.page - 1) * query.page_size,
    });

    return { items: rows, total: count, page: query.page, page_size: query.page_size };
  },

  // KHONG viet method update(...) / delete(...) o day - xem test tinh trong
  // tests/unit/auditLog.service.test.ts xac nhan dieu nay.
};
