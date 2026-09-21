import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const createShiftSchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    store_id: z.coerce.number().int().positive().optional(),
    shift_date: z.coerce.date(),
    start_time: z.string().regex(timeRegex, 'Giờ bắt đầu phải có dạng HH:mm hoặc HH:mm:ss'),
    end_time: z.string().regex(timeRegex, 'Giờ kết thúc phải có dạng HH:mm hoặc HH:mm:ss'),
    note: z.string().max(255).optional().nullable(),
  })
  .refine((data) => data.start_time < data.end_time, {
    message: 'start_time phai truoc end_time',
    path: ['end_time'],
  });

export const updateShiftSchema = z.object({
  store_id: z.coerce.number().int().positive().optional(),
  shift_date: z.coerce.date().optional(),
  start_time: z.string().regex(timeRegex).optional(),
  end_time: z.string().regex(timeRegex).optional(),
  note: z.string().max(255).optional().nullable(),
});

export type CreateShiftDto = z.infer<typeof createShiftSchema>;
export type UpdateShiftDto = z.infer<typeof updateShiftSchema>;
