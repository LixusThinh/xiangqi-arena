# AI 3 mức độ khó + benchmark tự đấu (XQA-100)

Code: `packages/xiangqi-core/src/ai/difficulty.ts`, `search.ts` (thêm quiescence) · Test: `tests/ai-difficulty.spec.ts` · Script: `scripts/ai-benchmark.js` · Story XQA-28 · Epic XQA-7. Tiếp nối [AI: hàm đánh giá + Minimax Alpha-Beta](./ai-evaluate-search.md).

## 1. API cho FE (XQA-101, XQA-130)

```ts
import { AI_LEVELS, AI_LEVEL_ORDER, chooseAiMove, isAiLevel, type AiLevel } from '@xiangqi-arena/xiangqi-core';

AI_LEVEL_ORDER            // ['EASY', 'MEDIUM', 'HARD'] – thứ tự hiện trên màn chọn độ khó
AI_LEVELS.EASY.label      // 'Dễ' | 'Trung bình' | 'Khó'
const { move } = chooseAiMove(position, 'HARD');          // move: Move | null (null = máy hết nước, ván đã kết thúc)
chooseAiMove(position, 'EASY', { rng: createRng(seed) });   // tái lập được (test, replay ván với máy)
chooseAiMove(position, 'HARD', { maxTimeMs: 1000 });       // ghi đè giới hạn thời gian nếu máy yếu
```

Không đổi thế cờ của người gọi. Mọi mức chỉ chọn trong `generateLegalMoves()` nên không bao giờ đi nước sai luật.

## 2. Cấu hình (AC1 XQA-28)

| Mức | `AiLevel` | Độ sâu (nửa nước) | Nhiễu | Giới hạn thời gian | Cách chọn nước |
|---|---|:-:|:-:|:-:|---|
| Dễ | `EASY` | 1 | ±150 | 500 ms | Chấm chính xác từng nước (`scoreRootMoves`), cộng nhiễu đều, chọn cao nhất |
| Trung bình | `MEDIUM` | 2 | ±40 | 1000 ms | như trên |
| Khó | `HARD` | 3 | 0 | 2000 ms | `searchBestMove`: Alpha-Beta cắt tỉa cả ở gốc |

Cả 3 mức bật **quiescence search** (mục 3). Nhiễu cùng thang với `evaluate` (Xe = 900): chỉ đảo được các nước chênh nhau dưới 2 × nhiễu. Mức Dễ (±150) vẫn không bỏ nước ăn Xe miễn phí (900 > 300) nhưng có thể bỏ ăn Tốt, Sĩ, Tượng, chọn vị trí kém. Có test cho cả 2 điều này.

## 3. Vì sao thêm quiescence search

Khi viết test "mức Dễ phải có biến hóa", 20 seed khác nhau chỉ cho **2** nước khai cuộc: luôn là Pháo ăn Mã. Nguyên nhân là **hiệu ứng chân trời**: nút lá chỉ chấm vật chất. Ở độ sâu 1, Pháo ăn Mã được +400 vì không thấy Xe ăn lại. Lên độ sâu 2 thì lệch theo chiều ngược lại, mức Dễ vẫn chỉ ra 3 nước:

| Độ sâu 2, thế khởi đầu | Nước tốt nhất | Điểm nước tốt nhất | Điểm các nước "êm" |
|---|---|:-:|:-:|
| Không quiescence | Pháo ăn Mã (`b7b0` / `h7h0`) | −51 | khoảng −400 (nút lá thấy Pháo đối phương ăn Mã mình, không thấy mình ăn lại) |
| Có quiescence | nước êm (ví dụ `b7e7` Pháo đầu) | 0 | 0 |

Quiescence: ở nút lá, bên tới lượt được chọn "đứng yên" (điểm `evaluate`) hoặc tiếp tục ăn quân; chỉ xét nước ăn quân, tối đa `QUIESCENCE_MAX_PLY = 6` nửa nước, kiểm tra hợp lệ (tự chiếu / lộ mặt tướng) chỉ cho nước ăn nên rẻ hơn `generateLegalMoves`. Sau khi bật, mức Dễ cho 18/20 nước khai cuộc khác nhau.

`quiescence` là tùy chọn của `searchBestMove` / `scoreRootMoves`, **mặc định tắt** để giữ nguyên hành vi và test của XQA-81. Chỉ `chooseAiMove` bật.

Cân nhắc độ sâu 2 / 3 / 4: mạnh hơn (Khó thắng Dễ 20/20) nhưng nước chậm nhất của Khó là **1,87 s** trên máy benchmark, quá sát giới hạn 2 s khi chạy trong Web Worker trên laptop sinh viên. Chọn 1 / 2 / 3: nước chậm nhất 0,27 s.

## 4. Benchmark tự đấu (AC2 XQA-28: Khó thắng Dễ ≥ 70% trên 20 ván)

Môi trường: Linux, Intel Xeon 2.80 GHz (2 nhân), Node v22.23.4, ngày 26/10/2026. Seed 2026, mức A cầm Đỏ ván lẻ, cầm Đen ván chẵn. Lặp thế cờ lần 3 tính **hòa** (benchmark chưa áp Điều 23 chiếu dai/bắt dai xử thua, nên tính hòa là chặt hơn cho mức mạnh). Quá 300 nửa nước tính hòa.

