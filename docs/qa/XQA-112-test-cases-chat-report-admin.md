# Test case Chat, Report, Admin – FR-23…FR-29 (XQA-112)

| Mục | Nội dung |
|---|---|
| Ticket | XQA-112 – QA: test case Chat, Report, Admin |
| Requirement | FR-23…FR-29, NFR-04 (XSS), NFR-05 (phân quyền Admin), BR-06 (`Xiangqi_Arena_Requirements.md`) |
| Kiểu test | API + giao diện, thủ công. Một số ca cần 2 trình duyệt |
| Ngày soạn | 28/10/2026 |
| Trạng thái | **Chưa chạy được.** Chat (XQA-29), Report (XQA-30), Admin (XQA-31…) thuộc Sprint 4–5, hiện chưa có code (`apps/server/src/admin/admin.module.ts` rỗng). Bộ TC soạn trước theo FR |

## 0. Căn cứ và giả định (đọc trước khi chạy)

- Ticket ghi "TC cho FR-23..29 **từ SRS v2.1**". SRS v2.1 (XQA-104) **chưa có** tại 28/10, nên TC soạn từ `Xiangqi_Arena_Requirements.md` (SRS hiện hành). Khi SRS v2.1 ra, QA đối chiếu lại.
- Tên endpoint / event trong cột *Bước* là **dự kiến** (chưa có contract). Ví dụ `chat:send`, `POST /reports`, `GET /admin/users`. Khi có contract thì thay tên, giữ nguyên Expected.
- **Rate limit chat**: FR-23 không ghi ngưỡng. TC-CHAT-08 dùng tham số `N tin / T giây`. **Chờ BA chốt trong SRS v2.1**, QA không tự đặt số.
- Tài khoản: **A**, **B** = người chơi trong cùng ván; **C** = người chơi khác; **ADM** = tài khoản role `ADMIN` (seed `admin`).

## 1. Ma trận phủ

| Requirement | Test case |
|---|---|
| FR-23 Chat trong trận | TC-CHAT-01…09 |
| FR-24 Report player | TC-REP-01…06 |
| FR-25 Admin login, NFR-05 | TC-ADM-01…04 |
| FR-26 User management, BR-06 | TC-ADM-05…09 |
| FR-27 Game management | TC-ADM-10, 11 |
| FR-28 Report management | TC-ADM-12…14 |
| FR-29 Dashboard | TC-ADM-15 |
| NFR-04 XSS | TC-CHAT-04, 05, TC-REP-05, TC-ADM-06 |

