# Lịch 7 sprint & Gantt – Xiangqi Arena (XQA-56)

> Baseline lịch, phần 2/4. Nguồn: plan Jira XQA (11/10/2026) + trạng thái Jira/GitHub ngày 26/10/2026. Gantt sinh tự động từ WBS (`XQA-56-wbs.md`): mỗi thanh là 1 work package, độ dài = các sprint chứa Task/Sub-task của nó theo label `sprint-N`.

## 1. Lịch sprint và release

| Sprint | Ngày | Mục tiêu | Release | Số việc (baseline) | Trạng thái 26/10 |
|---|---|---|---|---:|---|
| S1 | 10/10–16/10 | Release 1.0 Core: bàn cờ + luật đi quân + chiếu/chiếu bí, chơi 2 người 1 máy, đăng ký/đăng nhập, CI; baseline phạm vi & lịch | 1.0 (16/10) | 28 | Đóng 23/10 (trễ 7 ngày so với 16/10). 22/28 việc xong |
| S2 | 17/10–23/10 | Chơi online end-to-end (server quyết định nước đi): phòng, sảnh, đi quân realtime; bắt đầu Điều 23 và AI | – | 24 | Không còn container riêng: việc chưa xong dồn sang S3. 12/24 việc xong |
| S3 | 24/10–30/10 | Release 1.1: kết thúc ván/hòa/thua, reconnect, Điều 23 đủ 10 điểm, lịch sử, AI 3 mức, staging | 1.1 (30/10) | 24 | Đang chạy (ngày 3/7) |
| S4 | 31/10–06/11 | Chat, Report, Admin users, Video call (signaling + client), replay, AI chạy Web Worker | – | 24 | Chưa bắt đầu |
| S5 | 07/11–13/11 | Release 1.2/1.3/1.4: Admin đầy đủ, video ổn định, chơi trọn ván với máy, đồng hồ (should) | 1.2 / 1.3 / 1.4 (13/11) | 24 | Chưa bắt đầu |
| S6 | 14/11–20/11 | Should-have (Elo, leaderboard), responsive, deploy production, regression RC, chuẩn bị UAT | – | 24 | Chưa bắt đầu |
| S7 | 21/11–27/11 | Release 1.5: UAT, code freeze 25/11, fix bug, báo cáo, slide, demo, đóng dự án | 1.5 (27/11) | 24 | Chưa bắt đầu |

Nhịp trong sprint: việc 1 hạn ngày thứ 3, việc 2 hạn ngày thứ 5, việc 3 hạn ngày cuối. Planning thứ 7, review thứ 6.

## 2. Milestone

