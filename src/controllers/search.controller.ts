import { Request, Response } from 'express';
import { searchService } from '../services/search.service';
import { searchQuerySchema } from '../validators/search.validator';
import { sendSuccess } from '../utils/apiResponse';

export const searchController = {
  async search(req: Request, res: Response) {
    const query = searchQuerySchema.parse(req.query);
    const result = await searchService.searchAll(query.q);
    sendSuccess(res, result);
  },
};
