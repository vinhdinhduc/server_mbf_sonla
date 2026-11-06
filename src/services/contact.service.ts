import { consentAudit } from '../utils/legalConsent';
import { Contact } from '../models/Contact.model';
import { AppError } from '../utils/AppError';
import { CreateContactDto, UpdateContactDto } from '../validators/contact.validator';
import { settingService } from './setting.service';
import { emailService } from './email.service';

export const contactService = {
  async create(dto: Omit<CreateContactDto, 'recaptcha_token'>) {
    const contact = await Contact.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      source: dto.source,
      message: dto.message,
      topic: dto.topic,
      store_id: dto.store_id ?? null,
      consent_at: new Date(),
            ...consentAudit(),
    });
    await contact.update({
      code: `LH-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '')}-${String(contact.id).padStart(5, '0')}`,
    });

    const [notifyEmail, branchName, hotline] = await Promise.all([
      settingService.getRawValue('notify_email'),
      settingService.getRawValue('site_name'),
      settingService.getRawValue('hotline'),
    ]);
    const variables = {
      customer_name: dto.name,
      phone: dto.phone,
      message: dto.message,
      branch_name: branchName || '',
      hotline: hotline || '',
    };
    await Promise.all([
      emailService.enqueue(
        notifyEmail,
        'contact_new_staff',
        variables,
        `contact:${contact.id}:staff`,
      ),
      dto.email ? emailService.enqueue(
        dto.email,
        'contact_received_customer',
        variables,
        `contact:${contact.id}:customer`,
      ) : Promise.resolve(),
    ]);

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

  async remove(id: number) {
    const contact = await Contact.findByPk(id);
    if (!contact) throw AppError.notFound('Không tìm thấy liên hệ');
    const previous = { code: contact.code, status: contact.status };
    await contact.destroy();
    return previous;
  },
};
