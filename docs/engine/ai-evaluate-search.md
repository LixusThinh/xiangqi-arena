# AI: hàm đánh giá + Minimax Alpha-Beta + 3 mức độ khó (XQA-80, XQA-81, XQA-100)

Code: `packages/xiangqi-core/src/ai/` · Test: `packages/xiangqi-core/tests/ai-evaluate.spec.ts`, `ai-search.spec.ts` · Story XQA-23, XQA-28 · Epic XQA-7.

## 1. Vì sao đặt trong `xiangqi-core`

AI chỉ cần sinh nước hợp lệ và áp/hoàn nước của engine, không phụ thuộc Nest/React/DB. Đặt ở `src/ai/` để test chạy luôn trong job CI hiện có (CI đang gọi riêng từng package). Khi AI lớn lên (mức độ khó, opening book, chạy trong Web Worker) có thể tách thành package `xiangqi-ai`; khi đó phải thêm bước test vào CI.

## 2. Hàm đánh giá – `evaluate(position)` (XQA-80)

Điểm theo góc nhìn **bên tới lượt** (quy ước negamax): dương là bên tới lượt đang hơn.

### Giá trị quân (có nguồn)

Bảng "consensus" nhân 100:

| Quân | Giá trị | Ghi chú |
|---|---|---|
| Xe | 900 | |
| Pháo | 450 | |
| Mã | 400 | |
| Tượng | 250 | |
| Sĩ | 200 | |
| Tốt chưa qua sông | 100 | |
| Tốt đã qua sông | 200 | về lại 100 khi xuống hàng đáy đối phương |
| Tướng | không tính | mất Tướng = hết nước, xử trong tìm kiếm |

Nguồn:
- pychess.org, trang Xiangqi, mục *Piece Values*: Xe 9, Mã 4, Pháo 4.5, Tốt 1 trước sông hoặc ở hàng cuối và 2 sau khi qua sông, Sĩ 2, Tượng 2.5.
- xiangqi.com, bài *The Value of the Pieces in Xiangqi (Chinese Chess)*: cùng bảng, ghi Tượng 2 hoặc 2.5 và Xe 9 đến 10; bài cũng nói các con số này mang tính quy ước và lý thuyết tàn cuộc có thể thay đổi đánh giá.

Nhóm chọn Tượng = 2.5 theo pychess.

### Thưởng vị trí (heuristic của nhóm, không có nguồn ngoài)

Cố ý nhỏ (tối đa vài chục điểm) để AI không đổi quân lấy vị trí:
- Mã: +6 mỗi cột gần cột giữa, +15 khi đã qua sông.
- Pháo: +4 mỗi cột gần cột giữa.
- Xe: +3 mỗi cột gần cột giữa, +10 khi đã qua sông.
- Tốt đã qua sông: +5 mỗi cột gần cột giữa, +20 khi ở 3 cột giữa và áp sát cung đối phương.

Bảng giá trị vị trí chi tiết kiểu ElephantEye có thể thay vào sau (XQA-100), nhớ ghi nguồn.

### Kiểm thử (AC XQA-80)

- Đối xứng Đỏ/Đen: đảo màu + lật bàn + đổi bên đi → điểm không đổi, kiểm trên 40 thế cờ sinh ngẫu nhiên có seed.
- Đối xứng trái–phải, đổi dấu khi đổi bên đi, thế khởi đầu = 0, mất Xe ≈ −900.

## 3. Tìm kiếm – `searchBestMove(position, { depth, maxTimeMs? })` (XQA-81)

