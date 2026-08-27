import { z } from 'zod';

export const createStoreSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(255),
  district: z.string().min(1).max(100),
  phone: z.string().min(1).max(20),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  opening_hours: z.string().max(100).optional().nullable(),
});

export const updateStoreSchema = createStoreSchema.partial();

export const listStoreQuerySchema = z.object({
  district: z.string().optional(),
});

export type CreateStoreDto = z.infer<typeof createStoreSchema>;
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;
