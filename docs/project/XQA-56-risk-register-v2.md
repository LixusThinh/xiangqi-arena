# Risk Register v2 – Xiangqi Arena (XQA-56)

> Baseline lịch, phần 4/4. Cập nhật 26/10/2026 từ Risk Register v1 (28/09, Google Sheet `Xiangqi_Risk_Register_v1`).
> Giữ nguyên mã RSK-01…20 để truy vết; thêm RSK-21…27. Bằng chứng lấy từ Jira XQA và GitHub `LixusThinh/xiangqi-arena` ngày 26/10.
> **[ĐỀ XUẤT]** = thay đổi P/I/Owner/Trạng thái do người lập đề xuất, PM duyệt rồi bỏ nhãn.

## 1. Thang đo (giữ như v1)

- Probability (P), Impact (I): H = 3, M = 2, L = 1. Điểm = P × I.
- Mức độ: 9 = Critical · 6 = High · 3–4 = Medium · 1–2 = Low.
- Trạng thái: **Open** (đang theo dõi) · **Occurring** (đang xảy ra, coi như issue) · **Đề xuất đóng** (đủ bằng chứng, chờ PM) · **Closed**.

## 2. Rủi ro đang mở, xếp theo điểm

| ID | Mô tả | P | I | Điểm | Mức độ | Trạng thái | Biện pháp / hành động tiếp | Owner | Thay đổi so với v1 |
|---|---|:-:|:-:|:-:|---|---|---|---|---|
| RSK-01 | Scope vượt năng lực (AI 3 mức, video call, admin/report, Điều 23 đều bắt buộc theo GV) | H | H | 9 | Critical | Open | Should-have (XQA-33 replay, 36 đồng hồ, 40 Elo) cắt được ở review S5; matchmaking đã Out of Scope; mọi tính năng mới qua Change Log | Thịnh | Mitigation cập nhật theo plan XQA |
| RSK-04 | Điều 23 (RepetitionJudge) cài sai → xử thắng/thua sai khi demo. GV yêu cầu bắt buộc | H | H | 9 | Critical | Open | Phần 1 đã merge (PR #20). Phần 2 (XQA-95) hạn 26/10 chưa bắt đầu; golden fixture XQA-79 đang làm. Ca luật không có ngưỡng rõ → BA đề xuất BR, PM duyệt, đối chiếu `luat_co_tuong_viet_nam.pdf` | Phát + Thiện | Owner ghi tên cụ thể |
| RSK-06 | Quá tải nhân sự trên đường găng: Phát (engine + GameService + kết thúc ván + Điều 23 + 3 task SRS) và Kiệt (socket, reconnect, Docker, video signaling) | H | H | 9 | Critical | Occurring | Gỡ XQA-84, XQA-104 (SRS) khỏi tuần này của Phát hoặc hạ ưu tiên; theo dõi bảng tải ở `XQA-56-schedule-gantt.md` mỗi review | Thịnh | Owner "PM" → Thịnh; đổi tên vai trò BE1/BE2 → Kiệt/Phát |
| RSK-18 | Đường găng không còn dự trữ: XQA-74 → 75 xong 24/10 (trễ 1–5 ngày), XQA-90/91/92 phải xong 28/10 thì XQA-93/94 mới kịp 30/10 | H | H | 9 | Critical | Open | Theo dõi đường găng hằng ngày tới 30/10 (xem `XQA-56-schedule-gantt.md` §3) | Thịnh | P M → H **[ĐỀ XUẤT]**; chuỗi găng cập nhật theo plan XQA |
| RSK-22 | **PM quá tải**: Thịnh là PM, đồng thời là A ở 5/14 Epic và có 23 việc trên Jira (BE History/Admin/Report + AI). Việc PM trễ: XQA-56 trễ 10 ngày, XQA-82 trễ 3 ngày | H | H | 9 | Critical | Occurring | Khóa 2 block cố định mỗi tuần cho việc PM; giao XQA-163 (API hồ sơ, S6) cho Kiệt như plan 11/10 đã đề xuất; nhờ Thiện duyệt chéo biên bản | Thịnh | Mới (AC XQA-56) |
| RSK-24 | **Release 1.1 trượt mốc 30/10.** S2 chỉ xong 12/24 việc, 12 việc dồn sang S3; S3 đang gánh gần 2 sprint (hết ngày 3/7, 0 việc nhãn sprint-3 xong trên Jira) | H | H | 9 | Critical | Occurring | Chốt phạm vi tối thiểu của 1.1 trước 28/10: bắt buộc giữ XQA-24 (kết thúc ván), XQA-25 (reconnect), XQA-27 (lịch sử); Điều 23 phần 2 (XQA-26) và AI 3 mức (XQA-28) nếu không kịp thì ghi CR dời sang 13/11 | Thịnh | Mới |
| RSK-10 | Thành viên trễ việc làm chậm task phụ thuộc | H | M | 6 | High | Occurring | Đã xảy ra (RSK-21, RSK-24). Task 4h, owner rõ, review thứ 6 | Thịnh | P M → H **[ĐỀ XUẤT]** |
| RSK-13 | Tài liệu viết dồn cuối kỳ | H | M | 6 | High | Occurring | Baseline WBS/Gantt/RACI/Risk xong 26/10 (trễ 10 ngày); SRS v2 (XQA-84) chưa bắt đầu; viết báo cáo dần từ S6 theo plan | Thịnh | Trạng thái → Occurring **[ĐỀ XUẤT]** |
| RSK-21 | **Thuận không tham gia.** 21 việc trên Jira, 1 việc xong (XQA-57); 3 biên bản họp (XQA-58, 83, 103) và 3 bộ test case (XQA-54, 73, 99) chưa đóng trên Jira | H | M | 6 | High | Occurring | Ghi nhận trên Jira và báo GV (plan 11/10 §7). Người nhận lại: Thiện (test case), Thịnh (biên bản). Lưu ý: file XQA-54, 73, 89 đã có trong Project docs từ 21/10 nhưng Jira chưa cập nhật, cần xác minh ai làm trước khi đóng | Thịnh | Mới (AC XQA-56) |
| RSK-23 | **Jira lệch với repo**: XQA-74 (PR #24) và XQA-71 (PR #19) đã merge 24/10 nhưng Jira còn In Progress; Story XQA-18, XQA-20 Done khi sub-task còn mở; XQA-54 kẹt trong Sprint 1 đã đóng | H | M | 6 | High | Occurring | Quy tắc: merge PR xong thì owner chuyển Done trong ngày; PM rà Jira với danh sách PR mỗi thứ 6 trước review | Thịnh | Mới |
| RSK-25 | **Staging chưa có trước 30/10.** XQA-105 (Docker compose, hạn 26/10) và XQA-109 (deploy staging, hạn 28/10) đều To Do; host staging/TURN theo plan phải chốt trước 26/10 | H | M | 6 | High | Open | Chốt host trong 27/10; nếu không kịp, ghi DECISION: demo 1.1 chạy local + CI xanh, staging dời sang S4 | Kiệt | Mới |
| RSK-03 | Engine sai luật ở edge case lan sang realtime, AI, replay | M | H | 6 | High | Open | ≥50 fixture luật đi quân + harness chạy trên CI (XQA-47, 48 xong); unit test thế kết thúc XQA-86 đang làm | Phát | P giữ M |
| RSK-07 | WebRTC không kết nối qua 2 mạng khác nhau nếu chỉ có STUN | M | H | 6 | High | Open | Video call là bắt buộc theo GV (không còn "nếu D-01 giữ"). Chốt TURN (XQA-125, S4) cùng lúc chốt host ở RSK-25 | Kiệt | I M → H **[ĐỀ XUẤT]**; Owner FE → Kiệt |
| RSK-09 | Lỗi đồng bộ realtime (nước trùng, state cũ, mất kết nối) | M | H | 6 | High | Open | Server authoritative + chống gửi trùng bằng expectedPly đã có (PR #24). Còn thiếu: integration test 2 client (XQA-77, To Do), reconnect (XQA-93/94) | Kiệt | Owner BE2 → Kiệt **[ĐỀ XUẤT]** |
| RSK-12 | Độ phủ kiểm thử thấp, lỗi lộ ra cuối kỳ | M | H | 6 | High | Open | CI xanh trên develop từ 21/10; server 147 test, core có harness. Thiếu E2E (XQA-108) và test socket (XQA-77) | Quang | Owner QA → Quang |
| RSK-14 | Sự cố triển khai sát hạn nộp | M | H | 6 | High | Open | Liên kết RSK-25: staging trễ thì production 20/11 bị dồn. Production (XQA-172) không được dời sau 20/11 | Kiệt | Owner QA → Kiệt **[ĐỀ XUẤT]** (Kiệt là A Epic XQA-13) |
| RSK-08 | Link sơ đồ có quyền Edit lộ trong tài liệu nộp | M | M | 4 | Medium | Open | Rà link trước khi nộp báo cáo (S7) | Thịnh | – |
| RSK-11 | Xung đột tích hợp giữa các nhánh | M | M | 4 | Medium | Open | Branch-per-Jira-task → PR vào develop → Thiện test → merge (quy trình từ 12/10); ruleset bảo vệ develop | Kiệt | – |
| RSK-19 | Chưa lưu mốc bắt đầu lượt và chưa chốt đồng hồ khi mất kết nối → reload/reconnect khôi phục sai thời gian | M | M | 4 | Medium | Open | Xử lý trong XQA-93 (reconnect, hạn 30/10) và XQA-141 (đồng hồ server-side, S5); test đồng hồ khi reload | Kiệt | Owner BE2 → Kiệt **[ĐỀ XUẤT]** |
| RSK-26 | **Bằng chứng đóng góp cá nhân yếu**: hầu hết PR (#12–#27) mở từ tài khoản LixusThinh; commit có tên tác giả từng người nhưng GV có thể nhìn danh sách PR và đánh giá sai mức đóng góp | M | M | 4 | Medium | Open | Mỗi PR ghi rõ owner Jira trong mô tả (đang làm); mỗi người tự review ít nhất 1 PR/sprint bằng tài khoản của mình; báo cáo cuối kỳ có bảng đóng góp theo Jira | Thịnh | Mới |
| RSK-05 | Luật chiếu mãi / lặp thế bị phản biện | M | L | 2 | Low | Open | Ghi rõ quy ước hệ thống, trích Điều 23 trong báo cáo, liệt kê Known limitations | Phát | Owner BA → Phát |
| RSK-27 | **CI phụ thuộc billing GitHub Actions**: biên bản XQA-64 (21/10) ghi bị khóa; lịch sử run cho thấy develop fail 17/10, xanh từ 21/10 | L | M | 2 | Low | Open | Giữ hướng dẫn chạy test local trong README; nếu bị khóa lại, PM ghi DECISION chấp nhận bằng chứng test local | Quang | Mới |

## 3. Đề xuất đóng (đủ bằng chứng, chờ PM)

| ID | Mô tả v1 | Bằng chứng đóng |
|---|---|---|
| RSK-02 | QLDA_Doc và SRS lệch scope | Plan XQA 11/10 chốt scope 14 Epic; Charter/Scope/Change Log XQA-55 Done. Phần SRS v2 còn lại theo dõi ở RSK-13 |
| RSK-15 | Hai mô hình dữ liệu ERD song song | Prisma schema duy nhất merge ở XQA-59 (PR #2); mọi module BE dùng chung schema |
| RSK-16 | Chưa có contract socket event | XQA-60 Done; `docs/api/socket.md`, `game.md`, `room.md`, `auth.md`, `history.md` có trong repo |
| RSK-17 | Mã CR trùng giữa 2 tài liệu | Change Log CR-01…05 thống nhất trong XQA-55 (Done 12/10) |
| RSK-20 | Estimate chưa Planning Poker | Plan XQA đổi sang quy tắc 3 việc × 4h/người/sprint; sai lệch estimate giờ thể hiện ở tốc độ sprint (RSK-24) |

RSK-19 không đủ bằng chứng nên giữ ở bảng mở.

## 4. Ma trận P × I (22 rủi ro mở)

| P \ I | L | M | H |
|---|---|---|---|
| **H** | 0 | 5 (10, 13, 21, 23, 25) | 6 (01, 04, 06, 18, 22, 24) |
| **M** | 1 (05) | 4 (08, 11, 19, 26) | 5 (03, 07, 09, 12, 14) |
| **L** | 0 | 1 (27) | 0 |

Tổng 27 rủi ro: **22 mở** (Critical 6 · High 10 · Medium 4 · Low 2), **5 đề xuất đóng** (RSK-02, 15, 16, 17, 20). Trong 22 rủi ro mở có 7 rủi ro đã thành sự việc (Occurring), cần xử lý như issue ở `XQA-82-sprint1-review.md`.
