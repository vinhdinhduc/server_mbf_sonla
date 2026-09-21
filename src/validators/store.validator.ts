import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm');
const hours = z
  .array(
    z
      .object({
        days: z.array(z.number().int().min(1).max(7)).min(1),
        open: time,
        close: time,
      })
      .refine((slot) => slot.close > slot.open, {
        path: ['close'],
        message: 'Giờ đóng phải sau giờ mở',
      }),
  )
  .superRefine((slots, context) => {
    for (let day = 1; day <= 7; day += 1) {
      const sameDay = slots
        .filter((slot) => slot.days.includes(day))
        .sort((a, b) => a.open.localeCompare(b.open));
      for (let index = 1; index < sameDay.length; index += 1) {
        if (sameDay[index].open < sameDay[index - 1].close) {
          context.addIssue({ code: 'custom', message: `Các khung giờ ngày ${day} bị chồng lấn` });
        }
      }
    }
  });

export const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(255),
  street_address: z.string().trim().min(1).max(255),
  ward_code: z.string().regex(/^\d{5}$/, 'Vui lòng chọn xã/phường hợp lệ'),
  phone: z.string().trim().min(9).max(20),
  email: z.string().email().max(150).optional().nullable(),
  lat: z.coerce.number().min(8).max(24),
  lng: z.coerce.number().min(102).max(110),
  opening_hours_json: hours,
  status: z.enum(['active', 'inactive']).default('active'),
  geocode_source: z.enum(['map', 'address', 'manual']).optional().nullable(),
});

export const updateStoreSchema = createStoreSchema.partial();
export const listStoreQuerySchema = z.object({
  ward_code: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
});

export type CreateStoreDto = z.infer<typeof createStoreSchema>;
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;
