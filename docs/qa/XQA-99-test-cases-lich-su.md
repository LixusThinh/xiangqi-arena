# Test case Lịch sử ván đấu – FR-17 (XQA-99)

| Mục | Nội dung |
|---|---|
| Ticket | XQA-99 – QA: test case Lịch sử ván (FR-17) · Story XQA-27 |
| Requirement | FR-17 (`Xiangqi_Arena_Requirements.md`), quy tắc H-01…H-06 của `docs/api/history.md` |
| Phạm vi | API `GET /me/matches`, `GET /me/matches/:id` (XQA-97, đã merge PR #27) và trang `/history` (XQA-98, PR #36) |
| Kiểu test | API (Postman / curl) + giao diện, thủ công |
| Ngày soạn | 28/10/2026 |
| Trạng thái | **Chưa chạy.** Cột *Actual* / *Status* để trống. *Status*: Pass / Fail / Blocked / Not Run |

## 1. Môi trường và dữ liệu

- Backend + PostgreSQL như `docs/qa/XQA-87-system-test-cases-release-1.1.md` mục 1. Web cổng 3001.
- Tài khoản: **A** = `player1`, **B** = `player2`, **C** = `admin` (dùng như người chơi thứ 3, không phải ván của A/B).
- Tạo ván đã kết thúc nhanh nhất: A tạo phòng, B vào, A **xin thua** (`POST /matches/:id/resign` hoặc nút Xin thua – XQA-91/92). Ván hòa: A đề nghị hòa, B đồng ý.
- Ván "41 nửa nước": dùng `prisma studio` sửa `current_ply`/thêm `moves` **không được** (sai dữ liệu). Thay vào đó đi thật 41 nửa nước, hoặc chạy TC-HIS-08 trên dữ liệu e2e (`apps/server/test/history.e2e.spec.ts`).

## 2. Ma trận phủ

| Nội dung FR-17 / contract | Test case |
|---|---|
| Opponent, Result | TC-HIS-01, 07, 14 |
| Time, Game Duration | TC-HIS-14 |
| Number of Moves | TC-HIS-08 |
| Phân trang | TC-HIS-02, 03, 04, 15 |
| User chưa có ván | TC-HIS-05 |
| Quyền truy cập (H-01) | TC-HIS-10, 11, 13 |
| Chỉ ván FINISHED (H-02) | TC-HIS-06, 12, 16 |
| Mở lại trận xem danh sách nước | TC-HIS-09 (API). **UI chưa có** – xem mục 4 |
| Rating Change | TC-HIS-17 (API trả `null` khi chưa có Elo). **UI chưa có cột** – xem mục 4 |

## 3. Test case

| TC | Req | Tiền điều kiện | Bước thực hiện | Input | Expected | Actual | Status | Chặn bởi |
|---|---|---|---|---|---|---|---|---|
| TC-HIS-01 | FR-17, H-03 | A có 3 ván FINISHED kết thúc lúc t1 < t2 < t3 | 1. Đăng nhập A. 2. `GET /me/matches` | không query | `200`. `page=1`, `pageSize=20`, `total=3`, `totalPages=1`. `items` có 3 phần tử, thứ tự ván t3, t2, t1. Mỗi item có `opponent`, `outcome`, `result`, `endReason`, `plyCount`, `endedAt`, `durationSec` | | Not Run | – |
| TC-HIS-02 | FR-17 | A có 25 ván FINISHED | `GET /me/matches?page=2&pageSize=20` | page=2, pageSize=20 | `200`, `items` 5 phần tử, `total=25`, `totalPages=2`. Không trùng ván nào với trang 1 | | Not Run | – |
| TC-HIS-03 | FR-17 | Như TC-HIS-02 | `GET /me/matches?page=9` | page=9 | `200`, `items: []`, `total=25`, `totalPages=2` (trang vượt quá không phải lỗi) | | Not Run | – |
| TC-HIS-04 | FR-17 | A đã đăng nhập | Gọi lần lượt 4 request | `pageSize=51`; `pageSize=0`; `page=0`; `page=abc` | Cả 4 trả `400`, `code = VALIDATION_ERROR`, `details[].field` là `pageSize` / `page` tương ứng | | Not Run | – |
| TC-HIS-05 | FR-17 | Tài khoản mới D, chưa chơi ván nào | 1. `GET /me/matches`. 2. Mở `/history` | – | API: `200`, `items: []`, `total=0`. UI: dòng "Bạn chưa chơi xong ván nào.", Tổng số ván = 0, "Trang 1/1", hai nút phân trang bị khóa | | Not Run | XQA-98 |
| TC-HIS-06 | H-02 | A đang chơi 1 ván ACTIVE với B, ngoài ra 0 ván xong | `GET /me/matches` | – | `total=0`. Ván đang chơi không xuất hiện | | Not Run | – |
| TC-HIS-07 | FR-17, H-04 | Ván 1: A (Đỏ) thắng B. Ván 2: A và B hòa | `GET /me/matches` bằng A rồi bằng B | – | Ván 1: A thấy `outcome=WIN`, B thấy `LOSS`, cả hai thấy `result=RED_WIN`. Ván 2: cả hai `DRAW`, `endReason=DRAW_AGREEMENT`. `opponent` của A là B và ngược lại | | Not Run | XQA-91 |
| TC-HIS-08 | FR-17, H-05 | Có ván đã đi 41 nửa nước rồi kết thúc | 1. `GET /me/matches`. 2. Mở `/history` | – | API `plyCount = 41`. UI cột Số nước hiện **21** (`ceil(41/2)`) | | Not Run | XQA-98 |
| TC-HIS-09 | FR-17 ("mở lại trận") | A có ván FINISHED id = X | `GET /me/matches/X` | id = X | `200`. Có `initialFen`, `finalFen`, `moves[]` đúng số nước, mỗi nước có `ply`, `color` (ply lẻ = RED), `from`, `to`, `piece`, `fenAfter`. `fenAfter` của nước cuối = `finalFen` | | Not Run | – |
| TC-HIS-10 | H-01 | Ván X là ván giữa A và B, C không chơi | Đăng nhập C, `GET /me/matches/X` | id = X | `404`, `code = HISTORY_NOT_FOUND`. Body **giống hệt** TC-HIS-11 (không lộ ván có tồn tại) | | Not Run | – |
| TC-HIS-11 | H-01 | – | Đăng nhập A, gọi 2 request | `GET /me/matches/999999`; `GET /me/matches/abc` | Cả 2 trả `404 HISTORY_NOT_FOUND` | | Not Run | – |
| TC-HIS-12 | H-02 | A đang chơi ván ACTIVE id = Y | `GET /me/matches/Y` | id = Y | `404 HISTORY_NOT_FOUND` (ván đang chơi đọc qua `GET /matches/:id`) | | Not Run | – |
| TC-HIS-13 | H-01 | Không đăng nhập | 1. `GET /me/matches` không header Authorization. 2. Mở `/history` ở trình duyệt chưa đăng nhập | – | API `401`. UI chuyển tới `/login?next=%2Fhistory` | | Not Run | – |
| TC-HIS-14 | FR-17 | A có 1 ván thua do xin thua, kết thúc lúc 08:12:30 UTC, kéo dài 750 giây | Mở `/history` | – | Dòng ván: Thời gian `20/10/2026 15:12` (giờ Việt Nam), Đối thủ = tên hiển thị của B + "Bạn cầm Đỏ/Đen", Kết quả "Thua" + "Xin thua", Thời lượng "12 phút 30 giây" | | Not Run | XQA-98 |
| TC-HIS-15 | FR-17 | A có 25 ván | Mở `/history`, bấm "Trang sau", rồi "Trang trước" | – | Trang 1: "Trang 1/2", nút Trang trước khóa. Sau Trang sau: 5 dòng, "Trang 2/2", nút Trang sau khóa. Trang trước quay về 20 dòng | | Not Run | XQA-98 |
| TC-HIS-16 | H-02, BR-RECON-01 | Ván Z giữa A và B: cả hai cùng mất kết nối quá 60 giây → `ABORTED` | `GET /me/matches` bằng A | – | Ván Z **không** xuất hiện. *Chờ PM duyệt BR-RECON-01* – nếu PM chọn khác thì sửa TC | | Not Run | XQA-93 |
| TC-HIS-17 | FR-17, H-06 | Ván RuleProfile `VN_STANDARD` (không tính Elo) | `GET /me/matches/X` | id = X | `ratingChange = null` | | Not Run | – |

## 4. Khoảng trống phát hiện khi soạn TC (chuyển PM/BA)

| # | Khoảng trống | Ảnh hưởng | Đề xuất |
|---|---|---|---|
| 1 | FR-17 yêu cầu hiện **Rating Change**, trang `/history` chưa có cột này vì chưa có Elo (Sprint 6) | TC-HIS-14 không kiểm được Rating Change | Thêm cột khi làm Elo; hiện "không tính" cho ván `ratingChange = null` |
| 2 | FR-17 "có thể mở lại trận để xem danh sách nước đi": API có (TC-HIS-09), UI chưa có màn chi tiết | Chưa test được trên UI | Gộp vào Replay (XQA-33) |
| 3 | Ván `ABORTED` có hiện trong lịch sử không chưa có quyết định | TC-HIS-16 dựa trên đề xuất | PM chốt cùng BR-RECON-01 |
