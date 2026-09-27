import { z } from 'zod';
import { agreedTermsSchema } from '../utils/legalConsent';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createAppointmentSchema = z.object({
  agreed_terms: agreedTermsSchema,
  customer_name: z.string().min(1).max(100),
  phone: z
    .string()
    .min(9)
    .max(20)
    .regex(/^[0-9+]+$/),
  email: z.union([z.string().email().max(150), z.literal('')]).optional(),
  store_id: z.coerce.number().int().positive(),
  appointment_date: z.string().regex(dateRegex, 'Ngày hẹn phải có dạng YYYY-MM-DD'),
  appointment_time: z.string().regex(timeRegex, 'Giờ hẹn phải có dạng HH:mm'),
  note: z.string().max(2000).optional().nullable(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(['moi', 'dang_xu_ly', 'hoan_thanh', 'huy']),
});

export const appointmentTokenSchema = z.string().regex(/^[a-f0-9]{48}$/);

export const rescheduleAppointmentSchema = z.object({
  token: appointmentTokenSchema,
  date: z.string().regex(dateRegex, 'Ngày hẹn phải có dạng YYYY-MM-DD'),
  time: z.string().regex(timeRegex, 'Giờ hẹn phải có dạng HH:mm'),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
