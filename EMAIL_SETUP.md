# Cấu hình gửi email

Backend đọc `server/.env` khi chạy lệnh từ thư mục `server`. Cấu hình lưu
tại **Quản trị → Email & thông báo** được ưu tiên hơn cấu hình môi trường.

1. Chạy `npm run migrate` nếu cơ sở dữ liệu chưa có các bảng email.
2. Nhập host, port, chế độ bảo mật, tài khoản SMTP, mật khẩu và địa chỉ gửi
   trong trang quản trị. Port 587 thường dùng STARTTLS; port 465 dùng SSL.
   Địa chỉ gửi phải được nhà cung cấp cho phép sử dụng.
3. Nhấn **Lưu SMTP**, rồi **Kiểm tra kết nối**.
4. Nhấn **Gửi thư thử tới email tài khoản**. Tài khoản quản trị phải có email
   nhận được thư. Kiểm tra cả hộp thư rác.

Kiểm tra kết nối chỉ xác nhận kết nối/xác thực SMTP. Gửi thư thử mới kiểm tra
việc máy chủ chấp nhận thư: https://nodemailer.com/smtp

Có thể cấu hình bằng `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM` trong `server/.env` nếu chưa lưu SMTP qua trang quản trị.
`SMTP_FROM` chỉ chứa địa chỉ email. Mật khẩu để trống trên biểu mẫu sẽ giữ
mật khẩu đã lưu; nếu chưa lưu mật khẩu, hệ thống dùng `SMTP_PASS`.
Giữ ổn định `APP_SECRET_KEY` vì khóa này mã hóa mật khẩu SMTP trong database.

Worker xử lý hàng đợi mỗi 15 giây, thử tối đa 3 lần khi gửi lỗi. Nhật ký gửi
hiển thị trạng thái và mã lỗi; nút Gửi lại bắt đầu một lượt thử mới.
OTP được gửi trực tiếp, không ghi vào hàng đợi và không gửi BCC.

## Lỗi Cannot find module '../addressparser'

Đây là file nội bộ của Nodemailer bị thiếu trong `node_modules`.
Dừng tiến trình dev, chạy `npm ci` trong thư mục `server` để cài lại đúng
lockfile, rồi chạy `npm run dev`. Không cần sửa `tsconfig.json` hay cài một
gói `addressparser` riêng.

## Kiểm tra tự động

```powershell
npm run build
npm test -- --runTestsByPath tests/unit/email.service.test.ts tests/unit/passwordResetEmail.test.ts tests/unit/nodemailer-runtime.test.ts
```

Các kiểm tra này không gửi thư đến hộp thư thật. Cần cấu hình SMTP hợp lệ
và thực hiện bước gửi thư thử để xác nhận việc nhận thư thực tế.
