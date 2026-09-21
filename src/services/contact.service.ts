import { Contact } from '../models/Contact.model';
import { AppError } from '../utils/AppError';
import { CreateContactDto, UpdateContactDto } from '../validators/contact.validator';
import { activeNotifier } from '../config/notifier';
import { settingService } from './setting.service';

export const contactService = {
  async create(dto: Omit<CreateContactDto, 'recaptcha_token'>) {
    const contact = await Contact.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      message: dto.message,
    });

    const [notifyEmail, branchName, hotline] = await Promise.all([
      settingService.getRawValue('notify_email'),
      settingService.getRawValue('site_name'),
      settingService.getRawValue('hotline'),
    ]);
    if (notifyEmail) {
      await activeNotifier.send(notifyEmail, 'new_contact', {
        ...dto,
        branch_name: branchName,
        hotline,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Gửi email thông báo liên hệ thất bại:', err);
      });
    }

    return contact;
  },

  async list(status: string | undefined, page: number, pageSize: number) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const { rows, count } = await Contact.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return { items: rows, total: count, page, page_size: pageSize };
  },

  async updateStatus(id: number, dto: UpdateContactDto) {
    const contact = await Contact.findByPk(id);
    if (!contact) throw AppError.notFound('Không tìm thấy liên hệ');
    await contact.update(dto);
    return contact;
  },
};
