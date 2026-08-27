import { Op } from 'sequelize';
import { News } from '../models/News.model';
import { Package } from '../models/Package.model';
import { SimNumber } from '../models/SimNumber.model';

export const searchService = {
  async searchAll(q: string) {
    const like = `%${q}%`;

    const [news, packages, sims] = await Promise.all([
      News.findAll({
        where: { status: 'published', title: { [Op.like]: like } },
        limit: 10,
      }),
      Package.findAll({
        where: { status: 'active', name: { [Op.like]: like } },
        limit: 10,
      }),
      SimNumber.findAll({
        where: { status: 'available', phone_number: { [Op.like]: like } },
        limit: 10,
      }),
    ]);

    return {
      news,
      packages,
      sims,
    };
  },
};
