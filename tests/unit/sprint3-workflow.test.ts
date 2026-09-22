import { assertTransition, maskPhone } from '../../src/utils/registrationWorkflow';
import { vietnameseMoney } from '../../src/utils/vietnameseMoney';
import { decryptSmtpPassword, encryptSmtpPassword, renderEmail } from '../../src/services/email.service';

describe('M07 workflow and receipt text', () => {
  it('TC-22 rejects backward status and requires cancellation reason', () => {
    expect(() => assertTransition('hoan_thanh', 'moi', 'admin')).toThrow();
    expect(() => assertTransition('moi', 'huy', 'admin')).toThrow('lý do');
    expect(() => assertTransition('moi', 'dang_xu_ly', 'giao_dich_vien')).not.toThrow();
    expect(() => assertTransition('hoan_thanh', 'dang_xu_ly', 'admin')).not.toThrow();
  });
  it('TC-21 spells the snapshot total in Vietnamese', () => {
    expect(vietnameseMoney(150000)).toBe('Một trăm năm mươi nghìn đồng');
    expect(vietnameseMoney(0)).toBe('Không đồng');
  });
  it('masks lookup phone', () => expect(maskPhone('0901234567')).toBe('090***567'));
});

describe('M12 secret and template safety', () => {
  it('encrypts SMTP password with a random nonce and authenticates it', () => {
    const one = encryptSmtpPassword('secret'); const two = encryptSmtpPassword('secret');
    expect(one).not.toBe(two);
    expect(one).not.toContain('secret');
    expect(decryptSmtpPassword(one)).toBe('secret');
    expect(() => decryptSmtpPassword(`${one.slice(0, -2)}aa`)).toThrow();
  });
  it('TC-31 escapes customer content and strips subject newlines', () => {
    const mail = renderEmail({ key: 'test', name: 'test', enabled: true, subject: 'Đăng ký {{customer_name}}', html: '<p>Chào {{customer_name}}</p>' }, { customer_name: '<script>alert(1)</script>\r\nBcc: evil@example.com' });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});
