# SRS v2.1 – Acceptance Criteria kiểm thử được cho release 1.2–1.4 (XQA-104)

| Mục | Nội dung |
|---|---|
| Ticket | XQA-104 – BA: SRS v2.1 + acceptance criteria cho release 1.2–1.4 |
| Phạm vi | Story Sprint 4–5: XQA-29 Chat, XQA-30 Report, XQA-31 + 35 Admin, XQA-32 + 39 Video, XQA-34 + 37 AI, XQA-33 Replay, XQA-36 Đồng hồ, XQA-38 thông báo Điều 23 |
| Nguồn | `Xiangqi_Arena_Requirements.md` (SRS v1), AC hiện có trên Jira của từng Story, contract `docs/api/*` |
| Ngày soạn | 28/10/2026 · Bản nháp, **chờ PM duyệt + 1 người review** (DoD) |

## 0. Cách đọc

- Mỗi AC viết dạng **Cho / Khi / Thì** (Given / When / Then) để QA chuyển thẳng thành test case. ID: `AC-<story>-<số>`.
- Cột **FR** truy vết về SRS v1. AC trên Jira giữ nguyên ý, ở đây chỉ tách nhỏ và thêm điều kiện đo được.
- **[CHỜ CHỐT]** = SRS v1 và Jira không nói, cần PM quyết. Kèm **Đề xuất** của BA, chưa phải quyết định. Gom ở mục 3.
- SRS v2 (XQA-84, sửa mâu thuẫn) **chưa có**. Tài liệu này không sửa các mâu thuẫn đó, chỉ liệt kê lại những cái ảnh hưởng tới release 1.2–1.4 (mục 4).

## 1. Release 1.2 – Chat, Report, Admin

### XQA-29 Chat trong ván (FR-23, NFR-04)

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-29-01 | A, B là 2 người chơi của ván đang ACTIVE, cùng mở màn ván | A gửi tin 1–300 ký tự | B thấy tin trong ≤ 1 giây (mạng LAN), kèm tên A và giờ gửi; tin lưu bảng `chats` gắn `match_id` | FR-23, NFR-01 |
| AC-29-02 | Như trên | A gửi tin rỗng, chỉ khoảng trắng, hoặc > 300 ký tự (đếm theo ký tự Unicode) | FE chặn (đã có ở XQA-106). Gửi thẳng qua socket → server trả lỗi `VALIDATION_ERROR`, không lưu, B không nhận | FR-23 |
| AC-29-03 | Như trên | A gửi tin chứa HTML / script (`<script>`, `<img onerror>`) | B và chính A thấy nguyên văn dạng text, không thực thi, kể cả khi tải lại lịch sử chat | FR-23, NFR-04 |
| AC-29-04 | Như trên | A gửi quá **N tin trong T giây** | Tin vượt ngưỡng bị từ chối `CHAT_RATE_LIMITED`, không lưu; sau T giây gửi lại được. **[CHỜ CHỐT N, T]** | FR-23 |
| AC-29-05 | C không phải người chơi của ván | C gửi tin vào ván | Bị từ chối (`GAME_NOT_JOINED` / `GAME_NOT_PLAYER`), A, B không nhận | FR-23, BR-02 |
| AC-29-06 | Ván đã FINISHED | A gửi tin | **[CHỜ CHỐT]** cho chat sau ván hay không | FR-23 |
| AC-29-07 | B vào lại ván (reload) | – | B thấy lại tối đa **M** tin gần nhất của ván **[CHỜ CHỐT M]** | FR-23, NFR-07 |

### XQA-30 Report người chơi (FR-24)

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-30-01 | A đã chơi ván X với B | A chọn lý do (Gian lận / Quấy rối / Spam / Khác) + mô tả, gửi | Lưu `reports`: `reporter=A`, `reported_user=B`, `match=X`, `reason`, `status=OPEN`; A thấy thông báo đã gửi | FR-24 |
| AC-30-02 | Như trên | Gửi lý do ngoài 4 giá trị enum | `400 VALIDATION_ERROR`, không lưu | FR-24 |
| AC-30-03 | Như trên | A report lần 2 cho cùng ván X | Bị từ chối (Jira: "1 ván chỉ report 1 lần"), mã **[CHỜ CHỐT tên mã]**, ví dụ `REPORT_DUPLICATE` | FR-24 |
| AC-30-04 | – | A report chính mình, hoặc report theo ván A không chơi | Bị từ chối, không lưu | FR-24 |
| AC-30-05 | Mô tả chứa HTML / script | ADM mở report | Hiện dạng text, không thực thi | NFR-04 |
| AC-30-06 | – | Mô tả dài hơn **K** ký tự | `400 VALIDATION_ERROR` **[CHỜ CHỐT K]** | FR-24 |

