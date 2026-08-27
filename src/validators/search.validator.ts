import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Vui long nhap tu khoa tim kiem'),
});

export type SearchQueryDto = z.infer<typeof searchQuerySchema>;
