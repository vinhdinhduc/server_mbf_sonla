# Triển khai điều khoản, đồng ý và quên mật khẩu

## Thay đổi

- Hai trang `/dieu-khoan-su-dung` và `/chinh-sach-bao-mat`: ngày cập nhật 27/09/2026, phiên bản `v1.0`, mục lục theo vị trí cuộn, accordion trên mobile và chế độ in.
- `/admin/forgot-password`: nhập email/username → OTP 6 số → mật khẩu mới. Liên kết từ trang đăng nhập.
- Checkbox chung cho giỏ đăng ký SIM/gói cước/giải pháp, liên hệ, newsletter, đặt lịch, tuyển dụng và chat. Liên kết pháp lý mở tab mới.
- API JSON yêu cầu `agreed_terms: true`. Multipart tuyển dụng nhận chuỗi `"true"` và chuyển thành boolean; không chấp nhận `"false"`, `1`, thiếu trường hoặc trường `consent` cũ.
- Backend tự sinh `agreed_terms_at` và `agreed_terms_version`; bỏ qua các giá trị audit do client gửi. Không gán sự đồng ý giả cho dữ liệu lịch sử: bản ghi cũ giữ NULL.

## Migration và thứ tự phát hành

1. Sao lưu database theo quy trình hiện có.
2. Trong thư mục backend, chạy `npm run migrate` bằng cấu hình database của môi trường đích. Migration mới: `20260927000002-legal-consent-password-reset.js`.
3. Build/restart backend và phát hành frontend cùng đợt. Client cũ chỉ gửi `consent` sẽ bị từ chối; nên tải lại trang khi phát hành.
4. Kiểm tra Cài đặt Email trong admin và đặt `PUBLIC_SITE_URL` đúng domain công khai để logo trong email hiển thị đúng. Gửi OTP thử cho tài khoản kiểm thử thuộc đơn vị.

Migration thêm cột audit cho `registration_groups`, `contact_messages`, `newsletter_subscribers`, `store_appointments`, `job_applications`, `ai_chat_logs`; thêm `users.session_version`, `password_reset_otp` và `password_reset_limits`.

## API OTP

| API POST                        | Dữ liệu                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `/api/v1/auth/forgot-password`  | `{ "identifier": "email hoặc username" }`                                                    |
| `/api/v1/auth/verify-reset-otp` | `{ "challenge": "...", "otp": "123456" }`                                                    |
| `/api/v1/auth/reset-password`   | `{ "challenge": "...", "reset_token": "...", "password": "...", "confirm_password": "..." }` |

Các đường dẫn `/api/auth/*` cũng dùng cùng handler. Gửi mã luôn trả cùng thông báo và cấu trúc dữ liệu cho tài khoản không tồn tại, bị khóa hoặc đã đạt giới hạn. `challenge` là mã ngẫu nhiên không tiết lộ tài khoản. Định danh không rõ ràng do email trùng hoặc trùng username của tài khoản khác không được gửi mã; dùng username riêng để khôi phục.

- OTP có hạn 5 phút; `otp_code` chứa HMAC gắn với challenge, không chứa mã rõ. Mỗi lần gửi lại hợp lệ vô hiệu mã trước.
- Hạn mức cố định 3 lần/email trong cửa sổ 1 giờ, cách nhau tối thiểu 60 giây; username và email dùng chung bộ đếm. Giới hạn thêm 20 yêu cầu/IP/giờ. Hạn mức nằm trong DB, có khóa chống request đồng thời, không phụ thuộc cấu hình rate limit có thể tắt trong admin.
- Sai 5 lần vô hiệu OTP. Số lần sai được commit ngay cả khi API trả lỗi.
- OTP đúng cấp reset token ngẫu nhiên, DB chỉ giữ hash; token giữ thời hạn của OTP ban đầu, dùng một lần. Client chỉ giữ token trong bộ nhớ trang.
- Mật khẩu ít nhất 8 ký tự, có chữ hoa/thường/số, tối đa 72 byte để tránh bcrypt cắt ngầm. Hash bằng bcrypt cost 12.
- Cập nhật mật khẩu, tiêu thụ OTP và tăng `session_version` trong một transaction. Mỗi request cần đăng nhập kiểm tra phiên bản trong DB; JWT cũ và JWT không có phiên bản bị từ chối sau lần reset đầu tiên. Cookie/localStorage cũ ở thiết bị khác không tự biến mất nhưng không còn quyền truy cập API.
- Email dùng Nodemailer và SMTP từ Cài đặt Email; không BCC OTP, không ghi OTP/token vào log hoặc email outbox. SMTP gửi sau khi ghi OTP, ngoài thời gian xử lý HTTP để tránh lộ tài khoản qua độ trễ SMTP. Nếu gửi lỗi, OTP bị vô hiệu và log chỉ ghi lỗi tổng quát. Tiến trình dừng đột ngột trước khi gửi có thể làm mất lần gửi đó; người dùng cần xin lại sau cooldown.
- Tác vụ mỗi giờ dọn OTP đã hết hạn quá 24 giờ và bucket hạn mức không dùng quá 24 giờ.