### XQA-31 Admin quản lý người dùng (FR-25, FR-26, NFR-05, BR-06)

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-31-01 | Chưa đăng nhập | Mở `/admin` | Chuyển tới `/login?next=%2Fadmin` | FR-25 |
| AC-31-02 | Đăng nhập role PLAYER | Mở `/admin`; gọi bất kỳ `/admin/*` | UI không vào được; **mọi** API admin trả `403`, không thay đổi dữ liệu | FR-25, NFR-05 |
| AC-31-03 | Đăng nhập ADMIN | Tìm user theo username / email / tên hiển thị (chứa chuỗi, không phân biệt hoa thường) | Danh sách phân trang, mỗi dòng: username, tên hiển thị, email, role, trạng thái, rating, ngày tạo | FR-26 |
| AC-31-04 | B đang ACTIVE | ADM khóa B | `account_status=LOCKED`; mọi phiên của B bị thu hồi; B đăng nhập → `403 ACCOUNT_LOCKED` (Auth contract) | FR-26, BR-06 |
| AC-31-05 | B đang LOCKED | ADM mở khóa | `ACTIVE`, B đăng nhập lại được | FR-26 |
| AC-31-06 | – | ADM tự khóa chính mình / khóa admin khác | **[CHỜ CHỐT]** Đề xuất: chặn tự khóa | FR-26 |
| AC-31-07 | – | Mọi thao tác khóa / mở khóa | Server log: admin nào, user nào, hành động, thời điểm | NFR-10 |

### XQA-35 Admin xem ván, xử lý report, dashboard (FR-27…29) – Sprint 5

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-35-01 | Có ván FINISHED | ADM mở danh sách ván, lọc theo trạng thái | Mỗi dòng: Game ID, 2 người chơi, kết quả, lý do, giờ bắt đầu, giờ kết thúc; mở chi tiết thấy danh sách nước | FR-27 |
| AC-35-02 | Report OPEN | ADM chuyển trạng thái | Chỉ cho OPEN → PROCESSING → CLOSED (không đi lùi). Lưu người xử lý + thời điểm | FR-28 |
| AC-35-03 | Biết trước số liệu trong DB | ADM mở Dashboard | Tổng user, tổng ván, ván hôm nay (theo giờ Việt Nam), số report OPEN khớp DB. "User online" **[CHỜ CHỐT định nghĩa]** | FR-29, FR-21 |

## 2. Release 1.3 – Video call, Release 1.4 – Chơi với máy

### XQA-32 + XQA-39 Gọi video

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-32-01 | A, B trong ván ACTIVE | A bấm Gọi | B thấy lời mời Nhận / Từ chối trong ≤ 2 giây | Story XQA-32 |
| AC-32-02 | Như trên | B Nhận | Hai bên thấy hình + nghe tiếng trong ≤ 5 giây | Story XQA-32 |
| AC-32-03 | Như trên | B Từ chối, hoặc không trả lời sau **30 giây [CHỜ CHỐT]** | A thấy "Đối thủ từ chối / không trả lời", không mở cam của B | Story XQA-32 |
| AC-32-04 | A và B ở 2 mạng khác nhau (một bên 4G) | Gọi | Kết nối được qua TURN | Story XQA-32 |
| AC-32-05 | Đang gọi | Ván kết thúc / một bên rời phòng / bấm Kết thúc | Cuộc gọi đóng ở cả hai bên, đèn cam/mic tắt (track stop) | Story XQA-32 |
| AC-39-01 | Đang gọi | A tắt mic / cam | B thấy biểu tượng "mic tắt" / "tắt cam" của A | Story XQA-39 |
| AC-39-02 | Đang gọi, mạng A rớt ≤ **10 giây [CHỜ CHỐT]** | Mạng có lại | Cuộc gọi tự nối lại, không cần bấm Gọi lại | Story XQA-39 |
| AC-39-03 | – | Chrome, Edge, Firefox bản mới nhất | AC-32-01…05 pass trên cả 3 (NFR-08) | NFR-08 |
| AC-39-04 | Màn 1366×768 | Đang gọi | Khung video không che bàn cờ (đã kiểm ở XQA-107) | NFR-08 |

