# Test case hệ thống – Release 1.1 (XQA-87)

| Mục | Nội dung |
|---|---|
| Ticket | XQA-87 – QA: test case hệ thống cho release 1.1 |
| Luồng chính | Đăng nhập → tạo phòng → vào phòng → chơi online → kết thúc ván → xem lịch sử |
| Requirement phủ (AC) | FR-03, FR-05, FR-06, FR-10, FR-11, FR-13, FR-14, FR-15, FR-17, FR-22 (`Xiangqi_Arena_Requirements.md`) |
| Kiểu test | Test hệ thống, thủ công, đóng vai 2 người chơi trên 2 trình duyệt (hoặc 1 cửa sổ thường + 1 cửa sổ ẩn danh) |
| Ngày soạn | 21/10/2026 |
| Trạng thái | **Chưa chạy.** Bộ TC soạn trước để chạy khi build release 1.1 có đủ chức năng (xem cột *Chặn bởi*) |

## 1. Môi trường và dữ liệu

- Backend + PostgreSQL: `corepack pnpm dev` (cổng 3000). Web: `corepack pnpm --filter @xiangqi-arena/web dev -- --port 3001`.
- Tài khoản seed: **A** = `player1`, **B** = `player2`, **C** = `admin` (dùng làm người thứ 3), mật khẩu theo `apps/server/README.md`.
- Mỗi TC bắt đầu khi A, B, C không ở phòng nào đang chờ/đang chơi (kiểm bằng `GET /rooms/current` trả `{ "room": null }`).
- RuleProfile mặc định `VN_STANDARD`: 10 phút mỗi bên, không cộng giờ, không tính Elo.
- Khi một TC cần kiểm dữ liệu đã lưu, dùng `corepack pnpm db:studio`.

## 2. Ma trận phủ requirement

| Requirement | Test case |
|---|---|
| FR-03 Đăng xuất | TC-SYS-01, 02, 03, 04, 05 |
| FR-05 Tạo phòng | TC-SYS-06, 07, 08, 11, 12 |
| FR-06 Tham gia phòng | TC-SYS-07, 09, 10, 13, 14, 15 |
| FR-10 Đồng bộ realtime | TC-SYS-16, 19, 20, 21 |
| FR-11 Lượt chơi | TC-SYS-16, 17, 18 |
| FR-13 Kết thúc trận | TC-SYS-22, 23, 28, 29, 30 |
| FR-14 Xin thua | TC-SYS-24, 25 |
| FR-15 Xin hòa | TC-SYS-26, 27 |
| FR-17 Lịch sử | TC-SYS-34, 35, 36 |
| FR-22 Mất kết nối | TC-SYS-31, 32, 33 |

## 3. Phụ thuộc chức năng (cột *Chặn bởi*)

| Ticket | Nội dung | Ghi chú tại 21/10 |
|---|---|---|
| XQA-66 / XQA-67 | Refresh token, logout, route guard | Có PR, chờ review |
| XQA-69 | Room REST | Có PR, chờ review |
| XQA-70 | Màn Sảnh | Jira ghi Done nhưng chưa thấy code trên GitHub |
| XQA-71 | Màn Phòng chờ + vào ván | Có PR, chờ review |
| XQA-72 | Link mời phòng riêng tư | Jira ghi Done nhưng chưa thấy code trên GitHub |
| XQA-74, XQA-75, XQA-76 | GameService, socket game events, FE đi quân online | Chưa làm |
| XQA-90 | GameService kết thúc ván + lưu kết quả | Chưa làm |
| XQA-91, XQA-92 | Xin hòa / xin thua (BE, FE) | Chưa làm |
| XQA-93, XQA-94 | Mất kết nối / vào lại ván 60 giây (BE, FE) | Chưa làm |
| XQA-97, XQA-98 | History API, trang Lịch sử | Chưa làm |
| XQA-141, XQA-142 | Đồng hồ server-side, hiển thị đồng hồ | Hạn 11–13/11, ngoài release 1.1 |
| XQA-78, XQA-95 | RepetitionJudge phần 1, phần 2 (Điều 23) | Phần 1 có PR |

## 4. Test case

Cột *Actual* và *Status* để trống cho tới khi chạy. *Status*: Pass / Fail / Blocked / Not Run.

