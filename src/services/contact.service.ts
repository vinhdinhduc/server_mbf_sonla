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

    const notifyEmail = await settingService.getRawValue('notify_email');
    if (notifyEmail) {
      await activeNotifier.send(notifyEmail, 'new_contact', dto).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Gui email thong bao lien he that bai:', err);
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
    if (!contact) throw AppError.notFound('Khong tim thay lien he');
    await contact.update(dto);
    return contact;
  },
};