## 2. Chat trong trận – FR-23

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-CHAT-01 | FR-23 | A, B đang trong cùng ván ACTIVE | A gõ tin, bấm Gửi | `Chào bạn` | B thấy tin ngay (realtime), hiện tên A + giờ gửi. Tin lưu bảng `chats` gắn `match_id` | | Not Run | XQA-29 |
| TC-CHAT-02 | FR-23 | Như trên | A gửi tin 1 ký tự rồi tin 300 ký tự | `a`; chuỗi 300 ký tự | Cả hai gửi được, B nhận đủ, không bị cắt | | Not Run | XQA-29 |
| TC-CHAT-03 | FR-23 | Như trên | A gõ 301 ký tự; gửi tin rỗng; gửi tin chỉ có khoảng trắng | 301 ký tự; `""`; `"   "` | UI chặn (bộ đếm 300, nút Gửi khóa – XQA-106). Gửi thẳng qua socket/API → server từ chối lỗi validation, **không** lưu, B không nhận | | Not Run | XQA-29, XQA-106 |
| TC-CHAT-04 | FR-23, NFR-04 | Như trên | A gửi các tin chứa HTML / script | `<script>alert(1)</script>`; `<img src=x onerror=alert(1)>`; `<b>đậm</b>` | B thấy **nguyên văn** chuỗi dạng text, không chạy script, không hiện ảnh/chữ đậm. Không có `alert`. DB lưu nguyên văn hoặc đã escape (ghi rõ cách nào vào Actual) | | Not Run | XQA-29 |
| TC-CHAT-05 | FR-23, NFR-04 | Tin XSS của TC-CHAT-04 đã lưu | B reload trang ván (tải lại lịch sử chat) | – | Tin cũ vẫn hiện dạng text, không chạy script | | Not Run | XQA-29 |
| TC-CHAT-06 | FR-23 | C không ở trong ván của A, B | C gửi tin vào ván của A, B (gọi thẳng socket/API với matchId của ván) | `spam` | Bị từ chối (không phải người chơi của ván). A, B không nhận | | Not Run | XQA-29 |
| TC-CHAT-07 | FR-23 | A, B trong ván | A gửi tin có emoji / tiếng Việt có dấu | `Hay quá 👍 nước đi đẹp` | B thấy đúng ký tự, đếm ký tự không vượt 300 do emoji | | Not Run | XQA-29 |
| TC-CHAT-08 | FR-23 (rate limit) | A, B trong ván. Ngưỡng `N tin / T giây` **lấy từ SRS v2.1** | A gửi liên tục N+1 tin trong T giây | N+1 tin `x` | N tin đầu gửi được. Tin thứ N+1 bị từ chối với thông báo "gửi quá nhanh", không lưu. Sau T giây gửi lại được | | Not Run | XQA-29, XQA-104 |
| TC-CHAT-09 | FR-23 | Ván đã FINISHED | A gửi tin | `gg` | Theo quyết định SRS v2.1 (cho chat sau ván hay không). **Chờ BA chốt** | | Not Run | XQA-104 |

## 3. Report người chơi – FR-24

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-REP-01 | FR-24 | A vừa chơi ván X với B | A mở Report, chọn lý do, gửi | reason = `CHEATING` | Thành công. Bảng `reports` có dòng `reporter=A`, `reported_user=B`, `match=X`, `reason=CHEATING`, `status=OPEN` | | Not Run | XQA-30 |
| TC-REP-02 | FR-24 | Như trên | Lặp TC-REP-01 với từng lý do còn lại | `HARASSMENT`, `SPAM`, `OTHER` | Mỗi lý do lưu đúng enum | | Not Run | XQA-30 |
| TC-REP-03 | FR-24 | Như trên | Gửi report với lý do ngoài danh sách (gọi thẳng API) | reason = `ABC` | `400` validation, không lưu | | Not Run | XQA-30 |
| TC-REP-04 | FR-24 | C không chơi ván X | C report B theo ván X | reason = `SPAM` | Bị từ chối (chỉ người chơi của ván report đối thủ của mình). Không lưu | | Not Run | XQA-30 |
| TC-REP-05 | FR-24, NFR-04 | Report có ô mô tả (nếu SRS v2.1 có) | A gửi mô tả chứa script | `<script>alert(1)</script>` | Lưu được; khi ADM xem ở trang Admin hiện dạng text, không chạy script | | Not Run | XQA-30, XQA-104 |
| TC-REP-06 | FR-24 | A đã report B ở ván X | A report B ở ván X lần nữa | reason = `SPAM` | Theo SRS v2.1 (chặn trùng hay cho phép). **Chờ BA chốt** | | Not Run | XQA-104 |

