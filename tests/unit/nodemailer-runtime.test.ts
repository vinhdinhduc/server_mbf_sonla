import nodemailer from 'nodemailer';

it('loads the installed Nodemailer package and composes a UTF-8 MIME email', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: { name: 'MobiFone Sơn La', address: 'sender@example.com' },
    to: 'customer@example.com',
    subject: 'Kiểm tra email',
    text: 'Mã OTP: 012345',
    html: '<p>Mã OTP: <strong>012345</strong></p>',
  });
  expect(result.envelope.to).toEqual(['customer@example.com']);
  const message = result.message.toString();
  expect(message).toContain('multipart/alternative');
  expect(message).toContain('text/plain; charset=utf-8');
  expect(message).toContain('text/html; charset=utf-8');
  expect(message).toContain('012345');
});
