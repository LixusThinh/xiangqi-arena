# Sprint 1 Review + Issue log – Xiangqi Arena (XQA-82)

> Người lập: Thịnh (PM). Ngày lập: 26/10/2026. Số liệu lấy từ Jira XQA (board 37) và GitHub `LixusThinh/xiangqi-arena` lúc 19:30 ngày 26/10.
> Phần đánh dấu **[PM ĐIỀN]** là thông tin buổi họp mà dữ liệu Jira/GitHub không có. Không tự điền.

## 1. Thông tin sprint

| Mục | Nội dung |
|---|---|
| Sprint | XQA Sprint 1 · 10/10 → 16/10/2026 |
| Ngày đóng sprint trên Jira | 23/10/2026 19:28 (trễ 7 ngày so với kế hoạch) |
| Sprint goal | Release 1.0 Core: bàn cờ + luật đi quân + chiếu/chiếu bí, chơi 2 người 1 máy, đăng ký/đăng nhập, CI; baseline phạm vi & lịch |
| Buổi review | **[PM ĐIỀN]** ngày, hình thức (online/offline), người dự, người vắng |

## 2. Kết quả theo sprint goal

| Hạng mục goal | Jira | Bằng chứng | Đạt? |
|---|---|---|---|
| Bàn cờ 32 quân, FEN | XQA-15 (42, 43) | PR #4, #5 merge 13/10 | Đạt |
| Luật đi quân 7 loại, ≥50 test case | XQA-16 (44, 45, 46, 47, 48) | PR #9, #12, #7, #10, #14 merge 15–17/10; harness chạy trên CI | Đạt |
| Chiếu, lộ mặt tướng, chiếu bí / hết nước, chơi 2 người 1 máy | XQA-17 (49, 50, 51) | PR #13 merge 17/10; panel trạng thái XQA-50 merge 24/10 trong PR #23 | Đạt |
| Đăng ký / đăng nhập | XQA-18 (52, 53, 214, 54) | BE PR #1 (12/10); FE auth + nối API thật PR #23 (24/10) | Đạt phần code. Test case XQA-54 chưa đóng trên Jira |
| CI | XQA-65 | PR #11 (17/10). Run trên develop 17/10 fail; từ 21/10 chạy xanh. Biên bản XQA-64 (21/10) ghi CI bị khóa do billing, cần đối chiếu lại | Đạt |
| Baseline phạm vi | XQA-55 | Charter v1, Scope Statement, Change Log CR-01…05 (Done 12/10) | Đạt |
| Baseline lịch | XQA-56 | WBS, lịch + Gantt, RACI, Risk Register v2 lập ngày 26/10 | Trễ 10 ngày |

## 3. Số liệu