### A. Phiên đăng nhập và đăng xuất – FR-03

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-SYS-01 | FR-03 | Chưa đăng nhập, trình duyệt sạch | 1. Mở `/lobby` | – | Chuyển tới `/login?next=%2Flobby`, không thấy nội dung Sảnh | | Not Run | XQA-67 |
| TC-SYS-02 | FR-02, FR-03 | Đang ở `/login?next=%2Flobby` | 1. Đăng nhập A | `player1` / mật khẩu seed | Vào thẳng `/lobby` (không về trang chủ) | | Not Run | XQA-67, XQA-70 |
| TC-SYS-03 | FR-03 | A đã đăng nhập, mở 2 tab cùng ở `/lobby` | 1. Tab 1 bấm Đăng xuất. 2. Quan sát tab 2. 3. Ở tab 1 mở lại `/lobby` | – | Tab 1 về `/login`; tab 2 cũng tự về `/login`; mở `/lobby` lại bị chuyển về `/login` | | Not Run | XQA-66, XQA-67 |
| TC-SYS-04 | FR-03 | A đã đăng nhập; trước khi đăng xuất, sao chép access token trong DevTools → Application → Local Storage (`xiangqi-arena.accessToken`) | 1. Đăng xuất. 2. Gọi `GET /auth/me` bằng token đã sao chép (Postman) | Token cũ | `401`, `code = AUTH_SESSION_REVOKED` – token bị vô hiệu dù chưa hết 15 phút | | Not Run | XQA-66 |
| TC-SYS-05 | XQA-19 AC1 | A đã đăng nhập, đang ở Phòng chờ | 1. Chờ quá 15 phút (hoặc sửa `xiangqi-arena.expiresAt` trong Local Storage về thời điểm đã qua). 2. Thao tác tiếp (rời phòng / tải lại phòng) | – | Thao tác thành công, không bị đưa về `/login`; Network có 1 request `POST /auth/refresh` | | Not Run | XQA-66, XQA-67 |

### B. Phòng chơi – FR-05, FR-06

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-SYS-06 | FR-05 | A, B đã đăng nhập, B đang ở Sảnh | 1. A tạo phòng với lựa chọn mặc định | – | A vào Phòng chờ: tên "Phòng của …", mã 8 ký tự, trạng thái chờ, ô Đối thủ "Đang chờ…", thời gian "10 phút mỗi bên". Trong ≤ 3 giây phòng xuất hiện ở Sảnh của B | | Not Run | XQA-69, XQA-70, XQA-71 |
| TC-SYS-07 | FR-05, FR-06 | A, B đã đăng nhập | 1. A tạo phòng **Riêng tư**. 2. B xem Sảnh. 3. A bấm "Sao chép link mời", gửi B. 4. B mở link | Visibility = PRIVATE | Bước 2: phòng không có ở Sảnh. Bước 4: B vào được phòng, cả 2 chuyển sang màn ván cờ | | Not Run | XQA-69, XQA-70, XQA-71 |
| TC-SYS-08 | FR-05 | A, B đã đăng nhập | Chạy 3 lần, mỗi lần A tạo phòng với một lựa chọn màu, B vào phòng | Màu chủ phòng = Đỏ / Đen / Ngẫu nhiên | Đỏ: A cầm Đỏ, bàn của A có quân Đỏ ở dưới. Đen: A cầm Đen, bàn của A xoay phía Đen. Ngẫu nhiên: mỗi người đúng 1 màu, hai màu khác nhau | | Not Run | XQA-69, XQA-70, XQA-71 |
| TC-SYS-09 | FR-06 | A đang ở Phòng chờ (WAITING) | 1. B vào phòng từ Sảnh | – | B vào ván ngay; màn Phòng chờ của A tự chuyển sang màn ván cờ trong ≤ 3 giây, không cần bấm gì | | Not Run | XQA-69, XQA-70, XQA-71 |
| TC-SYS-10 | FR-06 | A và B đang chơi trong phòng X | 1. C mở link phòng X | Mã phòng X | C thấy "Phòng đã đủ 2 người.", không vào được ván, ván của A–B không bị ảnh hưởng | | Not Run | XQA-69, XQA-71 |
| TC-SYS-11 | FR-05 | A đang ở Phòng chờ, B đang xem Sảnh | 1. A bấm "Rời phòng" | – | A về Sảnh; phòng biến mất khỏi Sảnh của B; B mở link phòng đó thấy "Phòng đã kết thúc hoặc đã bị hủy." | | Not Run | XQA-69, XQA-70, XQA-71 |
| TC-SYS-12 | FR-05 | A đang ở Phòng chờ phòng X | 1. A mở tab mới, vào Sảnh, tạo phòng khác | – | Báo "Bạn đang ở một phòng khác…"; không tạo phòng thứ 2 | | Not Run | XQA-69, XQA-70 |
| TC-SYS-13 | FR-06 | B chưa đăng nhập; A đã tạo phòng riêng tư X | 1. B mở link mời. 2. B đăng nhập | Link `/room/<mã X>` | Bước 1: về `/login?next=…`. Bước 2: vào thẳng phòng X và vào ván cùng A | | Not Run | XQA-67, XQA-71, XQA-72 |
| TC-SYS-14 | FR-06 | B đã đăng nhập | 1. Mở `/room/ZZZZZZZZ` | Mã không tồn tại | Báo "Không tìm thấy phòng…", có đường về Sảnh | | Not Run | XQA-71 |
| TC-SYS-15 | FR-06 | A đang chờ ở phòng X; B và C đã mở sẵn Sảnh | 1. B và C bấm vào phòng X cùng lúc (đếm 3-2-1) | – | Đúng 1 người vào được; người kia thấy "Phòng đã đủ 2 người."; phòng X có đúng 2 thành viên | | Not Run | XQA-69, XQA-70 |

