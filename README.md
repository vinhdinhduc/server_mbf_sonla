# Backend - Website MobiFone Chi nhánh Sơn La

Backend REST API (API-first) phục vụ Website (Next.js) và tương lai Zalo Mini App.
Kiến trúc Controller – Service, TypeScript + Express + Sequelize (MySQL).

## 1. Yêu cầu môi trường

- Node.js >= 18
- MySQL >= 8.0 (local / XAMPP / Docker)
- `mysqldump` có sẵn trong PATH (dùng cho script backup)

## 2. Cài đặt dependency

```bash
cd server
npm install
```

## 3. Cấu hình biến môi trường

Sao chép file mẫu và điền giá trị thật:

```bash
cp .env.example .env
```

Điền đầy đủ các biến bắt buộc trong `.env` (xem chi tiết trong `.env.example`):
`DB_*`, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `RECAPTCHA_*`, `SMTP_*`, `ANTHROPIC_API_KEY`, v.v.
Server sẽ **fail-fast** (không khởi động) nếu thiếu biến bắt buộc — xem `src/config/env.ts`.

Tạo database rỗng trước:

```sql
CREATE DATABASE mobifone_sonla CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 4. Chạy migration (tạo 16 bảng)

```bash
npm run migrate
```

Để rollback (nếu cần):

```bash
npm run migrate:undo
```

## 5. Seed dữ liệu khởi tạo

```bash
npm run seed
```

Seed sẽ tạo:
- 1 tài khoản `admin` mặc định (username/password đọc từ `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` trong `.env`)
- 3 `slider_zones` mặc định: `hero_banner`, `partners`, `testimonials`
- Một số `settings` mặc định (site_name, hotline, ai_daily_limit, ai_system_prompt...)

## 6. Chạy server (development)

```bash
npm run dev
```

Server chạy tại `http://localhost:4000` (hoặc `PORT` đã cấu hình). Kiểm tra nhanh: `GET /health`.

## 7. Build & chạy production

```bash
npm run build
npm start
```

## 8. Chạy test

```bash
npm test
```

Test dùng Jest + ts-jest, mock toàn bộ Sequelize Model — **không cần kết nối MySQL thật**.
Các test bắt buộc đã có sẵn:
- `tests/unit/shift.service.test.ts` — logic chống trùng ca trực (overlap): trùng hoàn toàn, trùng một phần, không trùng.
- `tests/unit/registration.service.test.ts` — `submitCart()` tạo đúng 1 `registration_groups` + n `registration_items` trong 1 transaction, và rollback khi lỗi giữa chừng.
- `tests/unit/auditLog.service.test.ts` — xác nhận `auditLogService` không có method update/delete.

## 9. Lint & format

```bash
npm run lint
```

ESLint (Airbnb base) + Prettier (2 spaces, single quote, có dấu `;`) dùng chung `.eslintrc.js` / `.prettierrc` ở root.
Husky pre-commit hook tự động chạy `lint-staged` (đã cấu hình trong `package.json`).

Kích hoạt Husky lần đầu sau khi `npm install`:

```bash
npx husky init
```

## 10. Backup database

Chạy thủ công bất cứ lúc nào:

```bash
npm run backup
```

Khi server đang chạy (`npm run dev` / `npm start`), backup cũng tự động chạy theo lịch **mỗi Chủ nhật lúc 23:00** (giờ Việt Nam) thông qua `node-cron` (xem `src/scripts/backupCron.ts`).
File backup nén `.sql.gz` được lưu tại `server/backups/`, tự động xoá các bản backup cũ hơn 8 tuần (56 ngày).

## 11. Cấu trúc thư mục

Xem chi tiết trong tài liệu thiết kế gốc (mục 15). Tóm tắt:

```
server/src/
├── models/        # Sequelize model (16 bảng) + associations (index.ts)
├── controllers/    # Đọc req, gọi Service, format response chuẩn
├── services/       # Toàn bộ logic nghiệp vụ, gọi thẳng Sequelize Model
├── routes/         # public.routes.ts / admin.routes.ts / auth.routes.ts
├── middlewares/     # auth, checkRole, auditLogger, errorHandler
├── validators/      # zod schema validate request
├── types/dto/        # Type re-export từ validators
├── utils/           # AppError, apiResponse, buildImageUrl, recaptcha, ...
├── config/          # env, database, notifier, multer
├── scripts/         # backup.ts, backupCron.ts
└── app.ts           # Khởi tạo Express, gắn routes, middlewares
```

## 12. Ghi chú quan trọng về bảo mật

- Toàn bộ route `/api/admin/*` bắt buộc qua `authMiddleware` + `checkRole` — không dựa vào ẩn/hiện UI frontend.
- Mật khẩu người dùng luôn hash bằng bcrypt (salt rounds = 10), không bao giờ trả `password_hash` trong response.
- Các khoá bí mật (`ANTHROPIC_API_KEY`, `RECAPTCHA_SECRET_KEY`, `SMTP_USER`, `SMTP_PASS`, `JWT_SECRET`...) **không bao giờ** được lưu trong bảng `settings` — chỉ trong `.env`, và `PUT /api/admin/settings` chủ động chặn các khoá này.
- Bảng `audit_logs` là **read-only tuyệt đối** — không có endpoint UPDATE/DELETE, kể cả cho admin.

## 13. Giới hạn của giai đoạn 1 (MVP)

Theo đúng thiết kế, các phần sau **CHƯA** được triển khai thật ở giai đoạn này:
- `ZnsNotifier` — chỉ tạo khung (implements `INotifier`), ném lỗi rõ ràng nếu bị gọi.
- Dashboard KPI/BTS/DWH nội bộ thật, kết nối Oracle DWH thật.
- Cổng thanh toán online thật, ứng dụng mobile.