| Chỉ số | Giá trị |
|---|---|
| Việc cam kết (Task/Sub-task nhãn `sprint-1`, gồm 4 việc thêm giữa sprint: XQA-213, 214, 215, 216) | 28 |
| Xong | 22 (79%) |
| Chưa xong | 6: XQA-54 (Thuận), XQA-56 (Thịnh), XQA-58 (Thuận), XQA-63 (Thiện), XQA-64 (Thiện), XQA-216 (Phát) |
| Story Done | 4/4 (XQA-15, 16, 17, 18). XQA-18 Done khi sub-task XQA-54 còn To Do, trái DoD của Story |
| Việc chưa xong chuyển sang S3 | 5 (XQA-56, 58, 63, 64, 216). XQA-54 vẫn kẹt trong Sprint 1 đã đóng |
| Code ra khỏi sprint | 13 PR merge vào develop có gắn việc Sprint 1 (PR #1, 2, 4–7, 9–14, 23) |

Theo người (nhãn `sprint-1`, xong/tổng): Thịnh 2/3 · Phát 4/5 · Kiệt 4/4 · Khiêm 3/3 · Nhân 4/4 · Quang 3/3 · Thiện 1/3 · Thuận 1/3. *(Thiện có XQA-87 nhãn sprint-2 làm sớm trong container Sprint 1, không tính ở đây.)*

## 4. Nghiệm thu Release 1.0

Biên bản XQA-64 (Thiện, 21/10) kết luận **"đạt có điều kiện"**, kèm 2 điều kiện:

1. Chuỗi FE auth merge vào develop → **đã đạt**: PR #23 merge 24/10.
2. CI chạy xanh, hoặc PM ghi DECISION chấp nhận test local → **đã đạt**: GitHub Actions có run xanh trên develop ngày 21/10 và 24/10 (lần gần nhất 24/10 02:23 UTC, sau merge PR #25).

**Đề xuất:** PM ký biên bản XQA-64, đóng Release 1.0 với ngày đạt thực tế 24/10 (kế hoạch 16/10, chênh 8 ngày).

## 5. Nhận xét

**Làm tốt**
- Engine (xiangqi-core) xong đủ luật đi quân và chiếu/chiếu bí trong sprint, có ≥50 fixture tự động. Đây là phần rủi ro kỹ thuật cao nhất (RSK-03).
- Có API contract Auth (XQA-213) và FE dùng mock (XQA-53) nên FE không phải chờ BE.
- 14/10 Nhân báo lỗi lịch (XQA-50 cần dữ liệu của XQA-49 đang làm song song). PM xử lý trong ngày: tách ra dữ liệu giả theo XQA-216, dời hạn 1 ngày.

**Vấn đề**
- Sprint đóng trễ 7 ngày. Release 1.0 thực tế đạt 24/10.
- Việc PM và tài liệu (XQA-56, 58, 63, 64) trễ trong khi việc code đúng hạn: tài liệu bị đẩy xuống sau (RSK-13).
- Thuận xong 1/3 việc, 2 biên bản họp (XQA-58, 83) chưa có trên Jira (RSK-21).
- Jira không theo kịp repo: Story Done khi sub-task còn mở, việc đã merge vẫn In Progress (RSK-23).
- CI từng bị khóa vì billing GitHub Actions (RSK-27).

## 6. Ảnh hưởng tới S2–S3 và điều chỉnh đề xuất

- S2 xong 12/24 việc; 12 việc còn lại dồn sang S3 cùng 24 việc của S3. Tính đến hết ngày 3/7 của S3, chưa việc nào nhãn `sprint-3` xong trên Jira (riêng XQA-97 đã có PR #27, CI xanh).
- Đường găng không còn dự trữ (RSK-18): XQA-90/91/92 (kết thúc ván) phải xong 28/10 thì XQA-93/94 (reconnect) mới kịp 30/10.

Đề xuất cho PM quyết **trước 28/10** (ghi DECISION / CR nếu đồng ý):

| # | Đề xuất | Lý do |
|---|---|---|
| D1 | Release 1.1 giữ bắt buộc: XQA-21, 24, 25, 27. Điều 23 phần 2 (XQA-26) và AI 3 mức (XQA-28): nếu 29/10 chưa có PR thì ghi CR dời sang Release 1.4 (13/11) | Bảo vệ luồng chơi online trọn ván. Điều 23 vẫn bắt buộc của GV nên chỉ được dời, không được cắt |
| D2 | Tạm gác XQA-84, XQA-104 (SRS v2/v2.1) của Phát tới sau 30/10 | Phát đang giữ XQA-90, 95 trên đường găng |
| D3 | Chốt host staging + TURN trong 27/10. Không kịp thì demo 1.1 local + CI xanh, staging dời S4 (ghi DECISION) | RSK-25 |
| D4 | Quy tắc mới: merge PR xong owner chuyển Done trong ngày; PM rà Jira với danh sách PR mỗi thứ 6 trước review | RSK-23 |
| D5 | Báo GV tình trạng Thuận kèm số liệu Jira; giao lại test case cho Thiện, biên bản cho Thịnh | RSK-21, plan 11/10 §7 |

**Quyết định buổi họp:** **[PM ĐIỀN]** (đồng ý / sửa / bác từng đề xuất D1–D5)

## 7. Issue log (26/10/2026)

Issue = rủi ro đã thành sự việc, hoặc vấn đề cần xử lý ngay.

| ID | Issue | Liên quan | Owner | Hành động | Hạn | Trạng thái |
|---|---|---|---|---|---|---|
| ISS-01 | Jira lệch repo: XQA-74 (PR #24) và XQA-71 (PR #19) đã merge nhưng còn In Progress | RSK-23 | Phát, Khiêm | Chuyển Done | 27/10 | Open |
| ISS-02 | Story trạng thái sai so với sub-task: XQA-18, XQA-20 Done khi sub-task mở; XQA-23 To Do khi 2/2 sub-task Done | RSK-23 | Thịnh | Mở lại XQA-18/20 hoặc đóng sub-task; chuyển XQA-23 qua QA | 27/10 | Open |
| ISS-03 | XQA-54 kẹt trong Sprint 1 đã đóng, không nằm sprint nào đang mở | RSK-21 | Thịnh | Chuyển sang Sprint 3 | 27/10 | Open |
| ISS-04 | Release 1.0 chưa ký đóng dù đủ điều kiện | – | Thịnh | Ký biên bản XQA-64, chuyển XQA-64 Done | 27/10 | Open |
| ISS-05 | File XQA-54, 73, 89 (test case, hướng dẫn luật chơi) và RTM, nghiệm thu (XQA-63, 64, 88) đã có trong Project docs từ 21/10 nhưng Jira chưa cập nhật và chưa rõ ai làm | RSK-21, RSK-23 | Thịnh | Xác minh người làm; đúng owner thì đóng, không thì ghi nhận lại người thực hiện | 28/10 | Open |
| ISS-06 | Thuận không có đầu ra trên Jira (1/21 việc) | RSK-21 | Thịnh | Báo GV kèm số liệu; giao lại việc | 30/10 | Open |
| ISS-07 | S3 quá tải do 12 việc S2 dồn sang; Release 1.1 có nguy cơ trượt | RSK-24, RSK-18 | Thịnh | Quyết D1, D2 | 28/10 | Open |
| ISS-08 | Host staging + TURN chưa chốt (hạn plan 26/10); XQA-105, 109 To Do | RSK-25 | Kiệt | Quyết D3 | 27/10 | Open |
| ISS-09 | XQA-216 (thống nhất dữ liệu trạng thái ván) còn To Do trong khi XQA-49, 50, 51 phụ thuộc nó đã Done | RSK-23 | Phát | Xác nhận đã làm thì đóng, không cần thì hủy | 27/10 | Open |
| ISS-10 | PR #26 (XQA-76) và PR #27 (XQA-97) chờ test | – | Thiện | Test nhánh, báo kết quả trên PR | 28/10 | Open |
| ISS-11 | Baseline lịch XQA-56 và sprint review XQA-82 trễ hạn | RSK-13, RSK-22 | Thịnh | Lập WBS, Gantt, RACI, Risk v2, review S1 | 26/10 | **Đã xử lý 26/10**, chờ 1 người review theo DoD |

## 8. Ký xác nhận

| Vai trò | Họ tên | Ngày |
|---|---|---|
| PM (lập) | Trần Gia Thịnh | **[PM ĐIỀN]** |
| Người review (DoD XQA-82) | **[PM ĐIỀN]** | |
