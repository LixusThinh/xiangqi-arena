# Benchmark tự đấu 3 mức độ khó AI (XQA-100)

> Tạo tự động bởi `packages/xiangqi-core/scripts/ai-benchmark.js`, không sửa tay. Chạy lại bằng lệnh ở đầu file script; cùng seed + cùng cấu hình cho cùng kết quả về mặt nước đi (thời gian ms phụ thuộc máy).

## Điều kiện chạy

- Số ván mỗi cặp: 20, chia đều màu (cùng seed cho hai ván đổi màu). Seed gốc: 2026.
- Khai cuộc: 4 nửa nước đầu đi ngẫu nhiên có seed (cả hai bên), sau đó AI tự chọn nước.
- Kết thúc ván: hết nước hợp lệ (Điều 7.1) hoặc RepetitionJudge xử (Điều 23); trần 240 nửa nước tính hòa (trần này là quy ước của benchmark, KHÔNG phải luật cờ).
- Máy chạy: Node v22.23.4, Intel(R) Xeon(R) Processor @ 2.80GHz, 2 luồng.

| Mức | Độ sâu | Trần thời gian / nước | Nhiễu |
|---|---|---|---|
| easy | 1 | 300 ms | 150 |
| medium | 2 | 1000 ms | 40 |
| hard | 3 | 2000 ms | 0 |

## Kết quả

| Cặp (mạnh vs yếu) | Mạnh thắng | Yếu thắng | Hòa | Tỉ lệ thắng của bên mạnh | Số nửa nước TB | ms/nước bên mạnh (TB / tối đa theo ván) | ms/nước bên yếu (TB) | Số lần bị cắt giờ |
|---|---|---|---|---|---|---|---|---|
| hard vs easy | 18 | 1 | 1 | **90%** (18/20) | 46 | 9 / 24 | 0 | 0 |
| hard vs medium | 16 | 4 | 0 | **80%** (16/20) | 52 | 12 / 26 | 2 | 0 |
| medium vs easy | 20 | 0 | 0 | **100%** (20/20) | 54 | 2 / 4 | 0 | 0 |

## Đối chiếu Acceptance Criteria (XQA-100 / XQA-28)

- AC: Khó thắng Dễ ≥ 70% trên 20 ván → **ĐẠT** (18/20 = 90%).

## Chi tiết từng ván: hard vs easy

| Ván | Seed | Bên mạnh cầm | Kết quả | Lý do kết thúc | Số nửa nước | ms/nước mạnh | ms/nước yếu |
|---|---|---|---|---|---|---|---|
| 1 | 2026 | Đỏ | mạnh thắng | checkmate | 19 | 24 | 0 |
| 2 | 2026 | Đen | mạnh thắng | checkmate | 44 | 8 | 0 |
| 3 | 2027 | Đỏ | yếu thắng | repetition | 27 | 15 | 0 |
| 4 | 2027 | Đen | mạnh thắng | checkmate | 46 | 6 | 0 |
| 5 | 2028 | Đỏ | mạnh thắng | checkmate | 45 | 8 | 0 |
| 6 | 2028 | Đen | mạnh thắng | checkmate | 46 | 10 | 0 |
| 7 | 2029 | Đỏ | mạnh thắng | checkmate | 35 | 9 | 0 |
| 8 | 2029 | Đen | mạnh thắng | checkmate | 34 | 6 | 0 |
| 9 | 2030 | Đỏ | mạnh thắng | no_moves | 53 | 11 | 0 |
| 10 | 2030 | Đen | mạnh thắng | checkmate | 28 | 9 | 0 |
| 11 | 2031 | Đỏ | mạnh thắng | no_moves | 73 | 9 | 0 |
| 12 | 2031 | Đen | hòa | repetition | 92 | 6 | 0 |
| 13 | 2032 | Đỏ | mạnh thắng | checkmate | 35 | 13 | 0 |
| 14 | 2032 | Đen | mạnh thắng | checkmate | 34 | 8 | 0 |
| 15 | 2033 | Đỏ | mạnh thắng | checkmate | 43 | 7 | 0 |
| 16 | 2033 | Đen | mạnh thắng | no_moves | 62 | 8 | 0 |
| 17 | 2034 | Đỏ | mạnh thắng | checkmate | 47 | 10 | 0 |
| 18 | 2034 | Đen | mạnh thắng | checkmate | 94 | 5 | 0 |
| 19 | 2035 | Đỏ | mạnh thắng | checkmate | 25 | 8 | 0 |
| 20 | 2035 | Đen | mạnh thắng | checkmate | 42 | 9 | 0 |