## Nội dung cần đơn vị xác nhận trước khi công bố

Chưa có chính sách vận hành riêng do đơn vị cung cấp. Nội dung hiện dùng các mốc đề xuất: yêu cầu đăng ký/liên hệ/đặt lịch 24 tháng sau khi hoàn tất hoặc hủy; CV và chat 12 tháng; dữ liệu nhận tin xử lý xóa trong 30 ngày sau hủy, giữ thông tin chặn gửi tối thiểu nếu cần. Ngoại lệ lưu trữ theo hợp đồng, tranh chấp và nghĩa vụ pháp luật được nêu riêng.

**Các mốc này cần được đối chiếu với chính sách lưu trữ thực tế trước khi phát hành.** Thay đổi này không tự động xóa hồ sơ khách hàng theo các mốc trên; quy trình xóa/ẩn danh các hồ sơ đó cần được vận hành tương ứng. Tác vụ dọn tự động trong lần triển khai này chỉ áp dụng OTP và bucket hạn mức.

Danh sách bên nhận dữ liệu mô tả nhóm MobiFone, giao hàng, hạ tầng, SMTP, AI và dịch vụ đã có trong mã nguồn: Google reCAPTCHA, Google Analytics, Meta Pixel. Đơn vị cần điền tên nhà cung cấp thực tế và kiểm tra việc chuyển dữ liệu ra nước ngoài theo cấu hình đang sử dụng. Không bịa tên đối tác chưa có trong hệ thống. Kênh thực hiện quyền: hotline 18001090 và trang Liên hệ.

Yêu cầu ban đầu viện dẫn [Nghị định 13/2023/NĐ-CP](https://vanban.chinhphu.vn/default.aspx?docid=207759&pageid=27160). Ở thời điểm cập nhật, [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://bocongan.gov.vn/chinh-sach-phap-luat/co-so-du-lieu-van-ban/luat-bao-ve-du-lieu-ca-nhan-1753688803) đã có hiệu lực từ 01/01/2026. Nội dung trang dùng cách diễn đạt theo pháp luật hiện hành; cần đối chiếu văn bản hiện hành khi đơn vị duyệt nội dung.

## Kiểm thử

- `npm run build` ở backend; `node node_modules/typescript/bin/tsc --noEmit --incremental false` ở frontend.
- `npm test` ở backend: OTP, xác thực phiên, schema đồng ý và các bộ kiểm thử hồi quy hiện có.
- `tests/integration/legal-password-reset.mysql.test.ts`: bật `LEGAL_DB_TEST=1`, chỉ cho phép database `legal_consent_otp` ở `127.0.0.1:3311`, đã migrate đầy đủ. SMTP được mock; không gửi email tới khách hàng. Kiểm tra race khi gửi mã, đếm sai, reset đồng thời, hạn sử dụng và lưu audit thật.
- `e2e/legal-auth-consent.spec.ts`: trình duyệt ở 390px/1440px, mục lục, in, OTP, độ mạnh mật khẩu, liên kết tab mới, giữ dữ liệu form và checkbox. API OTP được mock để kiểm thử UI ổn định.

Khi đổi phiên bản trong tương lai, cập nhật đồng thời `client_wsmbfsla/lib/legal.ts` và `src/utils/legalConsent.ts`, lưu lại nội dung pháp lý của phiên bản cũ trong lịch sử phát hành.
