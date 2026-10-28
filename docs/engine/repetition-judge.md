# RepetitionJudge – lặp nước, chiếu mãi, bắt mãi (XQA-78 phần 1, XQA-95 phần 2)

Code: `packages/xiangqi-core/src/rules/repetition.ts` · Test: `packages/xiangqi-core/tests/rules-repetition.spec.ts` · Story XQA-22, XQA-26 · Epic XQA-6 (Điều 23, GV yêu cầu bắt buộc).

Nguồn luật: `luat_co_tuong_viet_nam.pdf` (tài liệu tập huấn trọng tài cờ quốc gia 2015) – Điều 22 (thuật ngữ), Điều 23 (mười điểm chính), Điều 24 (ví dụ 24.2–24.36), Điều 7.1g, 7.2b/c.

## 1. Cách dùng (cho GameService – XQA-74)

```ts
import { Position, RepetitionJudge } from '@xiangqi-arena/xiangqi-core';

const judge = new RepetitionJudge(Position.initial(), { threshold: ruleProfile.repetitionThreshold });
// sau mỗi nước ĐÃ được validate:
const verdict = judge.play(move);
if (verdict.result?.kind === 'loss') endMatch({ winner: verdict.result.winner, reason: 'REPETITION' });
if (verdict.result?.kind === 'draw') endMatch({ result: 'DRAW', reason: 'REPETITION' });
// 'undetermined': ván tiếp tục (chỉ còn ca chờ BR-REP-01, xem mục 6)
```

`verdict.violations[]` là loại vi phạm theo từng bên (`perpetual_check` | `perpetual_chase`) kèm điểm luật làm căn cứ (AC2 của XQA-78). `judge.history` cho biết từng nước là `check` / `chase` / `idle`, quân đuổi, quân bị đuổi, có căn thật không – dùng cho thông báo FE (XQA-149) và replay.

## 2. Ba tầng quy tắc (không trộn lẫn)

| Tầng | Nội dung |
|---|---|
| Luật cờ | Chiếu mãi bị xử thua; đuổi bắt mãi bị xử thua trừ các ngoại lệ; hai bên không phạm luật mà không đổi nước thì hòa (Điều 23, 24.2, 7.2b/c). |
| Business rule hệ thống | Thế cờ (cùng vị trí quân + cùng bên đi) xuất hiện **đủ 3 lần** mới xét (`RuleProfile.repetitionThreshold` trong seed). Luật không quy định số lần; con số 3 là quyết định của nhóm, đổi được theo RuleProfile. |
| Quyết định thiết kế | "Dọa bắt mới" = cặp (quân ta, quân địch) mà **sau** nước đi quân ta ăn hợp lệ được quân địch, **trước** nước đi thì không. Từ phần 2 tính cả quân đứng yên được mở đường (Pháo đổi ngòi – 24.21, 24.22). Ca luật không nói rõ → `undetermined` + đề xuất BR (mục 6), không đoán. |

## 3. Định nghĩa dùng trong code

- **Nước chiếu** (Điều 22.2): sau nước đi, Tướng đối phương bị chiếu. Nước vừa chiếu vừa dọa bắt tính là nước chiếu.
- **Nước đuổi bắt** (Điều 22.4): sau nước đi, một quân của bên vừa đi (quân vừa đi hoặc quân được mở đường) ăn hợp lệ được một quân đối phương (trừ Tướng) mà trước nước đi nó chưa ăn được quân đó. Mỗi mối dọa bắt ghi `targetProtected`, `targetImmobile`, `isExchangeOffer`, `discovered`.
- **Không đi được** (Điểm 7, 24.15): quân bị đuổi không còn nước hợp lệ nào (bị ghim, bị giam).
- **Đòi đổi quân** (Điều 22.5, 24.20): quân bị đuổi **cùng loại** và ăn lại được ngay quân đuổi.
- **Nước bắt được tính** (`chaseCounts`): bỏ mối dọa bắt Tốt chưa qua sông; bỏ mối dọa bắt quân có căn thật, trừ khi quân đó không đi được hoặc là Mã/Pháo bắt Xe.
- **Có căn thật** (Điều 22.15): nếu quân bị đuổi bị ăn, bên bị ăn **ăn lại hợp lệ ngay** được. Quân bảo vệ bị ghim (ăn lại sẽ tự chiếu hoặc lộ mặt tướng) = **căn giả** (Điều 22.16).
- **Chu kỳ lặp**: các nước từ lần xuất hiện đầu tiên tới lần hiện tại của thế cờ bị lặp. Một bên "chiếu mãi" khi **mọi** nước của bên đó trong chu kỳ đều là nước chiếu. "Bắt mãi" khi không có nước chiếu xen vào và **mọi** nước đều có nước bắt được tính nhắm vào **cùng một quân** (một hay nhiều quân đuổi), không phải tất cả đều chỉ là đòi đổi, và không rơi vào ngoại lệ Tướng/Tốt.

## 4. Độ phủ 10 điểm Điều 23 (sau XQA-95)

