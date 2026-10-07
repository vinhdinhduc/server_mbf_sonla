module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO email_templates (\`key\`,name,subject,html,enabled,updated_at)
       VALUES ('password_reset','Đặt lại mật khẩu','Mã xác thực đặt lại mật khẩu MobiFone Sơn La',
      '<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden">Mã OTP đặt lại mật khẩu có hiệu lực trong 5 phút.</span><h1 style="margin:0 0 16px;font-size:22px">Đặt lại mật khẩu</h1><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của Quý khách. Nhập mã xác thực dưới đây để tiếp tục:</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background-color:#f5f8fc;border-left:4px solid #0065b3"><tbody><tr><td style="padding:16px 22px;color:#0065b3;font-size:30px;font-weight:bold">{{message}}</td></tr></tbody></table><p>Mã có hiệu lực trong <strong>5 phút</strong> và chỉ sử dụng một lần. Không chia sẻ mã này với bất kỳ ai.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tbody><tr><td class="email-cta-cell" align="center" bgcolor="#0065b3" style="border-radius:8px;background-color:#0065b3"><a href="{{confirm_url}}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold">Tiếp tục đặt lại mật khẩu</a></td></tr></tbody></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background-color:#fff8e5"><tbody><tr><td style="padding:14px 16px;border-left:4px solid #f0b429;color:#59420b">Nếu Quý khách không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản vẫn an toàn.</td></tr></tbody></table>',
      TRUE,NOW())`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DELETE FROM email_templates WHERE `key`='password_reset'",
    );
  },
};
