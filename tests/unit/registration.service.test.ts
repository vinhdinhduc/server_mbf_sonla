import { sequelize } from '../../src/config/database';
import { RegistrationGroup } from '../../src/models/RegistrationGroup.model';
import { RegistrationItem } from '../../src/models/RegistrationItem.model';
import { SimNumber } from '../../src/models/SimNumber.model';
import { Package } from '../../src/models/Package.model';
import { Solution } from '../../src/models/Solution.model';
import { registrationService } from '../../src/services/registration.service';
import { settingService } from '../../src/services/setting.service';
import { emailService } from '../../src/services/email.service';

jest.mock('../../src/config/database', () => ({
  sequelize: { transaction: jest.fn(), query: jest.fn() },
}));
jest.mock('../../src/models/RegistrationGroup.model');
jest.mock('../../src/models/RegistrationItem.model');
jest.mock('../../src/models/SimNumber.model');
jest.mock('../../src/models/Package.model');
jest.mock('../../src/models/Solution.model');
jest.mock('../../src/services/setting.service');
jest.mock('../../src/services/email.service', () => ({ emailService: { enqueue: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../src/utils/registrationWorkflow', () => ({ allocateNumber: jest.fn().mockResolvedValue(1), assertTransition: jest.fn() }));

const mockedSequelize = sequelize as jest.Mocked<typeof sequelize>;
const mockedGroup = RegistrationGroup as jest.Mocked<typeof RegistrationGroup>;
const mockedItem = RegistrationItem as jest.Mocked<typeof RegistrationItem>;
const mockedSim = SimNumber as jest.Mocked<typeof SimNumber>;
const mockedSetting = settingService as jest.Mocked<typeof settingService>;

describe('registration.service - submitCart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGroup.findOne.mockResolvedValue(null);
    (sequelize.query as jest.Mock).mockResolvedValue([]);
    mockedSetting.getRawValue.mockResolvedValue('admin@mobifone-sonla.vn');
    mockedSim.findByPk.mockResolvedValue({
      id: 1,
      phone_number: '0900123456',
      subscription_type: 'postpaid',
    } as any);
    mockedSim.update.mockResolvedValue([1] as any);
  });

  const dto = {
    customer_name: 'Nguyen Van A',
    phone: '0912345678',
    note: 'Test',
    items: [
      { type: 'sim' as const, reference_id: 1 },
      { type: 'sim' as const, reference_id: 1 },
    ],
    recaptcha_token: 'fake-token',
  };

  it('tao dung 1 registration_group + n registration_items trong 1 transaction', async () => {
    const fakeGroup = { id: 10 };
    mockedSequelize.transaction.mockImplementation(async (cb: any) => cb('FAKE_TRANSACTION'));
    mockedGroup.create.mockResolvedValue(fakeGroup as any);
    mockedItem.bulkCreate.mockResolvedValue([] as any);
    mockedGroup.findByPk.mockResolvedValue({ id: 10, items: [] } as any);

    await registrationService.submitCart(dto as any);

    expect(mockedSequelize.transaction).toHaveBeenCalledTimes(1);
    expect(mockedGroup.create).toHaveBeenCalledTimes(1);
    expect(mockedItem.bulkCreate).toHaveBeenCalledTimes(1);
    expect(mockedSim.update).toHaveBeenCalledTimes(1);

    const bulkCreateArg = mockedItem.bulkCreate.mock.calls[0][0] as any[];
    expect(bulkCreateArg).toHaveLength(dto.items.length);
    bulkCreateArg.forEach((row) => {
      expect(row.registration_group_id).toBe(fakeGroup.id);
    });
  });

  it('từ chối khi sim đã được người khác giữ trước', async () => {
    mockedSequelize.transaction.mockImplementation(async (cb: any) => cb('FAKE_TRANSACTION'));
    mockedGroup.create.mockResolvedValue({ id: 30 } as any);
    mockedSim.update.mockResolvedValue([0] as any);

    await expect(registrationService.submitCart(dto as any)).rejects.toThrow(
      'Số vừa được chọn bởi người khác',
    );
    expect(mockedItem.bulkCreate).not.toHaveBeenCalled();
  });

  it('rollback dung khi co loi giua chung (bulkCreate that bai)', async () => {
    mockedGroup.create.mockResolvedValue({ id: 20 } as any);
    mockedItem.bulkCreate.mockRejectedValue(new Error('DB loi giua chung'));

    // sequelize.transaction that: neu callback throw, transaction cung reject (rollback that)
    mockedSequelize.transaction.mockImplementation(async (cb: any) => {
      try {
        return await cb('FAKE_TRANSACTION');
      } catch (err) {
        // Mo phong hanh vi that cua Sequelize: rollback va nem lai loi
        throw err;
      }
    });

    await expect(registrationService.submitCart(dto as any)).rejects.toThrow('DB loi giua chung');
    // Khong duoc goi tiep sau khi transaction that bai (khong gui email, khong tra ve group)
    expect(emailService.enqueue).not.toHaveBeenCalled();
  });
});