| Điểm | Nội dung (tóm tắt) | Cách xử | Test |
|---|---|---|---|
| 1 | Chiếu mãi → thua | `loss` | bàn cờ thật |
| 2 | Dọa hết mãi, một chiếu một dọa/bắt/dừng… → hòa | Có nước không phải nước bắt → không phạm → `draw` | judgeCycle (2 ca) |
| 3 | Một quân bắt mãi một quân → thua (trừ Tốt chưa qua sông); **nhiều quân bắt mãi một quân → thua** | `loss`, rule "Điểm 3" / "Điểm 3 câu 2", `chaserIds` liệt kê mọi quân đuổi | bàn cờ thật + judgeCycle (24.29, 24.16) |
| 4 | Một quân luân phiên đuổi nhiều quân → hòa; **hai quân thay nhau bắt nhiều quân → hòa** | Không có quân nào bị đuổi ở mọi nước → `draw` | judgeCycle (24.28 hình 80) |
| 5 | Hai bắt một bắt lại → bên hai bắt thua | Qua luật chung: bên hai bắt có đủ mọi nước bắt cùng một quân, bên bắt lại có nước chờ | judgeCycle (24.17) |
| 6 | Căn thật → hòa; căn giả → thua; Mã/Pháo bắt Xe có căn → thua | Nước bắt quân có căn thật không được tính; Mã/Pháo→Xe vẫn tính. Một nước có căn, một nước không căn → hòa (24.13 hình 31) | bàn cờ thật (căn thật, căn giả do ghim, căn lẫn) + judgeCycle (24.11) |
| 7 | Có căn thật nhưng không đi được → vẫn bắt mãi; Mã đuổi Mã bị cản → bắt mãi | `targetImmobile` làm căn thật mất tác dụng, rule "Điểm 7"; Mã bị cản không ăn lại được → không phải đòi đổi | bàn cờ thật (cờ ghim lộ mặt tướng, Mã cản chân) + judgeCycle |
| 8 | Bắt kèm đòi đổi vẫn là bắt mãi | Nếu có ít nhất 1 nước bắt thật thì vẫn xử bắt mãi | judgeCycle (24.32) |
| 9 | Tướng / Tốt bắt mãi → hòa; phối hợp với **một** Xe/Mã/Pháo → hòa | Quân đuổi chỉ gồm Tướng/Tốt, hoặc Tướng/Tốt + 1 quân khác → `draw`; + từ 2 quân khác → `loss` (24.26 hình 71–73) | judgeCycle (3 ca) |
| 10 | Cản mãi, thí mãi, đòi đổi mãi, dọa mãi chiếu rút bắt quân → hòa | Không phải nước bắt; mọi nước đều chỉ là đòi đổi cùng loại → không phạm | bàn cờ thật (Xe đổi Xe) + judgeCycle |

Hai bên cùng phạm **cùng** một loại → hòa (Điều 7.2c). Hai bên phạm **khác** loại (một chiếu mãi, một bắt mãi) → `undetermined`, chờ BR-REP-01.

## 5. Giới hạn còn lại

1. **Không có golden test theo hình Điều 24.** Bản text của `luat_co_tuong_viet_nam.pdf` chỉ có chuỗi nước, không có vị trí quân của hình. Golden fixture phải có người đọc hình và nhập FEN (XQA-79, QA). Test ở đây là thế cờ nhóm tự dựng + bản ghi tổng hợp cho `judgeCycle`.
2. "Dọa hết" (đe dọa chiếu bí, Điều 22.3) không được nhận diện riêng. Kết quả vẫn đúng vì luật cho phép dọa hết mãi (Điểm 2), nên coi là nước chờ.
3. Chu kỳ lấy từ lần xuất hiện **đầu tiên** của thế cờ bị lặp. Nếu giữa chu kỳ một bên đổi kiểu đi rồi quay lại, kết quả tính trên cả đoạn.

## 6. Business rule đề xuất (chờ PM duyệt – AC2 XQA-95)

Các điểm dưới đây là **cách hệ thống hiểu luật** ở chỗ văn bản không định rõ. Chưa phải luật Cờ Tướng. Code đã cài theo đề xuất, trừ BR-REP-01 (chưa cài, đang trả `undetermined`).

| ID | Đề xuất | Căn cứ | Trạng thái code |
|---|---|---|---|
| BR-REP-01 | Một bên chiếu mãi, bên kia bắt mãi → bên **chiếu mãi** thua | Điều 7.1g: "bất kể tình huống nào… chiếu mãi… phải thay đổi nước đi, nếu không bị xử thua" | Chưa cài, `undetermined` |
| BR-REP-02 | "Không di động được" = quân bị đuổi không còn nước hợp lệ nào | Điểm 7, 24.15 | Đã cài |
| BR-REP-03 | "Đòi đổi quân" chỉ tính khi quân bị đuổi cùng loại và ăn lại được ngay. Khác loại (Xe dọa Pháo mà Pháo ăn được Xe) vẫn tính là nước bắt | Điều 22.5, 24.20, 24.32 | Đã cài |
| BR-REP-04 | Ngoại lệ Tốt chưa qua sông áp dụng cả khi nhiều quân cùng đuổi | Điểm 3 (chỉ nói "một quân"), 24.21 hình 60 (Pháo đổi ngòi bắt Tốt chưa qua sông → không phạm) | Đã cài |
| BR-REP-05 | Dọa bắt "mới" tính cả quân đứng yên được mở đường | 24.21, 24.22 (Pháo đổi ngòi) | Đã cài |
| BR-REP-06 | Tướng/Tốt + đúng 1 quân Xe/Mã/Pháo bắt mãi → hòa; + từ 2 quân trở lên → thua | Điểm 9 câu 2, 24.25 vs 24.26 hình 71–73 | Đã cài |
| (có sẵn) | Thế cờ lặp đủ 3 lần mới xét (`RuleProfile.repetitionThreshold`) | Luật không quy định số lần | Đã cài từ phần 1 |
