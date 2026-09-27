import { z } from 'zod';

export const stationStatuses = ['active', 'warning', 'incident', 'maintenance'] as const;
export const stationTypes = ['2G', '3G', '4G', '5G'] as const;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Ngày lắp đặt không hợp lệ');

export const stationSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9_.-]+$/, 'Mã trạm chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới'),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().min(1).max(500),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    type: z.enum(stationTypes),
    status: z.enum(stationStatuses),
    power_watts: z.number().finite().min(0).max(1000000).nullable().default(null),
    coverage_radius_m: z.number().int().min(1).max(100000).nullable().default(null),
    installed_at: dateOnly.nullable().default(null),
    notes: z.string().trim().max(10000).nullable().default(null),
  })
  .strict();

export const stationIdSchema = z.coerce.number().int().positive().max(2147483647);
const bbox = z
  .string()
  .refine(
    (value) => value.split(',').every((part) => part.trim() !== ''),
    'bbox không được để trống tọa độ',
  )
  .transform((value) => value.split(',').map(Number))
  .pipe(
    z
      .tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ])
      .refine(
        ([west, south, east, north]) => west < east && south < north,
        'bbox phải theo thứ tự west,south,east,north',
      ),
  );
export const stationQuerySchema = z.object({
  status: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.array(z.enum(stationStatuses)).max(4))
    .optional(),
  type: z.enum(stationTypes).optional(),
  search: z.string().trim().max(200).optional(),
  bbox: bbox.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export const nearestStationQuerySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(5).default(5),
});
