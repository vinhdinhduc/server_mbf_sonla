export class AppError extends Error {
  public readonly statusCode: number;

  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string): AppError {
    return new AppError(message, 400);
  }

  static unauthorized(message = 'Bạn chưa đăng nhập'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện hành động này'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = 'Không tìm thấy dữ liệu'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message = 'Dữ liệu đã được thay đổi bởi yêu cầu khác'): AppError {
    return new AppError(message, 409);
  }

  static tooManyRequests(message = 'Quá nhiều yêu cầu'): AppError {
    return new AppError(message, 429);
  }

  static internal(message = 'Lỗi hệ thống'): AppError {
    return new AppError(message, 500);
  }
}