### C. Chơi online, lượt, đồng bộ – FR-10, FR-11

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-SYS-16 | FR-10, FR-11 | A (Đỏ) và B (Đen) vừa vào ván | 1. A đi Pháo đầu. 2. Đo thời gian tới khi B thấy nước | `h7e7` (Pháo 2 bình 5) | Bàn của B cập nhật trong ≤ 500 ms (NFR-01); lượt chuyển sang Đen trên cả 2 máy | | Not Run | XQA-74, XQA-75, XQA-76 |
| TC-SYS-17 | FR-11 | Tới lượt Đỏ (A) | 1. B cố chọn và đi một quân Đen | – | B không đi được; bàn 2 bên không đổi | | Not Run | XQA-74, XQA-75, XQA-76 |
| TC-SYS-18 | FR-11, BR-02 | Tới lượt Đỏ (A) | 1. A bấm vào quân Đen | – | Không chọn được quân đối phương, không hiện nước gợi ý | | Not Run | XQA-76 |
| TC-SYS-19 | FR-09, FR-10, BR-03 | Tới lượt Đỏ | 1. Dùng DevTools/Postman gửi thẳng lên server một nước sai luật (bỏ qua giao diện) | Xe đi chéo `a9b8` | Server từ chối, trả lỗi; bàn cờ 2 bên không đổi; vẫn tới lượt Đỏ | | Not Run | XQA-74, XQA-75 |
| TC-SYS-20 | FR-10, FR-12 | Ván đang chơi | 1. A đi một nước chiếu Tướng Đen | – | Cả 2 máy hiện trạng thái "chiếu"; B chỉ đi được nước giải chiếu | | Not Run | XQA-74, XQA-75, XQA-76 |
| TC-SYS-21 | FR-10 | Ván đang chơi | 1. A bấm đi cùng một nước 2 lần thật nhanh (hoặc gửi lại cùng request) | Nước trùng | Nước chỉ được ghi 1 lần; số nước và lượt trên 2 máy giống nhau | | Not Run | XQA-74, XQA-75 |

### D. Kết thúc ván – FR-13, FR-14, FR-15

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-SYS-22 | FR-13 | Ván đang chơi, dựng tới thế Đỏ có nước chiếu bí | 1. A đi nước chiếu bí | – | Cả 2 máy hiện hộp thoại kết thúc "Đỏ thắng – chiếu bí"; bản ghi Match: `status = FINISHED`, `result = RED_WIN`, `end_reason = CHECKMATE`; phòng `FINISHED` | | Not Run | XQA-74, XQA-75, XQA-76, XQA-90 |
| TC-SYS-23 | FR-13, Điều 7.1b | Thế cờ: Đen không bị chiếu nhưng hết nước đi hợp lệ sau nước của Đỏ | 1. A đi nước làm Đen hết nước | – | Đen bị xử thua (hết nước); `result = RED_WIN`. Ghi chú: schema đang dùng giá trị `STALEMATE` cho lý do này | | Not Run | XQA-74, XQA-90 |
| TC-SYS-24 | FR-14 | Ván đang chơi | 1. B bấm Xin thua. 2. Xác nhận | – | Ván kết thúc ngay; A thắng; cả 2 thấy kết quả; `end_reason = RESIGNATION` | | Not Run | XQA-91, XQA-92, XQA-90 |
| TC-SYS-25 | FR-14 | Ván đang chơi | 1. B bấm Xin thua. 2. Bấm Hủy ở hộp xác nhận | – | Ván tiếp tục bình thường; A không nhận được thông báo gì | | Not Run | XQA-92 |
| TC-SYS-26 | FR-15 | Ván đang chơi | 1. A bấm Xin hòa. 2. B bấm Đồng ý | – | Ván kết thúc hòa; `result = DRAW`, `end_reason = DRAW_AGREEMENT` | | Not Run | XQA-91, XQA-92, XQA-90 |
| TC-SYS-27 | FR-15 | Ván đang chơi | 1. A bấm Xin hòa. 2. B bấm Từ chối | – | A nhận thông báo bị từ chối; ván tiếp tục, lượt không đổi | | Not Run | XQA-91, XQA-92 |
| TC-SYS-28 | FR-13, BR-05 | Ván vừa kết thúc (sau TC-SYS-22/24/26) | 1. Gửi thêm một nước lên server (DevTools/Postman) | Nước bất kỳ | Server từ chối; kết quả ván không đổi | | Not Run | XQA-74, XQA-90 |
| TC-SYS-29 | FR-13, Điều 23 Điểm 1 | Thế cờ: Xe Đỏ chiếu liên tục, Tướng Đen chạy qua lại (theo test `rules-repetition.spec.ts`, thế "CHIẾU MÃI") | 1. Hai bên lặp chu kỳ 4 nửa nước tới khi thế cờ xuất hiện lần thứ 3 | – | Đỏ bị xử thua do chiếu mãi; `end_reason = REPETITION` | | Not Run | XQA-78, XQA-74, XQA-90 |
| TC-SYS-30 | FR-13, FR-16 | Ván đang chơi, dùng RuleProfile có thời gian ngắn để test | 1. Đỏ không đi tới khi đồng hồ Đỏ về 0 | – | Đỏ thua do hết giờ; `end_reason = TIMEOUT` | | Not Run | XQA-141, XQA-142 (ngoài release 1.1) |

