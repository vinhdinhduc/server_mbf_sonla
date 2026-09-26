/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { Op } from 'sequelize';
import { Job, JobApplication } from '../models';
import { AppError } from '../utils/AppError';
import { sanitizeContent } from '../utils/sanitizeContent';
import { JobDto, UpdateJobDto } from '../validators/job.validator';

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
    if (!query.include_expired)
      where.deadline = { [Op.gte]: new Date().toISOString().slice(0, 10) };
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
    const job = await Job.findOne({ where: { slug, status: 'recruiting' } });
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
  async apply(dto: any, file: Express.Multer.File) {
    if (dto.job_id) {
      const job = await Job.findByPk(dto.job_id);
      if (
        !job ||
        job.status !== 'recruiting' ||
        job.deadline < new Date().toISOString().slice(0, 10)
      )
        throw AppError.conflict('Vị trí đã hết hạn hoặc ngừng nhận hồ sơ');
    }
    const item = await JobApplication.create({
      code: `UV-${Date.now().toString().slice(-10)}`,
      job_id: dto.job_id || null,
      full_name: dto.full_name,
      phone: dto.phone,
      email: dto.email,
      introduction: dto.introduction || null,
      cv_path: file.path,
      cv_original_name: path.basename(file.originalname),
      cv_mime: file.mimetype,
      consent_at: new Date(),
    });
    return { id: item.id, code: item.code };
  },
  async applications() {
    return JobApplication.findAll({
      include: [{ association: 'job', attributes: ['id', 'title'] }],
      order: [['created_at', 'DESC']],
    });
  },
  async updateApplication(id: number, dto: any) {
    const item = await JobApplication.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy hồ sơ');
    return item.update(dto);
  },
  async cv(id: number) {
    const item = await JobApplication.findByPk(id);
    if (!item || !fs.existsSync(item.cv_path)) throw AppError.notFound('Không tìm thấy CV');
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
