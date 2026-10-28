# Bộ 10 thế cờ mẫu (FEN) cho demo và test – XQA-113

| Mục | Nội dung |
|---|---|
| Ticket | XQA-113 – QA: bộ 10 thế cờ mẫu (FEN) cho demo và test |
| Nguồn luật | `luat_co_tuong_viet_nam.pdf` (Luật Cờ Tướng VN, QĐ 1409/2004, tài liệu tập huấn trọng tài 2015) |
| Dữ liệu máy đọc | `packages/xiangqi-core/tests/fixtures/demo-positions.fixture.json` |
| Kiểm tự động | `packages/xiangqi-core/tests/demo-positions.spec.ts` – load từng FEN và kiểm đúng điều thế cờ minh họa (13 test, chạy trên CI) |
| Ngày soạn | 28/10/2026 |

**Lưu ý về nguồn hình.** Bản text của tài liệu luật chỉ có chuỗi nước của các hình (ví dụ Hình 1: `X2.1 Tg6.1…`), không có vị trí quân. Vì vậy 9/10 thế dưới đây do nhóm **tự dựng theo đúng điều luật** ghi ở cột Nguồn, không phải chép từ hình. Chỉ FEN-01 khớp một hình (hình c). Muốn có thế đúng như hình trong tài liệu thì cần người đọc bản PDF có hình và nhập FEN (cùng việc với golden fixture XQA-79).

Ký hiệu ô: cột `a`–`i` từ trái sang phải nhìn từ phía Đỏ, hàng `0` là hàng đáy bên Đen, hàng `9` là hàng đáy bên Đỏ (giống xiangqi-core). Chữ hoa = Đỏ, chữ thường = Đen; `b`/`B` là Tượng.

| ID | Thế cờ | FEN | Nguồn (điều luật) | Dùng cho | Kết quả mong đợi |
|---|---|---|---|---|---|
| FEN-01 | Thế xếp quân ban đầu | `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1` | Điều 3, hình c – khớp Hình c (vị trí xếp quân ban đầu) | Demo màn chơi; kiểm FEN khởi đầu | Ván tiếp tục; 44 nước hợp lệ |
| FEN-02 | Chiếu bí bằng hai Xe | `R3k4/1R7/9/9/9/9/9/9/9/3K5 b - - 0 1` | Điều 7.1a (chiếu bí), Điều 6.2 (thế tự dựng) | Demo kết thúc ván CHECKMATE | Chiếu bí, Đỏ thắng; đang bị chiếu |
| FEN-03 | Hết nước đi khi không bị chiếu – bên hết nước thua | `4k4/9/4P4/9/9/3R1R3/9/9/9/3K5 b - - 0 1` | Điều 7.1b (thế tự dựng) | Demo kết thúc ván STALEMATE (khác cờ vua: bên hết nước THUA) | Hết nước đi, Đỏ thắng |
| FEN-04 | Lộ mặt tướng: Mã che giữa hai Tướng không được rời cột | `4k4/9/4n4/9/9/9/9/9/9/R3K4 b - - 0 1` | Điều 4.3a (hai Tướng không được đối mặt) (thế tự dựng) | Test: Mã e2 không có nước hợp lệ | Ván tiếp tục; quân e2 đi được: không ô nào |
| FEN-05 | Bị chiếu, Tướng chỉ còn một ô chạy (ô d0 bị Tướng Đỏ khống chế theo luật lộ mặt) | `4k4/9/9/9/2N1R4/9/9/9/9/3K5 b - - 0 1` | Điều 6.2a, Điều 4.3a (thế tự dựng) | Test ứng phó nước chiếu | Ván tiếp tục; đang bị chiếu; nước hợp lệ duy nhất: e0f0 |
| FEN-06 | Cản Mã: Mã e5 bị quân e4 cản chân | `4k4/9/9/9/4p4/4N4/9/9/9/3K5 r - - 0 1` | Điều 4.3e, hình e (minh họa cản Mã) (thế tự dựng) | Test luật cản Mã | Ván tiếp tục; quân e5 đi được: c4, c6, d7, f7, g4, g6 |
| FEN-07 | Cản Tượng: Tượng c9 bị quân d8 chặn mắt | `4k4/9/9/9/9/9/9/9/3N5/2BK5 r - - 0 1` | Điều 4.3c, hình d (minh họa cản Tượng) (thế tự dựng) | Test luật cản Tượng | Ván tiếp tục; quân c9 đi được: a7 |
| FEN-08 | Pháo ăn quân qua đúng một ngòi | `4k4/9/1n7/9/1p7/9/9/1C7/9/3K5 r - - 0 1` | Điều 4.3g (thế tự dựng) | Test Pháo: ăn b2 qua ngòi b4, không đi tới b3 | Ván tiếp tục; quân b7 đi được: a7, b2, b5, b6, b8, b9, c7, d7, e7, f7, g7, h7, i7 |
| FEN-09 | Chiếu mãi: Xe Đỏ lắc chiếu, Tướng Đen chạy | `4k4/R8/9/9/9/9/9/9/9/3K5 r - - 0 1` | Điều 23 Điểm 1, Điều 7.1g, Điều 24.2 (hình 1–3) (thế tự dựng) | Demo/test Điều 23: bên chiếu mãi bị xử thua | Ván tiếp tục; đi lặp a1a0 e0e1 a0a1 e1e0 ×2 → Đỏ thua |
| FEN-10 | Đuổi bắt mãi quân có căn thật → hòa; bỏ căn → bên đuổi thua | `3k5/9/n8/9/7R1/9/9/r8/1r7/4K4 r - - 0 1` | Điều 23 Điểm 3, Điểm 6; Điều 24.13 (hình 29–30), 24.14 (thế tự dựng) | Demo/test Điều 23: Xe đuổi Mã có căn thật → hòa | Ván tiếp tục; đi lặp h4h2 a2b4 h2h4 b4a2 ×2 → hòa |

## Cách dùng

- **Demo:** dán FEN vào bàn cờ (trang `/` có chọn thế dựng sẵn ở `apps/web/components/fen-presets.ts`; có thể thêm các FEN này vào đó khi cần).
- **Test tay:** dùng cùng FEN + cột Kết quả mong đợi làm bước kiểm.
- **Test tự động:** `pnpm --filter @xiangqi-arena/xiangqi-core test -- demo-positions`.

## AC

| AC | Tình trạng |
|---|---|
| AC1 – 10 thế, mỗi thế có nguồn | Có. Nguồn là điều luật; 9/10 là thế tự dựng (xem lưu ý trên) |
| AC2 – Quang kiểm FEN load được | Có spec tự động load + kiểm từng FEN. Quang chạy lại và xác nhận trong comment Jira |