- Negamax + cắt tỉa Alpha-Beta, độ sâu tính theo nửa nước.
- Chỉ duyệt `position.generateLegalMoves()` → không bao giờ trả nước sai luật (AC1).
- Sắp xếp nước MVV-LVA: ăn quân giá trị cao bằng quân giá trị thấp trước.
- Hết nước hợp lệ = bên tới lượt thua (chiếu bí hoặc hết nước, Điều 7.1). Điểm thắng `MATE_SCORE − ply` để ưu tiên thắng sớm.
- Nút lá chỉ chấm điểm, không sinh nước. Đánh đổi: thế hết nước đúng ở nút lá chấm theo vật chất; đổi lại, độ sâu 3 từ thế khởi đầu chạy khoảng 0,1 giây trên máy dev, giữa ván dưới 0,2 giây (AC2 yêu cầu ≤ 2 giây).
- `maxTimeMs` (tùy chọn): quá giờ thì dừng và trả nước tốt nhất đã tìm (`timedOut: true`).
- Chưa có: quiescence search, bảng transposition, iterative deepening, xét lặp nước Điều 23 trong cây (KHÔNG nằm trong XQA-100, xem mục 4.4).

### Bộ thế cờ kiểm tra "không bỏ nước ăn Xe miễn phí" (XQA-23 AC2)

Xe ăn Xe theo cột · Mã ăn Xe · Pháo ăn Xe qua ngòi · Đen ăn Xe Đỏ · Thế có nước chiếu thêm nhịp (AI có thể chiếu trước rồi vẫn ăn Xe). Kèm thế "tránh mất quân": không lấy Xe ăn Tốt có Xe bảo vệ.

## 4. Ba mức độ khó – `chooseAiMove(position, level, rng?)` (XQA-100)

Code: `packages/xiangqi-core/src/ai/levels.ts`, `self-play.ts`, tùy chọn `noise` trong `search.ts` · Test: `tests/ai-levels.spec.ts` · Story XQA-28 · Benchmark: [`ai-levels-benchmark.md`](./ai-levels-benchmark.md).

### 4.1 Cấu hình

Cả 3 mức dùng chung bộ tìm kiếm Minimax + Alpha-Beta ở mục 3, chỉ khác 3 tham số:

| Mức | Độ sâu (nửa nước) | Trần thời gian / nước | Nhiễu |
|---|---|---|---|
| Dễ (`easy`) | 1 | 300 ms | 150 |
| Trung bình (`medium`) | 2 | 1000 ms | 40 |
| Khó (`hard`) | 3 | 2000 ms | 0 |

Đây là cấu hình khởi điểm do nhóm chọn, **không có nguồn ngoài**; giá trị được chọn trước khi chạy benchmark và không chỉnh theo kết quả. Sửa ở `AI_LEVELS` rồi chạy lại benchmark.

### 4.2 Nhiễu (`SearchOptions.noise`)

Mỗi nước ở gốc được cộng một số ngẫu nhiên đều trong [−noise, +noise] rồi mới chọn nước tốt nhất; đơn vị cùng điểm đánh giá (Tốt chưa qua sông = 100). Hệ quả:

- Dễ bỏ lỡ nước chỉ hơn vài chục điểm, nhưng ăn quân lớn miễn phí thì vẫn ăn (Xe 900 ≫ nhiễu 150). Điểm mate (±100000) lớn hơn mọi nhiễu hợp lý nên nước thắng thấy được không bị bỏ lỡ.
- Dễ "tham ăn": từ thế khởi đầu, Pháo Đỏ ăn được Mã Đen (+400 > nhiễu 150) nên Dễ luôn chọn nước đó (có test).
- Có nhiễu thì phải chấm chính xác từng nước gốc (cửa sổ đầy đủ, không thu hẹp alpha), nên chậm hơn Alpha-Beta thuần; không đáng kể ở độ sâu 1–2 của Dễ/Trung bình. Mức Khó không nhiễu nên giữ nguyên cắt tỉa.
- Điểm trả về trong `SearchResult.score` là điểm thật của nước được chọn, không cộng nhiễu.
- Truyền `rng` có seed (`mulberry32(seed)`) để lặp lại được; mặc định `Math.random`.

### 4.3 Benchmark tự đấu (AC XQA-100: Khó thắng Dễ ≥ 70% / 20 ván)

