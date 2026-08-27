import { z } from 'zod';

export const sliderAnimationEnum = z.enum(['fade', 'slide', 'zoom']);
export const sliderStatusEnum = z.enum(['active', 'inactive']);

export const updateSliderZoneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  animation_type: sliderAnimationEnum.optional(),
  autoplay_enabled: z.coerce.boolean().optional(),
  autoplay_speed_ms: z.coerce.number().int().positive().optional(),
  status: sliderStatusEnum.optional(),
});

export const createSliderItemSchema = z.object({
  zone_id: z.coerce.number().int().positive(),
  image_url: z.string().min(1).max(255),
  link_url: z.string().max(255).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  caption: z.string().optional().nullable(),
  display_order: z.coerce.number().int().default(0),
  status: sliderStatusEnum.default('active'),
  start_date: z.coerce.date().optional().nullable(),
  end_date: z.coerce.date().optional().nullable(),
});

export const updateSliderItemSchema = createSliderItemSchema.partial().omit({ zone_id: true });

export type UpdateSliderZoneDto = z.infer<typeof updateSliderZoneSchema>;
export type CreateSliderItemDto = z.infer<typeof createSliderItemSchema>;
export type UpdateSliderItemDto = z.infer<typeof updateSliderItemSchema>;
