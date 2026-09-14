import bcrypt from 'bcrypt';
import { User } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { CreateUserDto, UpdateUserDto } from '../validators/user.validator';
import { buildImageUrl } from '../utils/buildImageUrl';

const SALT_ROUNDS = 10;

function presentUser(user: User) {
  const data = user.toJSON() as Record<string, unknown>;
  return { ...data, id: user.id, avatar_url: buildImageUrl(data.avatar_url as string | null | undefined) };
}

export const userService = {
  async list() {
    const users = await User.findAll({ order: [['id', 'ASC']] });
    return users.map(presentUser);
  },

  async getById(id: number) {
    const user = await User.findByPk(id);
    if (!user) throw AppError.notFound('Không tìm thấy người dùng');
    return presentUser(user);
  },

  async create(dto: CreateUserDto) {
    const existing = await User.findOne({ where: { username: dto.username } });
    if (existing) throw AppError.badRequest('Tên đăng nhập đã tồn tại');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await User.create({
      username: dto.username,
      password_hash: passwordHash,
      full_name: dto.full_name,
      email: dto.email,
      phone: dto.phone,
      avatar_url: dto.avatar_url || null,
      role: dto.role,
      status: dto.status,
    });
    return this.getById(user.id);
  },

  async update(id: number, dto: UpdateUserDto) {
    const user = await User.scope('withPassword').findByPk(id);
    if (!user) throw AppError.notFound('Không tìm thấy người dùng');

    const updatePayload: Partial<User> = { ...dto } as Partial<User>;
    if (dto.password) {
      updatePayload.password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    delete (updatePayload as any).password;

    await user.update(updatePayload);
    return this.getById(id);
  },

  async remove(id: number) {
    const user = await User.findByPk(id);
    if (!user) throw AppError.notFound('Không tìm thấy người dùng');
    await user.destroy();
  },
};
