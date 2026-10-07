import { consentAudit } from '../utils/legalConsent';
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import ExcelJS from 'exceljs';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { Job, JobApplication } from '../models';
import { AppError } from '../utils/AppError';
import { sanitizeContent } from '../utils/sanitizeContent';
import { ApplyJobDto, JobDto, UpdateJobDto } from '../validators/job.validator';
import { privateCvDir } from '../config/multer';
import { isWithinCvDirectory } from '../utils/cvSecurity';

const todayVietnam = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const clean = (dto: JobDto | UpdateJobDto) => ({
  ...dto,
  ...('description' in dto && dto.description !== undefined
    ? { description: sanitizeContent(dto.description) }
    : {}),
  ...('requirements' in dto && dto.requirements
    ? { requirements: sanitizeContent(dto.requirements) }
    : {}),
  ...('benefits' in dto && dto.benefits ? { benefits: sanitizeContent(dto.benefits) } : {}),
});
export const jobService = {
  async listPublic(query: {
    category?: string;
    location?: string;
    employment_type?: string;
    include_expired?: boolean;
  }) {
    const where: any = { status: 'recruiting' };
    if (!query.include_expired) where.deadline = { [Op.gte]: todayVietnam() };
    if (query.category) where.category = query.category;
    if (query.location) where.location = { [Op.like]: `%${query.location}%` };
    if (query.employment_type) where.employment_type = query.employment_type;
    return Job.findAll({
      where,
      order: [
        ['is_urgent', 'DESC'],
        ['is_hot', 'DESC'],
        ['deadline', 'ASC'],
      ],
    });
  },
  async publicDetail(slug: string) {
    const job = await Job.findOne({
      where: { slug, status: { [Op.in]: ['recruiting', 'paused'] } },
    });
    if (!job) throw AppError.notFound('Không tìm thấy vị trí tuyển dụng');
    return job;
  },
  async listAdmin() {
    return Job.findAll({ order: [['created_at', 'DESC']] });
  },
  async get(id: number) {
    const item = await Job.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy vị trí');
    return item;
  },
  async create(dto: JobDto, userId: number) {
    if (await Job.findOne({ where: { slug: dto.slug }, paranoid: false }))
      throw AppError.conflict('Slug đã tồn tại');
    return Job.create({ ...clean(dto), created_by: userId } as never);
  },
  async update(id: number, dto: UpdateJobDto) {
    const item = await this.get(id);
    if (
      dto.slug &&
      dto.slug !== item.slug &&
      (await Job.findOne({ where: { slug: dto.slug, id: { [Op.ne]: id } }, paranoid: false }))
    )
      throw AppError.conflict('Slug đã tồn tại');
    return item.update(clean(dto));
  },
  async remove(id: number) {
    await (await this.get(id)).destroy();
  },
  async apply(dto: ApplyJobDto, file: Express.Multer.File) {
    // Lock the job row and perform a current locking read before insertion.
    // SERIALIZABLE also protects submissions to the talent pool (job_id=null).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await sequelize.transaction(
          { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
          async (transaction) => {
            if (dto.job_id) {
              const job = await Job.findByPk(dto.job_id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
              });
              if (!job || job.status !== 'recruiting' || job.deadline < todayVietnam())
                throw AppError.conflict('Vị trí đã hết hạn hoặc ngừng nhận hồ sơ');
            }
            const duplicate = await JobApplication.findOne({
              where: {
                job_id: dto.job_id || null,
                created_at: { [Op.gte]: new Date(Date.now() - 24 * 3600_000) },
                [Op.or]: [
                  { phone: { [Op.in]: [dto.phone, `+84${dto.phone.slice(1)}`] } },
                  { email: dto.email },
                ],
              },
              transaction,
              lock: transaction.LOCK.UPDATE,
              logging: false,
            });
            if (duplicate)
              throw AppError.conflict(
                'Bạn đã gửi hồ sơ cho vị trí này trong 24 giờ qua bằng SĐT hoặc email này. Hồ sơ đang được tiếp nhận; bạn không cần gửi lại.',
              );
            const item = await JobApplication.create(
              {
                code: `UV-${todayVietnam().replace(/-/g, '').slice(2)}-${randomBytes(5).toString('hex').toUpperCase()}`,
                job_id: dto.job_id || null,
                full_name: dto.full_name,
                phone: dto.phone,
                email: dto.email,
                introduction: dto.introduction || null,
                cv_path: file.path,
                cv_original_name: path.basename(file.originalname),
                cv_mime: file.mimetype,
                consent_at: new Date(),
                ...consentAudit(),
              },
              { transaction, logging: false },
            );
            return { id: item.id, code: item.code };
          },
        );
      } catch (error) {
        const code = (error as { original?: { code?: string } }).original?.code;
        if (attempt < 2 && (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT'))
          continue;
        throw error;
      }
    }
    throw AppError.internal('Chưa thể nhận hồ sơ. Vui lòng thử lại');
  },
  async applications() {
    return JobApplication.findAll({
      attributes: { exclude: ['cv_path'] },
      include: [{ association: 'job', attributes: ['id', 'title'] }],
      order: [['created_at', 'DESC']],
    });
  },
  async updateApplication(id: number, dto: any) {
    const item = await JobApplication.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy hồ sơ');
    return item.update(dto, { logging: false });
  },
  async cv(id: number) {
    const item = await JobApplication.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy CV');
    const target = path.resolve(item.cv_path);
    if (!isWithinCvDirectory(privateCvDir, target)) throw AppError.notFound('Không tìm thấy CV');
    const [realDirectory, realTarget] = await Promise.all([
      fs.promises.realpath(privateCvDir),
      fs.promises.realpath(target),
    ]).catch(() => {
      throw AppError.notFound('Không tìm thấy CV');
    });
    if (!isWithinCvDirectory(realDirectory, realTarget))
      throw AppError.notFound('Không tìm thấy CV');
    item.cv_path = realTarget;
    item.cv_original_name = path
      .basename(item.cv_original_name.replace(/\\/g, '/'))
      .replace(/[\r\n]/g, '')
      .slice(0, 255);
    return item;
  },
  async exportApplications() {
    const rows = await this.applications();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Hồ sơ');
    ws.columns = [
      ['Mã', 'code'],
      ['Họ tên', 'full_name'],
      ['SĐT', 'phone'],
      ['Email', 'email'],
      ['Trạng thái', 'status'],
      ['Ngày nộp', 'created_at'],
    ].map(([header, key]) => ({ header, key, width: 24 }));
    rows.forEach((r) => ws.addRow(r.toJSON()));
    return Buffer.from(await wb.xlsx.writeBuffer());
  },
};