### E. Mất kết nối – FR-22

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-SYS-31 | FR-22, NFR-07 | Ván đang chơi, đã đi ≥ 4 nước | 1. B tải lại trang (F5) | – | B quay lại đúng ván, bàn cờ đúng thế hiện tại, đúng lượt | | Not Run | XQA-93, XQA-94 |
| TC-SYS-32 | FR-22 | Ván đang chơi | 1. Tắt mạng máy B (DevTools → Offline) 30 giây. 2. Bật lại | – | A thấy thông báo đối thủ mất kết nối; B thấy banner mất kết nối; bật mạng lại thì ván tiếp tục, không mất nước nào | | Not Run | XQA-93, XQA-94 |
| TC-SYS-33 | FR-22 | Ván đang chơi | 1. Tắt mạng máy B quá 60 giây | – | A được xử thắng; `end_reason = DISCONNECT` | | Not Run | XQA-93, XQA-90 |

### F. Lịch sử ván – FR-17

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-SYS-34 | FR-17 | A và B vừa xong 1 ván (TC-SYS-22) | 1. A mở trang Lịch sử | – | Ván mới nhất ở đầu, có: đối thủ (B), kết quả (thắng), thời gian chơi, số nước, thời điểm | | Not Run | XQA-97, XQA-98 |
| TC-SYS-35 | FR-17 | Như trên | 1. B mở trang Lịch sử | – | Cùng ván đó, kết quả hiển thị là thua; số nước giống bên A | | Not Run | XQA-97, XQA-98 |
| TC-SYS-36 | FR-17 | Như trên | 1. A mở chi tiết ván | – | Danh sách nước đúng thứ tự đã đi; cột thay đổi rating hiển thị 0 hoặc "không tính" vì `VN_STANDARD` không tính Elo | | Not Run | XQA-97, XQA-98 |

## 5. Vấn đề cần chốt trước khi chạy

| # | Vấn đề | Ảnh hưởng | Đề xuất |
|---|---|---|---|
| 1 | Trong 60 giây chờ kết nối lại, đồng hồ của người mất kết nối có chạy tiếp không (đã nêu trong mục lục sơ đồ thiết kế, chưa chốt) | TC-SYS-32, 33 | PM/BA chốt trước XQA-93 |
| 2 | FR-13 dùng `DRAW`/`TIMEOUT`, FR-16 dùng `LOSE_BY_TIMEOUT`; schema dùng `MatchEndReason` (`TIMEOUT`, `STALEMATE`…). Lý do "hết nước" (Điều 7.1b) đang map vào `STALEMATE` | TC-SYS-23, 30 | Thống nhất tên trong SRS v2 (XQA-84) |
| 3 | XQA-70 và XQA-72 ghi Done trên Jira nhưng chưa có code trên GitHub | TC-SYS-02, 06–13, 15 | PM nhắc Khiêm, Nhân push code |
| 4 | Contract Socket.IO (XQA-60) chưa có trong repo | Nhóm C, D, E | Kiệt đưa contract vào `docs/api/` để QA viết bước test chính xác theo tên sự kiện |
