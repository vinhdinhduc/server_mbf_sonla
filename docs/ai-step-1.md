# AI Chatbot — bước 1

## Phạm vi

- Giữ trang admin hoạt động khi API key không giải mã được; cho nhập key thay thế.
- Đọc ciphertext `enc:v1:` bằng secret hiện tại rồi danh sách secret cũ. Ciphertext không nhận diện được bị từ chối.
- Lưu cấu hình chỉ validate định dạng. Kiểm tra kết nối là thao tác riêng với provider/model/key đang nhập; không tự lưu dữ liệu thử.
- Adapter trả usage thật. Không đoán token theo độ dài nội dung. Ghi mỗi lần gọi (kể cả retry, response rỗng và connection test) vào `ai_provider_calls`.
- Usage thiếu được lưu NULL; chi phí thiếu giá hoặc usage cũng là NULL. Bảng giá do admin nhập, đơn vị USD/triệu token, khớp chính xác provider/model. Mỗi log giữ giá tại thời điểm gọi; sửa giá không đổi lịch sử.
- Thống kê token/chi phí 30 ngày lấy từ bảng mới. Không trộn số ước lượng cũ; các log hội thoại cũ được giữ nguyên. Usage bao gồm connection test và retry, số hội thoại vẫn tính từ `ai_chat_logs`.
- Mỗi yêu cầu provider dùng một deadline 20 giây cho tối đa 2 lần thử. Việc chờ DB/ghi log nằm ngoài deadline mạng này. Lỗi ghi usage được báo bằng thông điệp cố định và không gọi lại provider.
- Usage không lưu câu hỏi, câu trả lời, IP, session hoặc key. Có index ngày tạo, provider/model/ngày tạo, và khóa duy nhất request/attempt. Job chạy mỗi giờ xóa theo lô tối đa 20.000 dòng quá 12 tháng.

## Sao lưu và migration

Yêu cầu: `mysqldump` trên PATH, quyền đọc DB và DDL; kiểm tra cấu hình DB đích trong `server/.env`. Dừng ứng dụng khi migrate/rollback. Bản sao lưu chứa dữ liệu nghiệp vụ, lưu trong `server/backups/` được gitignore; giới hạn quyền truy cập thư mục này ở hệ điều hành.

Từ `server/`:

```sh
node scripts/ai-migrate.cjs up
npm run build
```

Script sao lưu toàn DB thành `.sql.gz`, đọc lại để kiểm tra gzip, tạo SHA-256, rồi mới chạy Sequelize tới `20260930000001-ai-provider-usage.js`. Mật khẩu DB đi qua file tạm, không nằm trong argv. Sao lưu thất bại sẽ dừng trước migration. Lệnh up cũng chạy migration cũ còn thiếu; kiểm tra `npx sequelize-cli db:migrate:status` trước khi triển khai.

Migration bước 1 chỉ thêm bảng usage, không sửa/xóa cấu hình cũ. Có thể chạy lại sau lỗi tạo index.

Rollback (dừng phiên bản mới trước):

```sh
node scripts/ai-migrate.cjs down
```

Down sao lưu trước, rồi đổi tên bảng thành `ai_provider_calls_rollback`, không xóa usage. Nếu archive trùng tên, down dừng để tránh ghi đè. Sau đó dùng phiên bản ứng dụng trước bước 1. Chạy up lại sẽ khôi phục bảng và index. Archive không được worker phiên bản cũ dọn: quản trị viên cần quản lý thời hạn lưu cả archive và backup. Nếu đã triển khai migration bước sau, rollback các bước sau trước.

Chưa chạy migration trên DB nghiệp vụ trong phiên triển khai mã này.

## Xoay khóa

Thêm vào môi trường backend (chuyển tiếp các biến này vào container nếu dùng Docker):

```dotenv
APP_SECRET_KEY=<secret hiện tại, ít nhất 32 ký tự>
APP_SECRET_KEY_PREVIOUS='["<secret cũ, ít nhất 32 ký tự>"]'
```

Danh sách tối đa 5 secret. Không có secret cũ thì không thể phục hồi ciphertext cũ: nhập lại API key. Mọi lần lưu key mới dùng secret hiện tại. Chỉ gỡ secret cũ khi đã mã hóa lại các API key còn dùng. SMTP cũng phụ thuộc `APP_SECRET_KEY` nhưng có hàm mã hóa riêng, chưa hỗ trợ danh sách secret cũ: khi đổi secret hiện tại cần cấu hình lại mật khẩu SMTP. Không tự ghi đè ciphertext không đọc được.

## Kiểm thử thủ công

1. Secret sai: trang admin vẫn mở, hiện “Key không đọc được”; nhập key mới, lưu và tải lại, chỉ thấy key che.
2. Đổi provider/model, nhập key mới, bấm kiểm tra trước khi lưu: request phải dùng giá trị đang nhập. Key sai → thông báo key; model sai → thông báo model/tham số; 429 → quota/giới hạn; timeout → 20 giây.
3. Kiểm tra kết nối thất bại hoặc chưa kiểm tra: vẫn lưu cấu hình hợp lệ được. Model trống, key chứa xuống dòng, giá âm/NaN hoặc trùng provider/model phải bị từ chối.
4. Nhập bảng giá, hỏi gói cước và SIM: câu trả lời và nguồn vẫn hoạt động; usage khớp response mock hoặc dashboard provider. Xác nhận log usage không có nội dung tin nhắn/key.
5. Response rỗng có usage vẫn được ghi; retry có dòng riêng. Giá chưa cấu hình hiện cảnh báo thiếu chi phí, không áp đơn giá giả định.
6. Mock lỗi ghi usage: không được phát sinh lần gọi trả phí thứ hai. Kiểm tra cảnh báo `AI usage write failed`.
7. Kiểm tra up/down/up trên DB thử: dữ liệu usage và cấu hình cũ còn nguyên, ba index tồn tại. Kiểm tra job giữ dòng chưa đủ 12 tháng, xóa dòng quá hạn.

## Các quyết định đã duyệt cho bước sau

- `ai_profiles`: có `key_version`, `priority`, `is_active`; không lưu thứ tự/active profile trong settings. Chuyển cấu hình hiện tại thành profile đầu tiên.
- `ai_pending_actions`: hạn 15 phút, khóa chống trùng, xóa/che SĐT sau thực thi.
- `coverage_public` mặc định tắt; khi bật chỉ trả tổng hợp theo địa bàn, không mã trạm/tọa độ/tình trạng vận hành.
- Nội dung hội thoại lưu 90 ngày (cấu hình được), SĐT che; usage/chi phí lưu 12 tháng độc lập.
- Prompt nguyên văn và nút khôi phục thuộc bước 3. Tệp yêu cầu hiện chỉ có placeholder; chờ người dùng gửi lại prompt. Chưa thay prompt ở bước 1.
- Chưa thêm provider mới, profile, tool calling, đặt lịch trong chat hoặc RAG mới ở bước 1.

## Tài liệu đối chiếu adapter

- [Claude Messages](https://platform.claude.com/docs/en/api/messages/create)
- [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