**Ghi chú phạm vi:** SRS v1 mục 9.2 ghi Video call là Out of Scope; GV yêu cầu bắt buộc. Cần Change Request ghi nhận (đã nêu trong RTM v1.1 mục 4, mâu thuẫn #1).

### XQA-34 + XQA-37 Chơi với máy

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-34-01 | Đang chơi với máy mức Khó | AI đang tính | Click, cuộn, mở menu vẫn phản hồi; không có tác vụ main thread > 200 ms (Performance panel) | Story XQA-34 |
| AC-34-02 | – | Chạy perft từ thế khởi đầu | depth 1 = 44, depth 2 = 1 920, depth 3 = 79 666. Engine hiện tại ra đúng các số này (đo 28/10); **Phát đối chiếu một nguồn perft độc lập** trước khi chốt làm AC | Story XQA-34 |
| AC-37-01 | – | Chọn mức → vào ván → đi tới khi kết thúc | Có kết quả (thắng/thua/hòa + lý do) như ván online | Story XQA-37 |
| AC-37-02 | – | Mỗi nước AI | Thời gian tối đa: Dễ / Trung bình / Khó = **[CHỜ CHỐT]** (benchmark XQA-100 có số đo hiện tại) | Story XQA-37 |
| AC-37-03 | – | 200 ván tự đấu (đủ 3 mức) | 0 nước sai luật, 0 ván treo quá thời gian tối đa ở AC-37-02 | Story XQA-37 |
| AC-37-04 | – | AI ở thế lặp | AI không tự phạm Điều 23 (chiếu mãi / bắt mãi) – xem XQA-145 | Điều 23 |

## 3. Release 1.5 (Should-have) có Story ở Sprint 4–5

| ID | Cho | Khi | Thì | FR |
|---|---|---|---|---|
| AC-33-01 | Ván FINISHED trong lịch sử | Bấm Start / Previous / Next / End | Bàn cờ hiện đúng `fenAfter` của nước tương ứng (API XQA-97 đã có) | FR-18 |
| AC-33-02 | – | Xem danh sách nước | Ký hiệu theo DECISION-04 **(chưa thấy bản ghi DECISION-04 trong Project – PM cung cấp)** | FR-18 |
| AC-36-01 | Ván 10 phút/bên | Đỏ suy nghĩ 30 giây rồi đi | Chỉ đồng hồ Đỏ giảm 30 giây (sai số ≤ 1 giây), đồng hồ Đen giữ nguyên | FR-16 |
| AC-36-02 | Đồng hồ Đỏ về 0 | – | Ván FINISHED, Đen thắng, `endReason = TIMEOUT` (schema; FR-16 ghi `LOSE_BY_TIMEOUT` – xem mục 4) | FR-16 |
| AC-36-03 | Client sửa đồng hồ ở máy | – | Không ảnh hưởng; server là nguồn thời gian | FR-16, NFR-06 |
| AC-38-01 | Ván kết thúc do Điều 23 | – | Hộp kết thúc hiện lý do + điểm luật (`endRule`) | Story XQA-38 |
| AC-38-02 | Một bên đang lặp nước, sắp tới ngưỡng | – | **[CHỜ CHỐT]** có cảnh báo trước hay không. Luật chỉ xử khi "không đổi nước đi" | Story XQA-38 |

## 4. Tham số và quyết định cần PM chốt

| # | Câu hỏi | AC | Đề xuất BA (chưa duyệt) |
|---|---|---|---|
| Q1 | Rate limit chat N tin / T giây | AC-29-04 | 5 tin / 10 giây |
| Q2 | Chat sau khi ván kết thúc | AC-29-06 | Không cho; khung chat chuyển chỉ đọc |
| Q3 | Số tin tải lại khi reload | AC-29-07 | 50 tin gần nhất |
| Q4 | Mã lỗi report trùng; độ dài mô tả | AC-30-03, 06 | `REPORT_DUPLICATE`; mô tả ≤ 500 ký tự, không bắt buộc |
| Q5 | Admin tự khóa / khóa admin khác | AC-31-06 | Chặn cả hai |
| Q6 | Định nghĩa "user online" | AC-35-03 | Có ít nhất 1 socket đang kết nối |
| Q7 | Hết hạn lời mời gọi video; ngưỡng tự nối lại | AC-32-03, AC-39-02 | 30 giây; 10 giây |
| Q8 | Thời gian tối đa mỗi nước AI theo mức | AC-37-02 | Lấy số đo benchmark XQA-100 × 1,5 |
| Q9 | Cảnh báo trước khi chạm ngưỡng lặp nước | AC-38-02 | Có, toast khi thế cờ lặp lần 2 |

## 5. Mâu thuẫn còn mở ảnh hưởng release 1.2–1.4 (từ RTM v1.1, chưa sửa ở SRS v2)

| # | Mâu thuẫn | Ảnh hưởng |
|---|---|---|
| M1 | SRS v1 mục 9.2/11: Video call Out of Scope, AI opponent WON'T V1; kế hoạch có Epic Video (XQA-9) và AI 3 mức (XQA-7) do GV yêu cầu | Cần CR để SRS khớp kế hoạch trước nghiệm thu 1.3, 1.4 |
| M2 | FR-16 `LOSE_BY_TIMEOUT` vs schema `TIMEOUT` | AC-36-02 dùng `TIMEOUT` theo schema |
| M3 | FR-19 rating khởi đầu 1000 vs schema 1200 | Ảnh hưởng Elo (Sprint 6), không ảnh hưởng 1.2–1.4 |
| M4 | XQA-30 Jira: "lý do + mô tả" nhưng bảng `reports` **không có cột mô tả** | Cần migration thêm cột (Thịnh – XQA-30 BE) hoặc bỏ mô tả khỏi AC |
