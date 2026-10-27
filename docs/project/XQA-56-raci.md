# RACI – Xiangqi Arena (XQA-56)

> Baseline lịch, phần 3/4. 8 thành viên × 52 work package của WBS.  
> **R** lấy từ Jira (người được giao Task/Sub-task trong work package): **sự thật**. **A** = người chịu trách nhiệm Epic ghi trong mô tả Epic Jira: **sự thật**. **C / I**: **[ĐỀ XUẤT]**, PM duyệt.

## 1. Thành viên

| Người | Vai trò | Số việc trên Jira | Đã xong 26/10 |
|---|---|---:|---:|
| Thịnh | PM + BE (History, Admin/Report, AI) | 23 | 5 |
| Phát | BA + Game Core | 24 | 6 |
| Kiệt | BE Platform + DevOps | 22 | 7 |
| Khiêm | FE (bàn cờ, realtime client) | 21 | 4 |
| Nhân | UX + FE + WebRTC client | 22 | 7 |
| Quang | QA kỹ thuật (automation, CI) | 21 | 4 |
| Thiện | QA lead (Test Plan, RTM, nghiệm thu) | 21 | 2 |
| Thuận | Tài liệu, biên bản, test case | 21 | 1 |

## 2. Ma trận

Quy tắc C/I đề xuất: BA (Phát) là C ở work package sản phẩm mà mình không làm (yêu cầu, AC); QA lead (Thiện) là C ở work package sản phẩm (cách test); PM (Thịnh) ít nhất là I ở mọi dòng. Không dòng nào có 2 chữ A.