| Mốc | Ngày | Điều kiện đạt | Trạng thái 26/10 |
|---|---|---|---|
| M1 – Release 1.0 Core | 16/10 | Bàn cờ + luật đi + chiếu/chiếu bí chơi 1 máy, đăng ký/đăng nhập, CI | Code xong 17/10 (PR #12, #13, #14). FE auth merge 24/10 (PR #23). CI xanh trên develop từ 21/10. Biên bản nghiệm thu XQA-64 "đạt có điều kiện" (21/10), hai điều kiện nay đã đạt → **chờ PM ký** |
| M2 – Release 1.1 + staging | 30/10 | Chơi online trọn ván (kết thúc, hòa/thua, reconnect), Điều 23 đủ 10 điểm, lịch sử, AI 3 mức, staging | Có rủi ro trượt: xem RSK-24, RSK-25 |
| M3 – Release 1.2/1.3/1.4 | 13/11 | Chat, Report, Admin, Video call, chơi trọn ván với máy | Chưa bắt đầu |
| M4 – Production | 20/11 | Deploy production, backup, Deployment doc | Chưa bắt đầu |
| M5 – Code freeze | 25/11 | Chỉ sửa bug UAT | – |
| M6 – Release 1.5 + nộp bài | 27/11 | UAT ≥5 người, báo cáo, slide, demo, closure | – |

## 3. Đường găng (critical path)

Theo plan 11/10: Board/FEN (XQA-42) → MoveGen (XQA-44, 45) → Chiếu/chiếu bí (XQA-49) → GameService (XQA-74) → Socket game events (XQA-75) → Đi quân online (XQA-76) → Kết thúc ván (XQA-90, 91, 92) → Reconnect (XQA-93, 94) → Nghiệm thu 1.1 (XQA-111, 30/10).

| Đoạn găng | Trạng thái thực tế 26/10 (repo) |
|---|---|
| XQA-42 → 44/45 → 49 | Merge 13–17/10 |
| XQA-74 GameService | Merge 24/10 (PR #24). Jira vẫn ghi In Progress |
| XQA-75 Socket game events | Merge 24/10 (PR #25) |
| XQA-76 Đi quân online | PR #26 đang mở, chờ test/merge |
| XQA-90/91/92 Kết thúc ván | Chưa bắt đầu, hạn 28/10 |
| XQA-93/94 Reconnect | Chưa bắt đầu, hạn 30/10 |

Trễ tích lũy trên đường găng: đoạn XQA-74 → 75 xong 24/10 thay vì 19–23/10 (trễ 1–5 ngày). Dự trữ còn lại tới 30/10 gần như bằng 0: XQA-90/91/92 phải xong 28/10 thì XQA-93/94 mới kịp 30/10.

## 4. Gantt

Màu theo trạng thái Jira 26/10: xám = xong, xanh nhạt = đang làm, tím = chưa bắt đầu. Đỏ (viền đỏ nếu đã xong) = Story trên đường găng. Vạch đỏ dọc = hôm nay. Ảnh: `XQA-56-gantt.svg`.

```mermaid
gantt
    title Xiangqi Arena – Gantt baseline theo work package (XQA-56)
    dateFormat YYYY-MM-DD
    axisFormat %d/%m
    tickInterval 1week
    todayMarker stroke-width:3px,stroke:#d33,opacity:0.6

    section Mốc
    Release 1.0           :milestone, m1, 2026-10-16, 0d
    Release 1.1 + staging :milestone, m2, 2026-10-30, 0d
    Release 1.2/1.3/1.4   :milestone, m3, 2026-11-13, 0d
    Production            :milestone, m4, 2026-11-20, 0d
    Code freeze           :milestone, m5, 2026-11-25, 0d
    Release 1.5 + nộp bài :milestone, m6, 2026-11-27, 0d

    section 1 Quản lý dự án
    1.1 Khởi động & baseline (Charter, Scope, Change Log, WB… :active,t1, 2026-10-10, 7d
    1.2 Họp & biên bản sprint (planning/review) :t2, 2026-10-10, 49d
    1.3 Giám sát, sprint review & release :active,t3, 2026-10-17, 28d
    1.4 Đóng dự án (lessons learned, closure, nộp bài) :t4, 2026-11-21, 7d

    section 2 Phân tích & thiết kế
    2.1 Đặc tả yêu cầu (SRS, AC, gap list) :t5, 2026-10-17, 28d
    2.2 Thiết kế kỹ thuật & khởi tạo mã nguồn :done,t6, 2026-10-10, 7d
    2.3 Thiết kế UI/UX & usability :active,t7, 2026-10-10, 42d

    section 3 Phát triển sản phẩm
    3.1.1 Đăng ký và đăng nhập tài khoản :active,t8, 2026-10-10, 7d
    3.1.2 Đăng xuất và giữ phiên đăng nhập :done,t9, 2026-10-17, 7d
    3.1.3 Task thiết kế / sửa lỗi cấp Epic :active,t10, 2026-10-10, 49d
    3.2.1 Bàn cờ chuẩn với 32 quân đúng vị trí ban đầu :crit,done,t11, 2026-10-10, 7d
    3.2.2 Chỉ đi được nước hợp lệ theo luật từng quân :crit,done,t12, 2026-10-10, 7d
    3.2.3 Chơi trọn một ván 2 người trên 1 máy :crit,done,t13, 2026-10-10, 7d
    3.2.4 Task thiết kế / sửa lỗi cấp Epic :t14, 2026-10-10, 49d
    3.3.1 Tạo phòng và vào phòng chơi :crit,active,t15, 2026-10-17, 7d
    3.3.2 Đi quân online đồng bộ realtime, server quyết định :crit,active,t16, 2026-10-17, 7d
    3.3.3 Kết thúc ván - xin hòa, xin thua và lưu kết quả :crit,t17, 2026-10-24, 7d
    3.3.4 Vào lại ván sau khi mất kết nối :crit,t18, 2026-10-24, 7d
    3.3.5 Đồng hồ thi đấu :t19, 2026-11-07, 7d
    3.3.6 Dùng được trên các trình duyệt và độ phân giải chuẩn :t20, 2026-11-14, 7d
    3.3.7 Task thiết kế / sửa lỗi cấp Epic :t21, 2026-11-14, 14d
    3.4.1 Phát hiện lặp nước (phần 1) :active,t22, 2026-10-17, 7d
    3.4.2 Xử lý lặp nước – chiếu dai – bắt dai đủ 10 điểm Đi… :t23, 2026-10-24, 7d
    3.4.3 Thông báo vi phạm Điều 23 trên giao diện :t24, 2026-11-07, 7d
    3.5.1 Máy chọn được nước đi hợp lệ và có lý :done,t25, 2026-10-17, 7d
    3.5.2 Chọn 3 mức độ khó khi chơi với máy :t26, 2026-10-24, 7d
    3.5.3 Máy suy nghĩ không làm đơ giao diện :t27, 2026-10-31, 7d
    3.5.4 Chơi trọn một ván với máy :t28, 2026-11-07, 7d
    3.6.1 Nhắn tin với đối thủ trong ván :t29, 2026-10-31, 7d
    3.6.2 Task thiết kế / sửa lỗi cấp Epic :t30, 2026-10-24, 7d
    3.7.1 Gọi video với đối thủ trong ván :t31, 2026-10-31, 7d
    3.7.2 Video call ổn định và dễ dùng :t32, 2026-11-07, 7d
    3.7.3 Task thiết kế / sửa lỗi cấp Epic :t33, 2026-10-24, 7d
    3.8.1 Xem lịch sử các ván đã chơi :active,t34, 2026-10-24, 7d
    3.8.2 Xem lại ván (replay) :t35, 2026-10-31, 7d
    3.8.3 Rating Elo và bảng xếp hạng :t36, 2026-11-14, 7d
    3.9.1 Báo cáo người chơi vi phạm :t37, 2026-10-31, 7d
    3.9.2 Admin quản lý người dùng :t38, 2026-10-31, 7d
    3.9.3 Admin xem ván, xử lý report và xem dashboard :t39, 2026-11-07, 7d
    3.9.4 Task thiết kế / sửa lỗi cấp Epic :t40, 2026-11-14, 7d

    section 4 Kiểm thử & nghiệm thu
    4.1 Kế hoạch kiểm thử & truy vết (Test Plan, RTM) :active,t41, 2026-10-10, 42d
    4.2 Thiết kế test case :active,t42, 2026-10-17, 21d
    4.3 Kiểm thử tự động & phi chức năng :active,t43, 2026-10-17, 42d
    4.4 Thực thi & nghiệm thu release :active,t44, 2026-10-10, 42d
    4.5 UAT & báo cáo kiểm thử :t45, 2026-11-14, 14d

    section 5 Triển khai
    5.1 Hạ tầng phát triển & CI :active,t46, 2026-10-10, 21d
    5.2 Môi trường staging :t47, 2026-10-24, 7d
    5.3 Production & vận hành :t48, 2026-11-07, 21d

    section 6 Tài liệu & bảo vệ
    6.1 User Guide :t49, 2026-10-17, 42d
    6.2 Tài liệu kỹ thuật :t50, 2026-11-21, 7d
    6.3 Báo cáo cuối kỳ :t51, 2026-11-14, 14d
    6.4 Slide & video demo :t52, 2026-11-14, 14d

```

## 5. Tải theo người và sprint (giờ, 1 việc ≈ 4h)

| Người | Vai trò | S1 | S2 | S3 | S4 | S5 | S6 | S7 | Ngoài sprint | Tổng |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Thịnh | PM + BE (History, Admin/Report, AI) | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 8 | 92 |
| Phát | BA + Game Core | 20 | 12 | 12 | 12 | 12 | 12 | 12 | 4 | 96 |
| Kiệt | BE Platform + DevOps | 16 | 12 | 12 | 12 | 12 | 12 | 12 | 0 | 88 |
| Khiêm | FE (bàn cờ, realtime client) | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 0 | 84 |
| Nhân | UX + FE + WebRTC client | 16 | 12 | 12 | 12 | 12 | 12 | 12 | 0 | 88 |
| Quang | QA kỹ thuật (automation, CI) | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 0 | 84 |
| Thiện | QA lead (Test Plan, RTM, nghiệm thu) | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 0 | 84 |
| Thuận | Tài liệu, biên bản, test case | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 0 | 84 |

Plan giữ đều 3 việc/người/sprint (12h). Tải chưa tính phần PM ngoài Jira (điều phối, review PR, họp) nên Thịnh thực tế nặng hơn bảng. Xem RSK-06, RSK-22.
