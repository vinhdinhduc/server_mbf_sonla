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
  mobile_image_url: z.string().max(255).optional().nullable(),
  alt_text: z.string().max(255).optional().nullable(),
  open_new_tab: z.preprocess((value) => value === true || value === 'true' || value === '1', z.boolean()).default(false),
  image_width: z.coerce.number().int().positive().optional().nullable(),
  image_height: z.coerce.number().int().positive().optional().nullable(),
  image_bytes: z.coerce.number().int().nonnegative().optional().nullable(),
  person_name: z.string().max(100).optional().nullable(),
  job_title: z.string().max(100).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
});

export const updateSliderItemSchema = createSliderItemSchema.partial().omit({ zone_id: true });

export type UpdateSliderZoneDto = z.infer<typeof updateSliderZoneSchema>;
export type CreateSliderItemDto = z.infer<typeof createSliderItemSchema>;
export type UpdateSliderItemDto = z.infer<typeof updateSliderItemSchema>;
