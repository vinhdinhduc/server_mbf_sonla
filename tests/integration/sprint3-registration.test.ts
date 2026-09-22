import { sequelize, Package, RegistrationGroup, SimNumber, User } from '../../src/models';
import { registrationService } from '../../src/services/registration.service';
import { receiptService } from '../../src/services/receipt.service';
import { settingService } from '../../src/services/setting.service';

const isolated = process.env.E2E_DB_ISOLATED === '1' && process.env.DB_NAME === 'mobifone_sonla_e2e';
const suite = isolated ? describe : describe.skip;
suite('Sprint 3 integration on isolated database', () => {
  const admin = { id: 1, username: 'admin', role: 'admin' as const };
  let pkg: Package;
  let sim: SimNumber;
  let group: RegistrationGroup | null = null;
  beforeAll(async () => {
    sim = (await SimNumber.findOne({ where: { status: 'available', subscription_type: 'postpaid', price: null } }))!;
    expect(sim).toBeTruthy();
    pkg = await Package.create({ code: `E2E${Date.now().toString().slice(-9)}`, name: 'Gói thử 90K', slug: `e2e-90k-${Date.now()}`, group_type: 'hot', price: 90000, duration_value: 30, duration_unit: 'ngay', status: 'active', display_order: 0 });
  });
  afterAll(async () => {
    if (group) {
      await sequelize.query('DELETE FROM email_outbox WHERE idempotency_key LIKE :prefix', { replacements: { prefix: `registration:${group.id}:%` } });
      await sequelize.query('DELETE FROM registration_receipts WHERE registration_id=:id', { replacements: { id: group.id } });
      await RegistrationGroup.destroy({ where: { id: group.id } });
    }
    if (sim) await SimNumber.update({ status: 'available', reserved_until: null, reserved_registration_id: null }, { where: { id: sim.id } });
    if (pkg) await Package.destroy({ where: { id: pkg.id }, force: true });
    await sequelize.close();
  });
  it('TC-18/19/20/21/22: scoped order, snapshot total, SIM sync, receipt and transitions', async () => {
    const phone = `09${Date.now().toString().slice(-8)}`;
    const dto = { customer_name: 'Khách thử nghiệm', phone, email: '', customer_type: 'individual' as const, consent: true as const, website: '', items: [{ type: 'sim' as const, reference_id: sim.id }, { type: 'goi_cuoc' as const, reference_id: pkg.id }], delivery_method: 'address' as const, sim_type: 'physical' as const, province: 'Sơn La' as const, ward: 'Tô Hiệu', delivery_address: '1 Đường thử', recaptcha_token: 'e2e' };
    const requestKey = `e2e-${Date.now()}-registration`;
    group = await registrationService.submitCart(dto, requestKey);
    expect((await registrationService.submitCart(dto, requestKey))?.id).toBe(group?.id);
    await expect(registrationService.submitCart({ ...dto, customer_name: 'Khác' }, requestKey)).rejects.toMatchObject({ statusCode: 409 });
    expect(group).toBeTruthy();
    const fee = Number(await settingService.getRawValue('sim_activation_fee_postpaid') || 60000);
    expect(Number(group!.total_amount)).toBe(fee + 90000);
    expect(Number(group!.items![0].fee_snapshot)).toBe(fee);
    expect(group!.code).toMatch(/^DK-\d{6}-\d{4}$/);
    const teller = await User.findOne({ where: { role: 'giao_dich_vien' } });
    expect(teller).toBeTruthy();
    await expect(registrationService.getById(group!.id, { id: teller!.id, username: teller!.username, role: 'giao_dich_vien' })).rejects.toMatchObject({ statusCode: 403 });
    await registrationService.updateStatus(group!.id, { status: 'dang_xu_ly' }, admin);
    await registrationService.updateStatus(group!.id, { status: 'hoan_thanh' }, admin);
    expect((await SimNumber.findByPk(sim.id))!.status).toBe('sold');
    await expect(registrationService.updateStatus(group!.id, { status: 'moi' }, admin)).rejects.toMatchObject({ statusCode: 409 });
    const first = await receiptService.build(group!.id, admin);
    const second = await receiptService.build(group!.id, admin);
    expect(first.number).toBe(second.number);
    expect(first.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(first.buffer.length).toBeGreaterThan(3000);
    await registrationService.updateStatus(group!.id, { status: 'dang_xu_ly', note: 'Admin mở lại' }, admin);
    await registrationService.updateStatus(group!.id, { status: 'huy', note: 'Khách đổi ý' }, admin);
    expect((await SimNumber.findByPk(sim.id))!.status).toBe('available');
  });
});
