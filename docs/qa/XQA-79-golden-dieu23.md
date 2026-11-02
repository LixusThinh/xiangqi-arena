# Golden test Điều 23 → fixture (XQA-79)

| Mục | Nội dung |
|---|---|
| Fixture | `packages/xiangqi-core/tests/fixtures/dieu23-golden.fixture.json` |
| Runner | `packages/xiangqi-core/tests/dieu23-golden.spec.ts` (chạy cùng `pnpm --filter xiangqi-core test`) |
| Nguồn | `luat_co_tuong_viet_nam.pdf`, Điều 24, trang 19–20 (Hình 1–5) |
| Kết quả 21/10 | 5/5 hình cho đúng phán quyết như tài liệu với RepetitionJudge phần 1 (XQA-78) |

## Cách chuyển hình thành fixture

1. Đọc vị trí quân trên hình, đổi sang tọa độ xiangqi-core (cột a–i trái→phải nhìn từ phía Đỏ; "Trắng" trong tài liệu = Đỏ; hàng 0 là hàng đáy Đen).
2. Đổi biên bản ký hiệu Việt (X2.1, Tg6/1…) sang nước `from→to`. Cột của Đỏ đếm 1–9 từ phải sang trái nhìn từ phía Đỏ, của Đen đếm từ phải sang trái nhìn từ phía Đen.
3. Chạy từng nước qua engine. Nước nào bị engine từ chối nghĩa là đọc hình sai, phải sửa.
4. Lặp chu kỳ tới khi thế cờ xuất hiện lần thứ 3, rồi so phán quyết với kết luận trong tài liệu.

## Danh sách

| ID | Hình | Kết luận tài liệu | Phán quyết engine | Ghi chú |
|---|---|---|---|---|
| GT-D24-H01 | 1 | Trắng chiếu mãi → phải đổi, không đổi thua | Đỏ thua, Điểm 1 | **Hình in không có Tướng Đen**; vị trí f0 suy ra từ nước Tg6.1 / Tg6/1. Cần người đối chiếu bản in |
| GT-D24-H02 | 2 | Như trên | Đỏ thua, Điểm 1 | |
| GT-D24-H03 | 3 | Hai Xe thay nhau chiếu mãi → thua | Đỏ thua, Điểm 1 | |
| GT-D24-H04 | 4 | Vừa đỡ vừa chiếu lại, hai bên không đổi → hòa | Hòa (Điều 7.2c) | Có 2 nước chuẩn bị (X5.1, P6-5) trước chu kỳ |
| GT-D24-H05 | 5 | Hai chiếu một chiếu lại → bên chiếu mãi thua | Đỏ thua, Điểm 1 | |

## Phạm vi còn lại

Tài liệu có khoảng 107 hình. XQA-79 chuyển 5 hình đầu (nhóm chiếu mãi), đủ để có khung fixture và runner. Các hình về bắt mãi, căn thật/căn giả, đổi quân… nên làm cùng RepetitionJudge phần 2 (XQA-95) và harness XQA-96. Các hình chạm tới phần chưa cài sẽ ra `undetermined`; đưa vào fixture với `expected.kind = "undetermined"` để theo dõi tiến độ phần 2.
