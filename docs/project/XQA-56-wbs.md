# WBS – Xiangqi Arena (XQA-56)

> Baseline lịch, phần 1/4. Sinh từ Jira XQA ngày 26/10/2026 (216 issue: 14 Epic, 27 Story, 175 Task/Sub-task). Kiểm tra tự động: **175/175 Task/Sub-task map về đúng 1 work package**, không sót, không trùng.  
> AC1 của XQA-56: mọi work package map được về Epic/Story Jira → cột "Jira" ở bảng dưới.

## 1. Cây WBS (cấp 1–3)

```
0  Xiangqi Arena – nền tảng Cờ Tướng trực tuyến (10/10 → 27/11/2026)
├─ 1  Quản lý dự án  [XQA-1]
│   ├─ 1.1  Khởi động & baseline (Charter, Scope, Change Log, WBS, lịch, RACI, Risk, Communication Plan)
│   ├─ 1.2  Họp & biên bản sprint (planning/review)
│   ├─ 1.3  Giám sát, sprint review & release
│   ├─ 1.4  Đóng dự án (lessons learned, closure, nộp bài)
├─ 2  Phân tích yêu cầu & thiết kế  [XQA-2]
│   ├─ 2.1  Đặc tả yêu cầu (SRS, AC, gap list)
│   ├─ 2.2  Thiết kế kỹ thuật & khởi tạo mã nguồn
│   ├─ 2.3  Thiết kế UI/UX & usability
├─ 3  Phát triển sản phẩm
│   ├─ 3.1  Tài khoản người chơi  [XQA-3]
│   │   ├─ 3.1.1  Đăng ký và đăng nhập tài khoản  [XQA-18]
│   │   ├─ 3.1.2  Đăng xuất và giữ phiên đăng nhập  [XQA-19]
│   │   ├─ 3.1.3  Task thiết kế / sửa lỗi cấp Epic
│   ├─ 3.2  Bàn cờ & luật đi quân  [XQA-4]
│   │   ├─ 3.2.1  Bàn cờ chuẩn với 32 quân đúng vị trí ban đầu  [XQA-15]
│   │   ├─ 3.2.2  Chỉ đi được nước hợp lệ theo luật từng quân  [XQA-16]
│   │   ├─ 3.2.3  Chơi trọn một ván 2 người trên 1 máy  [XQA-17]
│   │   ├─ 3.2.4  Task thiết kế / sửa lỗi cấp Epic
│   ├─ 3.3  Phòng chơi & trận đấu trực tuyến  [XQA-5]
│   │   ├─ 3.3.1  Tạo phòng và vào phòng chơi  [XQA-20]
│   │   ├─ 3.3.2  Đi quân online đồng bộ realtime, server quyết định  [XQA-21]
│   │   ├─ 3.3.3  Kết thúc ván: xin hòa, xin thua và lưu kết quả  [XQA-24]
│   │   ├─ 3.3.4  Vào lại ván sau khi mất kết nối  [XQA-25]
│   │   ├─ 3.3.5  Đồng hồ thi đấu  [XQA-36]
│   │   ├─ 3.3.6  Dùng được trên các trình duyệt và độ phân giải chuẩn  [XQA-41]
│   │   ├─ 3.3.7  Task thiết kế / sửa lỗi cấp Epic
│   ├─ 3.4  Luật lặp nước – chiếu dai – bắt dai (Điều 23)  [XQA-6]
│   │   ├─ 3.4.1  Phát hiện lặp nước (phần 1)  [XQA-22]
│   │   ├─ 3.4.2  Xử lý lặp nước – chiếu dai – bắt dai đủ 10 điểm Điều 23  [XQA-26]
│   │   ├─ 3.4.3  Thông báo vi phạm Điều 23 trên giao diện  [XQA-38]
│   ├─ 3.5  Chơi với máy (AI 3 mức)  [XQA-7]
│   │   ├─ 3.5.1  Máy chọn được nước đi hợp lệ và có lý  [XQA-23]
│   │   ├─ 3.5.2  Chọn 3 mức độ khó khi chơi với máy  [XQA-28]
│   │   ├─ 3.5.3  Máy suy nghĩ không làm đơ giao diện  [XQA-34]
│   │   ├─ 3.5.4  Chơi trọn một ván với máy  [XQA-37]
│   ├─ 3.6  Chat trong trận  [XQA-8]
│   │   ├─ 3.6.1  Nhắn tin với đối thủ trong ván  [XQA-29]
│   │   ├─ 3.6.2  Task thiết kế / sửa lỗi cấp Epic
│   ├─ 3.7  Video call trong trận  [XQA-9]
│   │   ├─ 3.7.1  Gọi video với đối thủ trong ván  [XQA-32]
│   │   ├─ 3.7.2  Video call ổn định và dễ dùng  [XQA-39]
│   │   ├─ 3.7.3  Task thiết kế / sửa lỗi cấp Epic
│   ├─ 3.8  Lịch sử, replay & xếp hạng  [XQA-10]
│   │   ├─ 3.8.1  Xem lịch sử các ván đã chơi  [XQA-27]
│   │   ├─ 3.8.2  Xem lại ván (replay)  [XQA-33]
│   │   ├─ 3.8.3  Rating Elo và bảng xếp hạng  [XQA-40]
│   ├─ 3.9  Quản trị & báo cáo vi phạm  [XQA-11]
│   │   ├─ 3.9.1  Báo cáo người chơi vi phạm  [XQA-30]
│   │   ├─ 3.9.2  Admin quản lý người dùng  [XQA-31]
│   │   ├─ 3.9.3  Admin xem ván, xử lý report và xem dashboard  [XQA-35]
│   │   ├─ 3.9.4  Task thiết kế / sửa lỗi cấp Epic
├─ 4  Kiểm thử & nghiệm thu  [XQA-12]
│   ├─ 4.1  Kế hoạch kiểm thử & truy vết (Test Plan, RTM)
│   ├─ 4.2  Thiết kế test case
│   ├─ 4.3  Kiểm thử tự động & phi chức năng
│   ├─ 4.4  Thực thi & nghiệm thu release
│   ├─ 4.5  UAT & báo cáo kiểm thử
├─ 5  Triển khai & vận hành  [XQA-13]
│   ├─ 5.1  Hạ tầng phát triển & CI
│   ├─ 5.2  Môi trường staging
│   ├─ 5.3  Production & vận hành
├─ 6  Tài liệu bàn giao, báo cáo & bảo vệ  [XQA-14]
│   ├─ 6.1  User Guide
│   ├─ 6.2  Tài liệu kỹ thuật
│   ├─ 6.3  Báo cáo cuối kỳ
│   ├─ 6.4  Slide & video demo
```