Chạy lại: `pnpm --filter @xiangqi-arena/xiangqi-core build && pnpm --filter @xiangqi-arena/xiangqi-core bench:ai` (thoát mã 1 nếu Khó < 70%). Kết quả tái lập được vì có seed.

| Cặp đấu (A vs B) | A thắng | B thắng | Hòa | Tỷ lệ thắng A | Kết thúc ván | Thời gian chạy |
|---|:-:|:-:|:-:|:-:|---|:-:|
| **Khó vs Dễ** | 18 | 0 | 2 | **90%** | chiếu bí 18, lặp 3 lần → hòa 2 | 18 s |
| **Trung bình vs Dễ** | 18 | 0 | 2 | **90%** | chiếu bí 18, quá 300 nửa nước → hòa 1, lặp 3 lần → hòa 1 | 10.8 s |
| **Khó vs Trung bình** | 16 | 0 | 4 | **80%** | chiếu bí 12, lặp 3 lần → hòa 4, hết nước 4 | 27.6 s |

**AC2 đạt: Khó thắng Dễ 18/20 = 90% (≥ 70%), không thua ván nào.** Ba mức tách bạch đúng thứ tự: Trung bình thắng Dễ 90%, Khó thắng Trung bình 80%, mức yếu không thắng được ván nào trước mức mạnh hơn.

### Thời gian suy nghĩ mỗi nước

| Mức | Số nước đo | Trung bình | Chậm nhất | Quá giờ |
|---|:-:|:-:|:-:|:-:|
| Dễ | 1317 | 1.6 ms | 21 ms | 0 |
| Trung bình | 1557 | 9.6 ms | 167 ms | 0 |
| Khó | 1421 | 27.4 ms | 268 ms | 0 |

Đo trên Node ở máy chủ. Trong trình duyệt (Web Worker, XQA-130) sẽ chậm hơn; XQA-144 phải đo lại và chỉnh `maxTimeMs` từng mức.

### Chi tiết 20 ván Khó vs Dễ

| Ván | Seed | Đỏ | Đen | Kết quả | Kết thúc | Nửa nước |
|:-:|:-:|---|---|---|---|:-:|
| 1 | 2027 | Khó | Dễ | Hòa | lặp 3 lần → hòa | 96 |
| 2 | 2028 | Dễ | Khó | Khó thắng | chiếu bí | 54 |
| 3 | 2029 | Khó | Dễ | Khó thắng | chiếu bí | 95 |
| 4 | 2030 | Dễ | Khó | Khó thắng | chiếu bí | 12 |
| 5 | 2031 | Khó | Dễ | Khó thắng | chiếu bí | 47 |
| 6 | 2032 | Dễ | Khó | Khó thắng | chiếu bí | 42 |
| 7 | 2033 | Khó | Dễ | Khó thắng | chiếu bí | 69 |
| 8 | 2034 | Dễ | Khó | Hòa | lặp 3 lần → hòa | 169 |
| 9 | 2035 | Khó | Dễ | Khó thắng | chiếu bí | 13 |
| 10 | 2036 | Dễ | Khó | Khó thắng | chiếu bí | 50 |
| 11 | 2037 | Khó | Dễ | Khó thắng | chiếu bí | 47 |
| 12 | 2038 | Dễ | Khó | Khó thắng | chiếu bí | 76 |
| 13 | 2039 | Khó | Dễ | Khó thắng | chiếu bí | 53 |
| 14 | 2040 | Dễ | Khó | Khó thắng | chiếu bí | 78 |
| 15 | 2041 | Khó | Dễ | Khó thắng | chiếu bí | 25 |
| 16 | 2042 | Dễ | Khó | Khó thắng | chiếu bí | 54 |
| 17 | 2043 | Khó | Dễ | Khó thắng | chiếu bí | 73 |
| 18 | 2044 | Dễ | Khó | Khó thắng | chiếu bí | 28 |
| 19 | 2045 | Khó | Dễ | Khó thắng | chiếu bí | 53 |
| 20 | 2046 | Dễ | Khó | Khó thắng | chiếu bí | 46 |

## 5. Giới hạn đã biết

- **Tự lặp nước khi đang hơn**: 7/60 ván hòa do lặp 3 lần, phần lớn là mức mạnh không biết phá thế lặp. Đã có việc riêng: XQA-145 "đa dạng nước đi, tránh tự lặp nước" (S5). Trong ván thật, RepetitionJudge ở GameService sẽ xử theo Điều 23.
- Quiescence không nhận ra chiếu bí (thế hết nước trong chuỗi ăn quân chấm theo vật chất) và vẫn cho "đứng yên" khi đang bị chiếu. Chấp nhận được ở độ sâu nhỏ; thế hết nước ở độ sâu chính vẫn nhận ra đúng.
- Chưa có bảng transposition, iterative deepening, opening book.
- Benchmark chỉ đo AI với AI, chưa đo với người. Cảm nhận độ khó thật sẽ lấy từ usability test (XQA-176) và UAT.