| WBS | Work package | Thịnh | Phát | Kiệt | Khiêm | Nhân | Quang | Thiện | Thuận |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1.1 | Khởi động & baseline (Charter, Scope, Change Log, WBS, lịc… | A/R |  |  |  |  |  |  | R |
| 1.2 | Họp & biên bản sprint (planning/review) | A |  |  |  |  |  |  | R |
| 1.3 | Giám sát, sprint review & release | A/R |  |  |  |  |  |  |  |
| 1.4 | Đóng dự án (lessons learned, closure, nộp bài) | A/R |  |  |  |  |  |  |  |
| 2.1 | Đặc tả yêu cầu (SRS, AC, gap list) | I | A/R |  |  |  |  |  |  |
| 2.2 | Thiết kế kỹ thuật & khởi tạo mã nguồn | I | A/R | R |  |  |  |  |  |
| 2.3 | Thiết kế UI/UX & usability | I | A |  |  | R |  |  |  |
| 3.1.1 | Đăng ký và đăng nhập tài khoản | I | C | A/R |  | R |  | C | R |
| 3.1.2 | Đăng xuất và giữ phiên đăng nhập | I | C | A/R |  | R | R | C |  |
| 3.1.3 | Task thiết kế / sửa lỗi cấp Epic | I | C | A/R |  | R |  | C |  |
| 3.2.1 | Bàn cờ chuẩn với 32 quân đúng vị trí ban đầu | I | A/R |  | R |  |  | C |  |
| 3.2.2 | Chỉ đi được nước hợp lệ theo luật từng quân | R | A/R |  | R |  | R | C |  |
| 3.2.3 | Chơi trọn một ván 2 người trên 1 máy | I | A/R |  | R | R |  | C |  |
| 3.2.4 | Task thiết kế / sửa lỗi cấp Epic | I | A/R |  |  |  |  | C |  |
| 3.3.1 | Tạo phòng và vào phòng chơi | I | C | A/R | R | R |  | C | R |
| 3.3.2 | Đi quân online đồng bộ realtime, server quyết định | I | R | A/R | R |  | R | C |  |
| 3.3.3 | Kết thúc ván: xin hòa, xin thua và lưu kết quả | I | R | A/R | R |  |  | C |  |
| 3.3.4 | Vào lại ván sau khi mất kết nối | I | C | A/R | R |  |  | C |  |
| 3.3.5 | Đồng hồ thi đấu | I | C | A/R | R |  |  | C | R |
| 3.3.6 | Dùng được trên các trình duyệt và độ phân giải chuẩn | I | C | A | R |  | R | C |  |
| 3.3.7 | Task thiết kế / sửa lỗi cấp Epic | I | C | A/R | R |  |  | C |  |
| 3.4.1 | Phát hiện lặp nước (phần 1) | I | A/R |  |  |  |  | R |  |
| 3.4.2 | Xử lý lặp nước – chiếu dai – bắt dai đủ 10 điểm Điều 23 | I | A/R |  |  |  | R | C |  |
| 3.4.3 | Thông báo vi phạm Điều 23 trên giao diện | I | A/R |  | R |  |  | C |  |
| 3.5.1 | Máy chọn được nước đi hợp lệ và có lý | A/R | C |  |  |  |  | C |  |
| 3.5.2 | Chọn 3 mức độ khó khi chơi với máy | A/R | C |  |  | R |  | C |  |
| 3.5.3 | Máy suy nghĩ không làm đơ giao diện | A | R |  | R |  |  | C |  |
| 3.5.4 | Chơi trọn một ván với máy | A/R | C |  | R |  | R | C |  |
| 3.6.1 | Nhắn tin với đối thủ trong ván | I | A/R |  | R |  | R | R |  |
| 3.6.2 | Task thiết kế / sửa lỗi cấp Epic | I | A |  |  | R |  | C |  |
| 3.7.1 | Gọi video với đối thủ trong ván | I | C | A/R |  | R |  | C |  |
| 3.7.2 | Video call ổn định và dễ dùng | I | C | A |  | R | R | R |  |
| 3.7.3 | Task thiết kế / sửa lỗi cấp Epic | I | C | A |  | R |  | C |  |
| 3.8.1 | Xem lịch sử các ván đã chơi | A/R | C |  | R |  |  | C | R |
| 3.8.2 | Xem lại ván (replay) | A | C |  | R |  |  | C | R |
| 3.8.3 | Rating Elo và bảng xếp hạng | A/R | R |  | R |  |  | C | R |
| 3.9.1 | Báo cáo người chơi vi phạm | A/R | C |  |  | R |  | C |  |
| 3.9.2 | Admin quản lý người dùng | A/R | C |  |  | R | R | C |  |
| 3.9.3 | Admin xem ván, xử lý report và xem dashboard | A | C | R |  | R |  | R |  |
| 3.9.4 | Task thiết kế / sửa lỗi cấp Epic | A/R | C |  |  |  |  | C |  |
| 4.1 | Kế hoạch kiểm thử & truy vết (Test Plan, RTM) | I |  |  |  |  |  | A/R |  |
| 4.2 | Thiết kế test case | I |  |  |  |  |  | A/R | R |
| 4.3 | Kiểm thử tự động & phi chức năng | I |  |  |  |  | R | A |  |
| 4.4 | Thực thi & nghiệm thu release | I |  |  |  |  |  | A/R |  |
| 4.5 | UAT & báo cáo kiểm thử | I |  |  |  |  | R | A/R |  |
| 5.1 | Hạ tầng phát triển & CI | R |  | A/R |  |  | R |  |  |
| 5.2 | Môi trường staging | I |  | A |  |  | R |  |  |
| 5.3 | Production & vận hành | I |  | A/R |  |  | R |  |  |
| 6.1 | User Guide | A | R |  |  |  |  | C | R |
| 6.2 | Tài liệu kỹ thuật | A | R | R |  |  |  | C |  |
| 6.3 | Báo cáo cuối kỳ | A/R | R | R | R | R | R | R | R |
| 6.4 | Slide & video demo | A |  |  | R | R |  | C |  |

## 3. Nhận xét

- Mỗi dòng có đúng 1 A (Accountable = chủ Epic trên Jira).
- A không trực tiếp làm (A ≠ R) ở 5 work package sản phẩm: 3.3.6 (XQA-41, A=Kiệt), 3.5.3 (XQA-34, A=Thịnh), 3.7.2 (XQA-39, A=Kiệt), 3.8.2 (XQA-33, A=Thịnh), 3.9.3 (XQA-35, A=Thịnh). Bình thường với vai trò chủ Epic, nhưng chủ Epic phải duyệt AC của Story đó trước khi QA nghiệm thu.
- Thịnh là A ở 5/14 Epic (XQA-1, 7, 10, 11, 14) và đồng thời là PM: tập trung trách nhiệm cao. Xem RSK-22.
- Thuận là R ở 21 việc (biên bản, test case, User Guide), mới xong 1 trên Jira. Xem RSK-21.
