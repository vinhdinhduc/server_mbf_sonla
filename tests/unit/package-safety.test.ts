import { Package } from '../../src/models/Package.model';
import { RegistrationItem } from '../../src/models/RegistrationItem.model';
import { packageService } from '../../src/services/package.service';
import { packageController } from '../../src/controllers/package.controller';

jest.mock('../../src/models/Package.model', () => ({ Package: { findOne: jest.fn() } }));
jest.mock('../../src/models/RegistrationItem.model', () => ({
  RegistrationItem: { count: jest.fn() },
}));

test('referenced packages cannot be deleted even through a direct API call', async () => {
  const update = jest.fn();
  (Package.findOne as jest.Mock).mockResolvedValue({ id: 7, update });
  (RegistrationItem.count as jest.Mock).mockResolvedValue(3);
  await expect(packageService.remove(7)).rejects.toThrow('Gói này có 3 đăng ký');
  expect(update).not.toHaveBeenCalled();
  expect(RegistrationItem.count).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { type: 'goi_cuoc', reference_id: 7 },
      distinct: true,
      col: 'registration_group_id',
    }),
  );
});

test('unreferenced packages use soft deletion', async () => {
  const update = jest.fn();
  (Package.findOne as jest.Mock).mockResolvedValue({ id: 7, update });
  (RegistrationItem.count as jest.Mock).mockResolvedValue(0);
  await packageService.remove(7);
  expect(update).toHaveBeenCalledWith({ status: 'inactive', deleted_at: expect.any(Date) });
});

test('price updates audit both old and new values', async () => {
  const item = { id: 7, code: 'XMH100', price: 100000, toJSON: jest.fn(), update: jest.fn() };
  item.toJSON
    .mockReturnValueOnce({ id: 7, code: 'XMH100', price: 100000 })
    .mockReturnValue({ id: 7, code: 'XMH100', price: 0 });
  (Package.findOne as jest.Mock).mockResolvedValue(item);
  const req = { params: { id: '7' }, body: { price: 0 }, auditContext: undefined };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await packageController.update(req as never, res as never);
  expect(req.auditContext).toEqual(
    expect.objectContaining({
      oldValue: expect.objectContaining({ price: 100000 }),
      newValue: expect.objectContaining({ price: 0 }),
    }),
  );
});
