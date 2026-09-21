import { renderTemplate } from '../../src/services/notification/email.notifier';

describe('email notifier template', () => {
  it('escape dữ liệu người dùng và loại bỏ xuống dòng ở subject', () => {
    const result = renderTemplate('new_contact', {
      branch_name: 'MobiFone Sơn La\r\nBcc: attacker@example.com',
      name: '<script>alert(1)</script>\nInjected',
      phone: '0901234567',
      email: 'customer@example.com',
      message: '<img src=x onerror=alert(1)>',
      hotline: '18001090',
    });

    expect(result.subject).not.toMatch(/[\r\n]/);
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<img');
    expect(result.html).toContain('&lt;script&gt;');
  });
});
