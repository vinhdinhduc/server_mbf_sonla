import { WorkShift } from '../../src/models/WorkShift.model';
import { User } from '../../src/models/User.model';
import { shiftService } from '../../src/services/shift.service';
import { AppError } from '../../src/utils/AppError';

jest.mock('../../src/models/WorkShift.model');
jest.mock('../../src/models/User.model');

const mockedWorkShift = WorkShift as jest.Mocked<typeof WorkShift>;
const mockedUser = User as jest.Mocked<typeof User>;

describe('shift.service - overlap detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validDto = {
    user_id: 2,
    shift_date: '2026-09-01' as any,
    start_time: '08:00:00',
    end_time: '12:00:00',
    note: null,
  };

  it('tu choi khi trung hoan toan voi ca da co (cua nguoi khac)', async () => {
    mockedUser.findByPk.mockResolvedValue({ id: 2, role: 'giao_dich_vien' } as any);
    mockedWorkShift.findOne.mockResolvedValue({
      id: 99,
      user_id: 3,
      start_time: '08:00:00',
      end_time: '12:00:00',
    } as any);

    await expect(shiftService.create(validDto, 1)).rejects.toThrow(AppError);
  });

  it('tu choi khi trung mot phan (overlap giua khoang)', async () => {
    mockedUser.findByPk.mockResolvedValue({ id: 2, role: 'giao_dich_vien' } as any);
    // Ca da co: 10:00 - 14:00, ca moi: 08:00 - 12:00 => trung 10:00-12:00
    mockedWorkShift.findOne.mockResolvedValue({
      id: 100,
      user_id: 5,
      start_time: '10:00:00',
      end_time: '14:00:00',
    } as any);

    await expect(shiftService.create(validDto, 1)).rejects.toThrow(AppError);
  });

  it('cho phep tao khi khong trung ca nao', async () => {
    mockedUser.findByPk.mockResolvedValue({ id: 2, role: 'giao_dich_vien' } as any);
    mockedWorkShift.findOne.mockResolvedValue(null);
    mockedWorkShift.create.mockResolvedValue({ id: 1, ...validDto } as any);

    const result = await shiftService.create(validDto, 1);
    expect(mockedWorkShift.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('tu choi khi xep lich cho nguoi khong phai giao_dich_vien', async () => {
    mockedUser.findByPk.mockResolvedValue({ id: 2, role: 'chuyen_vien' } as any);

    await expect(shiftService.create(validDto, 1)).rejects.toThrow(AppError);
  });
});