Chạy: `pnpm --filter @xiangqi-arena/xiangqi-core build` rồi `pnpm --filter @xiangqi-arena/xiangqi-core ai:benchmark -- --md ../../docs/engine/ai-levels-benchmark.md`. Báo cáo đầy đủ (từng ván, thời gian) do script sinh, không sửa tay.

Điều kiện: 20 ván mỗi cặp, chia đều màu, hai ván đổi màu dùng chung seed; 4 nửa nước đầu đi ngẫu nhiên có seed; hết nước hợp lệ hoặc RepetitionJudge (Điều 23) kết thúc ván; trần 240 nửa nước tính hòa (quy ước của benchmark, **không phải luật cờ**). Tỉ lệ thắng = số ván thắng / 20, hòa không tính là thắng.

| Cặp (mạnh vs yếu) | Thắng | Thua | Hòa | Tỉ lệ thắng |
|---|---|---|---|---|
| Khó vs Dễ | 18 | 1 | 1 | **90%** (đạt AC) |
| Khó vs Trung bình | 16 | 4 | 0 | 80% |
| Trung bình vs Dễ | 20 | 0 | 0 | 100% |

Độ nhạy theo seed (Khó vs Dễ, 20 ván mỗi dòng, chạy `--match hard:easy --seed N`), để chắc kết quả không do may mắn của một seed:

| Seed gốc | Khó thắng | Khó thua | Hòa | Tỉ lệ |
|---|---|---|---|---|
| 2026 | 18 | 1 | 1 | 90% |
| 1 | 19 | 1 | 0 | 95% |
| 7 | 19 | 1 | 0 | 95% |
| 99 | 19 | 1 | 0 | 95% |
| 12345 | 18 | 2 | 0 | 90% |
| 777 | 19 | 1 | 0 | 95% |

Thời gian: Khó trung bình 9 ms/nước khi đấu Dễ và 12 ms khi đấu Trung bình, tối đa theo ván 26 ms, trên máy chạy benchmark (Xeon 2.8 GHz, 2 luồng); không lần nào bị cắt giờ. Còn rất dư so với trần 2000 ms. Thời gian phụ thuộc máy; kết quả thắng/thua (theo seed) thì không.

Test trong CI (`ai-levels.spec.ts`) chỉ chạy bản rút gọn 10 ván đầu của benchmark làm lưới chặn hồi quy, vì chạy 20 ván trong jest chậm hơn nhiều so với chạy script.

### 4.4 Hạn chế đã biết

1. **AI chưa biết luật lặp nước (Điều 23).** Tìm kiếm không nhìn lịch sử thế cờ nên Khó có thể tự lặp nước phạm luật và bị RepetitionJudge xử thua. Trong benchmark: cả 2 ván Khó không thắng Dễ (seed gốc 2026) đều kết thúc vì lặp nước, và 2 trong 4 ván Khó thua Trung bình cũng vậy (2 ván còn lại thua do chiếu bí). AC vẫn đạt, nhưng khi chơi với người thì Khó dễ bị lặp nước. Cách sửa (chưa làm, cần task riêng): truyền lịch sử thế cờ vào tìm kiếm để tránh nước dẫn tới phạm luật, hoặc ưu tiên nước phá lặp khi đang hơn.
2. Benchmark chỉ so sánh **tương đối giữa 3 mức**, không đo sức mạnh so với người hay với engine khác.
3. Hai quy ước chỉ của benchmark: khai cuộc 4 nửa nước ngẫu nhiên và trần 240 nửa nước. Ván thật không có hai quy ước này.
4. Khó dùng độ sâu 3 đang dư thời gian nhiều; nâng độ sâu có thể khả thi (đo sơ bộ độ sâu 4 khoảng 80 ms/nước trên vài thế giữa ván ngẫu nhiên, chưa benchmark) nhưng chưa làm vì ngoài yêu cầu XQA-100 và đổi độ khó cần benchmark lại.
5. Chưa có: quiescence search, bảng transposition, iterative deepening, opening book, chạy trong Web Worker (task FE riêng bị chặn bởi XQA-100).
