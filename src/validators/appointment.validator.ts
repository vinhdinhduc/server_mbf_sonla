import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createAppointmentSchema = z.object({
  customer_name: z.string().min(1).max(100),
  phone: z
    .string()
    .min(9)
    .max(20)
    .regex(/^[0-9+]+$/),
  store_id: z.coerce.number().int().positive(),
  appointment_date: z.string().regex(dateRegex, 'appointment_date phai dang YYYY-MM-DD'),
  appointment_time: z.string().regex(timeRegex, 'appointment_time phai dang HH:mm'),
  note: z.string().max(2000).optional().nullable(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(['moi', 'dang_xu_ly', 'hoan_thanh', 'huy']),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
