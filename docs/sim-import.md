# Nhập cước cam kết SIM

- Tải file mẫu mới trong Quản lý Kho sim số. Giữ số điện thoại ở định dạng Text để không mất số 0 đầu.
- Với SIM trả sau (`postpaid`), tách dữ liệu cũ `150.000 24 tháng` thành `committed_monthly_fee = 150000` và `commitment_months = 24`. Nhập số thuần, không kèm dấu phân cách hàng nghìn hoặc đơn vị.
- `committed_monthly_fee` là mức cước gói tối thiểu hàng tháng, đơn vị đồng. `commitment_months` là số tháng duy trì (0–36 theo giới hạn hiện có).
- Để trống hai cột nếu không yêu cầu cam kết. SIM trả trước (`prepaid`) không lưu mức cước cam kết hàng tháng.
- Phí hòa mạng là phí một lần, tiếp tục lấy theo cấu hình hình thức thuê bao; không nhập phí này vào cột cước cam kết.
- Mẫu mới bỏ cột `price_deprecated`. File cũ có `price`/`price_deprecated` vẫn được đọc vào field giá cũ, không tự suy diễn thành cước cam kết. Khi chuẩn hóa, chỉ chuyển dữ liệu sang cột mới sau khi xác định đúng ý nghĩa.
- Import đọc theo tên cột. Xem trước và sửa các dòng lỗi trước khi xác nhận. Chế độ cập nhật từ mẫu mới giữ nguyên giá cũ trong DB.

## Triển khai

Chạy `npm run migrate` ở backend trước khi triển khai code sử dụng field mới. Migration `20260927000003-add-sim-committed-monthly-fee.js` chỉ thêm cột nullable vào `sim_numbers`, không đổi field hiện có hoặc suy diễn dữ liệu cũ.