Quy ước: cấp 2 của nhánh 3 là Epic, cấp 3 là Story (work package hướng người dùng). Nhánh 1, 2, 4, 5, 6 là Epic chỉ có Task nên cấp 2 gom Task cùng loại thành work package.

## 2. Từ điển WBS (WBS Dictionary)

Ước lượng theo quy tắc của plan: 1 Task/Sub-task ≈ 4h. Sprint lấy theo label `sprint-N` (kế hoạch baseline), không theo sprint Jira hiện tại.

| WBS | Work package | Jira (Epic / Story) | Task / Sub-task | Người làm (R) | Sprint | Ước lượng | Trạng thái 26/10 |
|---|---|---|---|---|---|---:|---|
| 1.1 | Khởi động & baseline (Charter, Scope, Change Log, WBS, lịch, RACI, Risk, Communication Plan) | XQA-1 | 55, 56, 57, 212 | Thịnh, Thuận | S1 | 16h | Đang làm (2/4) |
| 1.2 | Họp & biên bản sprint (planning/review) | XQA-1 | 58, 83, 103, 133, 154, 184, 207 | Thuận | S1–S7 | 28h | Chưa bắt đầu (0/7) |
| 1.3 | Giám sát, sprint review & release | XQA-1 | 82, 102, 132, 153 | Thịnh | S2–S5 | 16h | Đang làm (0/4) |
| 1.4 | Đóng dự án (lessons learned, closure, nộp bài) | XQA-1 | 190, 191 | Thịnh | S7 | 8h | Chưa bắt đầu (0/2) |
| 2.1 | Đặc tả yêu cầu (SRS, AC, gap list) | XQA-2 | 84, 104, 156 | Phát | S2–S5 | 12h | Chưa bắt đầu (0/3) |
| 2.2 | Thiết kế kỹ thuật & khởi tạo mã nguồn | XQA-2 | 59, 60, 211, 215 | Kiệt, Phát | S1 | 16h | Xong (4/4) |
| 2.3 | Thiết kế UI/UX & usability | XQA-2 | 61, 85, 158, 176 | Nhân | S1–S6 | 16h | Đang làm (2/4) |
| 3.1.1 | Đăng ký và đăng nhập tài khoản | XQA-3 / XQA-18 | 52, 53, 54, 214 | Nhân, Kiệt, Thuận | S1 | 16h | Đang làm (3/4) |
| 3.1.2 | Đăng xuất và giữ phiên đăng nhập | XQA-3 / XQA-19 | 66, 67, 68 | Kiệt, Nhân, Quang | S2 | 12h | Xong (3/3) |
| 3.1.3 | Task thiết kế / sửa lỗi cấp Epic | XQA-3 | 177, 199, 213 | Nhân, Kiệt | S1–S7 | 12h | Đang làm (1/3) |
| 3.2.1 | Bàn cờ chuẩn với 32 quân đúng vị trí ban đầu | XQA-4 / XQA-15 | 42, 43 | Phát, Khiêm | S1 | 8h | Xong (2/2) |
| 3.2.2 | Chỉ đi được nước hợp lệ theo luật từng quân | XQA-4 / XQA-16 | 44, 45, 46, 47, 48 | Quang, Phát, Thịnh, Khiêm | S1 | 20h | Xong (5/5) |
| 3.2.3 | Chơi trọn một ván 2 người trên 1 máy | XQA-4 / XQA-17 | 49, 50, 51 | Phát, Nhân, Khiêm | S1 | 12h | Xong (3/3) |
| 3.2.4 | Task thiết kế / sửa lỗi cấp Epic | XQA-4 | 155, 168, 187, 216 | Phát | S1–S7 | 16h | Chưa bắt đầu (0/4) |
| 3.3.1 | Tạo phòng và vào phòng chơi | XQA-5 / XQA-20 | 69, 70, 71, 72, 73 | Khiêm, Kiệt, Nhân, Thuận | S2 | 20h | Đang làm (3/5) |
| 3.3.2 | Đi quân online đồng bộ realtime, server quyết định | XQA-5 / XQA-21 | 74, 75, 76, 77 | Phát, Kiệt, Khiêm, Quang | S2 | 16h | Đang làm (1/4) |
| 3.3.3 | Kết thúc ván: xin hòa, xin thua và lưu kết quả | XQA-5 / XQA-24 | 90, 91, 92 | Phát, Kiệt, Khiêm | S3 | 12h | Chưa bắt đầu (0/3) |
| 3.3.4 | Vào lại ván sau khi mất kết nối | XQA-5 / XQA-25 | 93, 94 | Kiệt, Khiêm | S3 | 8h | Chưa bắt đầu (0/2) |
| 3.3.5 | Đồng hồ thi đấu | XQA-5 / XQA-36 | 141, 142, 143 | Kiệt, Khiêm, Thuận | S5 | 12h | Chưa bắt đầu (0/3) |
| 3.3.6 | Dùng được trên các trình duyệt và độ phân giải chuẩn | XQA-5 / XQA-41 | 166, 167 | Khiêm, Quang | S6 | 8h | Chưa bắt đầu (0/2) |
| 3.3.7 | Task thiết kế / sửa lỗi cấp Epic | XQA-5 | 174, 175, 196 | Khiêm, Kiệt | S6–S7 | 12h | Chưa bắt đầu (0/3) |
| 3.4.1 | Phát hiện lặp nước (phần 1) | XQA-6 / XQA-22 | 78, 79 | Phát, Thiện | S2 | 8h | Đang làm (1/2) |
| 3.4.2 | Xử lý lặp nước – chiếu dai – bắt dai đủ 10 điểm Điều 23 | XQA-6 / XQA-26 | 95, 96 | Phát, Quang | S3 | 8h | Chưa bắt đầu (0/2) |
| 3.4.3 | Thông báo vi phạm Điều 23 trên giao diện | XQA-6 / XQA-38 | 148, 149 | Phát, Khiêm | S5 | 8h | Chưa bắt đầu (0/2) |
| 3.5.1 | Máy chọn được nước đi hợp lệ và có lý | XQA-7 / XQA-23 | 80, 81 | Thịnh | S2 | 8h | Xong (2/2) |
| 3.5.2 | Chọn 3 mức độ khó khi chơi với máy | XQA-7 / XQA-28 | 100, 101 | Thịnh, Nhân | S3 | 8h | Chưa bắt đầu (0/2) |
| 3.5.3 | Máy suy nghĩ không làm đơ giao diện | XQA-7 / XQA-34 | 130, 131 | Khiêm, Phát | S4 | 8h | Chưa bắt đầu (0/2) |
| 3.5.4 | Chơi trọn một ván với máy | XQA-7 / XQA-37 | 144, 145, 146, 147 | Thịnh, Khiêm, Quang | S5 | 16h | Chưa bắt đầu (0/4) |
| 3.6.1 | Nhắn tin với đối thủ trong ván | XQA-8 / XQA-29 | 114, 115, 116, 117, 118 | Phát, Khiêm, Quang, Thiện | S4 | 20h | Chưa bắt đầu (0/5) |
| 3.6.2 | Task thiết kế / sửa lỗi cấp Epic | XQA-8 | 106 | Nhân | S3 | 4h | Chưa bắt đầu (0/1) |
| 3.7.1 | Gọi video với đối thủ trong ván | XQA-9 / XQA-32 | 124, 125, 126, 127 | Kiệt, Nhân | S4 | 16h | Chưa bắt đầu (0/4) |
| 3.7.2 | Video call ổn định và dễ dùng | XQA-9 / XQA-39 | 150, 151, 152 | Nhân, Quang, Thiện | S5 | 12h | Chưa bắt đầu (0/3) |
| 3.7.3 | Task thiết kế / sửa lỗi cấp Epic | XQA-9 | 107 | Nhân | S3 | 4h | Chưa bắt đầu (0/1) |
| 3.8.1 | Xem lịch sử các ván đã chơi | XQA-10 / XQA-27 | 97, 98, 99 | Thịnh, Khiêm, Thuận | S3 | 12h | Đang làm (0/3) |
| 3.8.2 | Xem lại ván (replay) | XQA-10 / XQA-33 | 128, 129 | Khiêm, Thuận | S4 | 8h | Chưa bắt đầu (0/2) |
| 3.8.3 | Rating Elo và bảng xếp hạng | XQA-10 / XQA-40 | 162, 163, 164, 165 | Phát, Thịnh, Khiêm, Thuận | S6 | 16h | Chưa bắt đầu (0/4) |
| 3.9.1 | Báo cáo người chơi vi phạm | XQA-11 / XQA-30 | 119, 120 | Thịnh, Nhân | S4 | 8h | Chưa bắt đầu (0/2) |
| 3.9.2 | Admin quản lý người dùng | XQA-11 / XQA-31 | 121, 122, 123 | Thịnh, Nhân, Quang | S4 | 12h | Chưa bắt đầu (0/3) |
| 3.9.3 | Admin xem ván, xử lý report và xem dashboard | XQA-11 / XQA-35 | 138, 139, 140 | Kiệt, Nhân, Thiện | S5 | 12h | Chưa bắt đầu (0/3) |
| 3.9.4 | Task thiết kế / sửa lỗi cấp Epic | XQA-11 | 170 | Thịnh | S6 | 4h | Chưa bắt đầu (0/1) |
| 4.1 | Kế hoạch kiểm thử & truy vết (Test Plan, RTM) | XQA-12 | 62, 63, 88, 183 | Thiện | S1–S6 | 16h | Đang làm (1/4) |
| 4.2 | Thiết kế test case | XQA-12 | 87, 112, 113, 136, 137 | Thiện, Thuận | S2–S4 | 20h | Đang làm (1/5) |
| 4.3 | Kiểm thử tự động & phi chức năng | XQA-12 | 86, 108, 135, 159, 180, 203 | Quang | S2–S7 | 24h | Đang làm (0/6) |
| 4.4 | Thực thi & nghiệm thu release | XQA-12 | 64, 110, 111, 160, 182 | Thiện | S1–S6 | 20h | Đang làm (0/5) |
| 4.5 | UAT & báo cáo kiểm thử | XQA-12 | 181, 201, 204, 205 | Thiện, Quang | S6–S7 | 16h | Chưa bắt đầu (0/4) |
| 5.1 | Hạ tầng phát triển & CI | XQA-13 | 210, 65, 105 | Thịnh, Quang, Kiệt | S1–S3 | 12h | Đang làm (2/3) |
| 5.2 | Môi trường staging | XQA-13 | 109 | Quang | S3 | 4h | Chưa bắt đầu (0/1) |
| 5.3 | Production & vận hành | XQA-13 | 157, 172, 173, 179, 193 | Kiệt, Quang | S5–S7 | 20h | Chưa bắt đầu (0/5) |
| 6.1 | User Guide | XQA-14 | 89, 134, 161, 169, 185, 208 | Thuận, Phát | S2–S7 | 24h | Chưa bắt đầu (0/6) |
| 6.2 | Tài liệu kỹ thuật | XQA-14 | 188, 192 | Phát, Kiệt | S7 | 8h | Chưa bắt đầu (0/2) |
| 6.3 | Báo cáo cuối kỳ | XQA-14 | 171, 186, 189, 194, 195, 198, 202, 206, 209 | Thịnh, Phát, Kiệt, Khiêm, Nhân, Quang, Thiện, Thuận | S6–S7 | 36h | Chưa bắt đầu (0/9) |
| 6.4 | Slide & video demo | XQA-14 | 178, 197, 200 | Nhân, Khiêm | S6–S7 | 12h | Chưa bắt đầu (0/3) |

**Tổng:** 52 work package · 175 Task/Sub-task · ước lượng 700h · đã xong 36/175 (21%) theo trạng thái Jira 26/10.

## 3. Ghi chú

- Trạng thái lấy nguyên từ Jira. Jira đang chậm hơn repo: XQA-74 (PR #24) và XQA-71 (PR #19) đã merge vào develop nhưng Jira vẫn In Progress. Xem Issue log ở `XQA-82-sprint1-review.md`.
- Should-have (XQA-33 replay, XQA-36 đồng hồ, XQA-40 Elo/leaderboard) có label `should-have`, cắt được ở review S5 nếu trễ. Matchmaking: Out of Scope (plan 11/10).
- XQA-210, 211, 212 là việc chuyển từ Jira cũ XQT, không có sprint.
