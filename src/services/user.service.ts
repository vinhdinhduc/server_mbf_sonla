import bcrypt from 'bcrypt';
import { User } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { CreateUserDto, UpdateUserDto } from '../validators/user.validator';
import { buildImageUrl } from '../utils/buildImageUrl';
import { Store } from '../models/Store.model';
import { emailService } from './email.service';

const SALT_ROUNDS = 12;

function presentUser(user: User) {
  const data = user.toJSON() as Record<string, unknown>;
  return {
    ...data,
    id: user.id,
    avatar_url: buildImageUrl(data.avatar_url as string | null | undefined),
  };
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
    await validateStoreAssignment(dto.role, dto.store_id);

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
      store_id: dto.role === 'giao_dich_vien' ? dto.store_id : null,
      job_title: dto.job_title ?? null,
      is_public_profile: dto.role === 'giao_dich_vien' && Boolean(dto.is_public_profile),
      public_phone: dto.public_phone ?? null,
      public_zalo: dto.public_zalo ?? null,
    });
    await emailService.enqueue(user.email, 'account_created', { customer_name: user.full_name }, `account:${user.id}:created`);
    return this.getById(user.id);
  },

  async update(id: number, dto: UpdateUserDto, actorId: number) {
    const user = await User.scope('withPassword').findByPk(id);
    if (!user) throw AppError.notFound('Không tìm thấy người dùng');
    const nextRole = dto.role ?? user.role;
    const nextStoreId = nextRole === 'giao_dich_vien' ? (dto.store_id ?? user.store_id) : null;
    await validateStoreAssignment(nextRole, nextStoreId);
    if (
      nextRole === 'giao_dich_vien' &&
      (dto.is_public_profile ?? user.is_public_profile) &&
      !(dto.public_phone ?? user.public_phone)
    ) {
      throw AppError.badRequest('Cần số điện thoại công việc để hiển thị công khai');
    }

    if (id === actorId && (dto.status === 'locked' || (dto.role && dto.role !== user.role))) {
      throw AppError.badRequest('Bạn không thể tự khóa hoặc hạ quyền tài khoản của chính mình');
    }
    const removesActiveAdmin =
      user.role === 'admin' &&
      user.status === 'active' &&
      (dto.status === 'locked' || (dto.role !== undefined && dto.role !== 'admin'));
    if (removesActiveAdmin) {
      const activeAdminCount = await User.count({ where: { role: 'admin', status: 'active' } });
      if (activeAdminCount <= 1) {
        throw AppError.badRequest('Hệ thống phải luôn còn ít nhất một quản trị viên hoạt động');
      }
    }

    const updatePayload: Partial<User> = { ...dto } as Partial<User>;
    updatePayload.store_id = nextStoreId;
    if (nextRole !== 'giao_dich_vien') updatePayload.is_public_profile = false;
    if (dto.password) {
      updatePayload.password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    delete (updatePayload as any).password;

    await user.update(updatePayload);
    return this.getById(id);
  },

  async remove(id: number, actorId: number) {
    const user = await User.findByPk(id);
    if (!user) throw AppError.notFound('Không tìm thấy người dùng');
    if (id === actorId) throw AppError.badRequest('Bạn không thể tự xóa tài khoản của chính mình');
    if (user.role === 'admin' && user.status === 'active') {
      const activeAdminCount = await User.count({ where: { role: 'admin', status: 'active' } });
      if (activeAdminCount <= 1) {
        throw AppError.badRequest('Hệ thống phải luôn còn ít nhất một quản trị viên hoạt động');
      }
    }
    await user.update({ status: 'locked' });
  },
};

async function validateStoreAssignment(role: string, storeId: number | null | undefined) {
  if (role !== 'giao_dich_vien') return;
  if (!storeId) throw new AppError('Giao dịch viên phải thuộc một cửa hàng', 422);
  const store = await Store.findByPk(storeId);
  if (!store || store.status !== 'active')
    throw new AppError('Vui lòng chọn cửa hàng đang hoạt động', 422);
}