## Chi tiết từng ván: hard vs medium

| Ván | Seed | Bên mạnh cầm | Kết quả | Lý do kết thúc | Số nửa nước | ms/nước mạnh | ms/nước yếu |
|---|---|---|---|---|---|---|---|
| 1 | 2026 | Đỏ | mạnh thắng | checkmate | 63 | 16 | 2 |
| 2 | 2026 | Đen | yếu thắng | repetition | 28 | 14 | 2 |
| 3 | 2027 | Đỏ | mạnh thắng | checkmate | 37 | 15 | 4 |
| 4 | 2027 | Đen | mạnh thắng | checkmate | 24 | 12 | 4 |
| 5 | 2028 | Đỏ | mạnh thắng | checkmate | 45 | 15 | 3 |
| 6 | 2028 | Đen | yếu thắng | checkmate | 59 | 13 | 3 |
| 7 | 2029 | Đỏ | mạnh thắng | checkmate | 59 | 9 | 1 |
| 8 | 2029 | Đen | mạnh thắng | repetition | 93 | 6 | 2 |
| 9 | 2030 | Đỏ | mạnh thắng | checkmate | 55 | 18 | 4 |
| 10 | 2030 | Đen | mạnh thắng | no_moves | 56 | 6 | 2 |
| 11 | 2031 | Đỏ | mạnh thắng | checkmate | 103 | 10 | 2 |
| 12 | 2031 | Đen | yếu thắng | checkmate | 41 | 10 | 2 |
| 13 | 2032 | Đỏ | mạnh thắng | no_moves | 71 | 11 | 2 |
| 14 | 2032 | Đen | mạnh thắng | no_moves | 44 | 6 | 2 |
| 15 | 2033 | Đỏ | mạnh thắng | checkmate | 47 | 26 | 5 |
| 16 | 2033 | Đen | mạnh thắng | checkmate | 30 | 13 | 3 |
| 17 | 2034 | Đỏ | yếu thắng | repetition | 65 | 14 | 2 |
| 18 | 2034 | Đen | mạnh thắng | checkmate | 24 | 6 | 2 |
| 19 | 2035 | Đỏ | mạnh thắng | checkmate | 39 | 8 | 2 |
| 20 | 2035 | Đen | mạnh thắng | checkmate | 48 | 7 | 2 |

## Chi tiết từng ván: medium vs easy

| Ván | Seed | Bên mạnh cầm | Kết quả | Lý do kết thúc | Số nửa nước | ms/nước mạnh | ms/nước yếu |
|---|---|---|---|---|---|---|---|
| 1 | 2026 | Đỏ | mạnh thắng | no_moves | 85 | 1 | 0 |
| 2 | 2026 | Đen | mạnh thắng | checkmate | 26 | 4 | 0 |
| 3 | 2027 | Đỏ | mạnh thắng | checkmate | 17 | 3 | 0 |
| 4 | 2027 | Đen | mạnh thắng | checkmate | 46 | 2 | 0 |
| 5 | 2028 | Đỏ | mạnh thắng | checkmate | 29 | 2 | 0 |
| 6 | 2028 | Đen | mạnh thắng | no_moves | 62 | 2 | 0 |
| 7 | 2029 | Đỏ | mạnh thắng | checkmate | 47 | 1 | 0 |
| 8 | 2029 | Đen | mạnh thắng | no_moves | 72 | 2 | 0 |
| 9 | 2030 | Đỏ | mạnh thắng | no_moves | 53 | 2 | 0 |
| 10 | 2030 | Đen | mạnh thắng | no_moves | 56 | 2 | 0 |
| 11 | 2031 | Đỏ | mạnh thắng | checkmate | 47 | 2 | 0 |
| 12 | 2031 | Đen | mạnh thắng | checkmate | 64 | 2 | 0 |
| 13 | 2032 | Đỏ | mạnh thắng | checkmate | 69 | 2 | 0 |
| 14 | 2032 | Đen | mạnh thắng | no_moves | 50 | 3 | 0 |
| 15 | 2033 | Đỏ | mạnh thắng | no_moves | 73 | 2 | 0 |
| 16 | 2033 | Đen | mạnh thắng | checkmate | 54 | 2 | 0 |
| 17 | 2034 | Đỏ | mạnh thắng | no_moves | 69 | 1 | 0 |
| 18 | 2034 | Đen | mạnh thắng | checkmate | 46 | 3 | 0 |
| 19 | 2035 | Đỏ | mạnh thắng | checkmate | 51 | 2 | 0 |
| 20 | 2035 | Đen | mạnh thắng | checkmate | 66 | 3 | 0 |
