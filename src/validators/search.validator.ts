import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Vui lòng nhập từ khóa tìm kiếm'),
});

export type SearchQueryDto = z.infer<typeof searchQuerySchema>;
