# XQA-61: Wireframe các màn bắt buộc (screen flow)

Tiếp nối XQT-95 (mã cũ trước khi chuyển sang Jira XQA).

Prototype FE: `apps/web/app/flow/page.tsx`. Chạy `pnpm --filter @xiangqi-arena/web dev -- --port 3001` rồi mở `/flow`.

## Màn hình và luồng

1. **Đăng nhập** (tên đăng nhập hoặc email + mật khẩu, khớp contract `docs/api/auth.md`) → vào sảnh.
2. **Sảnh** → đấu nhanh / tạo phòng → phòng chờ; luyện tập → chọn AI; lịch sử, admin và report mở từ thanh điều hướng.
3. **Phòng chờ** → xem mã phòng, người chơi, cài đặt và trạng thái sẵn sàng → bắt đầu ván.
4. **Ván cờ** → bàn cờ, đồng hồ/người chơi, vị trí cảnh báo CHIẾU (XQA-50), preview webcam cục bộ, chat, **Đầu hàng** → hộp thoại kết thúc ván (người thắng + lý do, nút Ván mới / Về sảnh), báo cáo.
5. **Chọn AI** → chọn cấp độ và thời gian → bắt đầu ván.
6. **Lịch sử** → lọc kết quả, xem lại ván.
7. **Admin** → số liệu tổng quan, báo cáo gần đây và hoạt động quản trị.
8. **Report** → điền loại vi phạm, đối tượng, mô tả → gửi và nhận mã xác nhận.

Sơ đồ đính kèm: [xqa-61-screen-flow.svg](./xqa-61-screen-flow.svg).

## Sửa trong bản review 16/10

- Đổi mã XQT-95 → XQA-61 cho khớp Jira.
- Ô đăng nhập đổi từ "Email" sang "Tên đăng nhập hoặc email", khớp contract Auth (`identifier`) và màn thật XQA-53/214.
- Bỏ "Ghi nhớ đăng nhập" và "Quên mật khẩu?". Hai chức năng này không có trong requirement, để trong wireframe dễ bị hiểu là scope đã duyệt.
- Nút "Kết thúc ván" (người chơi không tự kết thúc ván được) đổi thành **Đầu hàng** (MVP #9). Bấm vào thì mở hộp thoại kết thúc ván, có vị trí cảnh báo CHIẾU để khớp XQA-50.
- Gói lại đúng cấu trúc thư mục: `apps/web/app/flow/`, `apps/web/tests/`, `docs/project/`.

## Trạng thái nghiệm thu

- [x] AC1: Prototype có đủ 8 màn hình trong screen flow.
- [ ] AC2: Đính kèm ảnh hoặc link thiết kế vào Jira (SVG + ảnh chụp `/flow`).
- [x] DoD: Tài liệu và sơ đồ nằm trong `docs/project/`.
- [ ] DoD: 1 người review, ghi tên reviewer trong comment Jira.
- [ ] DoD: Comment Jira kèm link file.
- [ ] DoD: Tick đủ acceptance criteria.

## Phạm vi prototype

Dữ liệu là dữ liệu minh họa phía client. Đăng nhập, matchmaking, cài đặt phòng, AI, lịch sử, admin và report chưa gọi API. Màn ván cờ dùng lại Board, ChatBox và PlayerCard hiện có. Camera chỉ là preview cục bộ qua `getUserMedia`, chưa có kết nối WebRTC peer-to-peer.

**Lưu ý tông màu:** prototype dùng nền sáng emerald/stone, còn màn thật XQA-53/214 và trang chủ dùng nền tối slate/amber. Nhóm cần chốt một bộ màu trước Sprint 2 để FE không phải làm lại.

**Lưu ý build:** route `/flow` sẽ nằm trong bản build production. Trước khi deploy demo thì xóa route hoặc chặn bằng biến môi trường.
