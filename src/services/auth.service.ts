import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { LoginDto } from '../validators/auth.validator';

export interface LoginResult {
  token: string;
  user: {
    id: number;
    username: string;
    full_name: string;
    role: string;
  };
}

export const authService = {
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await User.scope('withPassword').findOne({ where: { username: dto.username } });
    if (!user) {
      throw AppError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (user.status === 'locked') {
      throw AppError.forbidden('Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw AppError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    };
  },

  async getMe(userId: number) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw AppError.notFound('Không tìm thấy người dùng');
    }
    return user;
  },
};