## 4. Admin – FR-25…FR-29

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-ADM-01 | FR-25 | Chưa đăng nhập | Mở `/admin` | – | Chuyển tới trang đăng nhập, không thấy dữ liệu admin | | Not Run | XQA-31 |
| TC-ADM-02 | FR-25, NFR-05 | Đăng nhập A (role PLAYER) | 1. Mở `/admin`. 2. Gọi `GET /admin/users` bằng token của A | token A | UI: không vào được (403 / chuyển trang). API: **`403`**, không trả dữ liệu | | Not Run | XQA-31 |
| TC-ADM-03 | NFR-05 | Đăng nhập A | Gọi lần lượt mọi endpoint `/admin/*` (users, lock, unlock, matches, reports, dashboard) bằng token A | token A | Tất cả trả **`403`**. Không endpoint nào thực hiện thay đổi (kiểm DB) | | Not Run | XQA-31 |
| TC-ADM-04 | FR-25 | Đăng nhập ADM | Mở `/admin` | – | Vào được Dashboard | | Not Run | XQA-31 |
| TC-ADM-05 | FR-26 | Có user `player1`, `player2` | ADM tìm user | `player` | Danh sách có cả 2, mỗi dòng có username, tên hiển thị, trạng thái, rating | | Not Run | XQA-31 |
| TC-ADM-06 | FR-26, NFR-04 | User có display name chứa script | ADM tìm và xem user đó | displayName `<img src=x onerror=alert(1)>` | Hiện dạng text, không chạy script | | Not Run | XQA-31 |
| TC-ADM-07 | FR-26, BR-06 | B đang ACTIVE | ADM khóa B | user = B | `account_status = LOCKED`. B đăng nhập lại bị từ chối `403 ACCOUNT_LOCKED` (Auth contract). Phiên đang mở của B bị thu hồi (Auth contract mục tài khoản bị khóa) | | Not Run | XQA-31 |
| TC-ADM-08 | FR-26 | B đang LOCKED | ADM mở khóa B | user = B | `account_status = ACTIVE`, B đăng nhập lại được | | Not Run | XQA-31 |
| TC-ADM-09 | FR-26, NFR-10 | – | ADM khóa / mở khóa B | – | Server log ghi hành động admin (ai, lúc nào, user nào) | | Not Run | XQA-31 |
| TC-ADM-10 | FR-27 | Có ván FINISHED X | ADM mở danh sách ván, mở ván X | – | Thấy Game ID, 2 người chơi, kết quả, danh sách nước, giờ bắt đầu, giờ kết thúc | | Not Run | Sprint 5 |
| TC-ADM-11 | FR-27, NFR-05 | – | A gọi API xem chi tiết ván admin | token A | `403` | | Not Run | Sprint 5 |
| TC-ADM-12 | FR-28 | Có report OPEN từ TC-REP-01 | ADM xem danh sách report | – | Thấy report: người báo, người bị báo, ván, lý do, thời điểm, trạng thái OPEN | | Not Run | Sprint 5 |
| TC-ADM-13 | FR-28 | Như trên | ADM chuyển report sang xử lý rồi đóng | – | `status`: OPEN → PROCESSING → CLOSED, lưu DB | | Not Run | Sprint 5 |
| TC-ADM-14 | FR-28, NFR-05 | – | A gọi API đổi trạng thái report | token A | `403`, trạng thái không đổi | | Not Run | Sprint 5 |
| TC-ADM-15 | FR-29 | Biết trước số user, ván, ván hôm nay, report trong DB | ADM mở Dashboard | – | Total Users, Total Matches, Matches Today, Reports khớp số đếm DB. Online Users khớp số người đang kết nối (chờ định nghĩa "online" ở SRS v2.1 – FR-21) | | Not Run | Sprint 5, XQA-104 |

## 5. Câu hỏi chuyển BA (SRS v2.1 – XQA-104)

1. Ngưỡng rate limit chat (TC-CHAT-08).
2. Có cho chat sau khi ván kết thúc không (TC-CHAT-09).
3. Report có ô mô tả tự do không; có chặn report trùng không (TC-REP-05, 06).
4. Khóa tài khoản: Auth contract đã ghi "phiên bị thu hồi" — BA xác nhận áp dụng cho khóa từ Admin, và socket đang mở có bị ngắt không (TC-ADM-07).
5. "Online Users" trên Dashboard đếm theo socket hay theo đăng nhập trong N phút (TC-ADM-15, FR-21).
