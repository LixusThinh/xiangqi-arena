# RepetitionJudge phần 1 – lặp nước, chiếu mãi, bắt mãi (XQA-78)

Code: `packages/xiangqi-core/src/rules/repetition.ts` · Test: `packages/xiangqi-core/tests/rules-repetition.spec.ts` · Story XQA-22 · Epic XQA-6 (Điều 23, GV yêu cầu bắt buộc).

Nguồn luật: `luat_co_tuong_viet_nam.pdf` (tài liệu tập huấn trọng tài cờ quốc gia 2015) – Điều 22 (thuật ngữ), Điều 23 (mười điểm chính), Điều 24.2, Điều 7.2b/c.

## 1. Cách dùng (cho GameService – XQA-74)

```ts
import { Position, RepetitionJudge } from '@xiangqi-arena/xiangqi-core';

const judge = new RepetitionJudge(Position.initial(), { threshold: ruleProfile.repetitionThreshold });
// sau mỗi nước ĐÃ được validate:
const verdict = judge.play(move);
if (verdict.result?.kind === 'loss') endMatch({ winner: verdict.result.winner, reason: 'REPETITION' });
if (verdict.result?.kind === 'draw') endMatch({ result: 'DRAW', reason: 'REPETITION' });
// 'undetermined': ván tiếp tục, ghi log để phần 2 (XQA-95) xử
```

`verdict.violations[]` là loại vi phạm theo từng bên (`perpetual_check` | `perpetual_chase`) kèm điểm luật làm căn cứ (AC2 của XQA-78). `judge.history` cho biết từng nước là `check` / `chase` / `idle`, quân đuổi, quân bị đuổi, có căn thật không – dùng cho thông báo FE (XQA-149) và replay.

## 2. Ba tầng quy tắc (không trộn lẫn)

| Tầng | Nội dung |
|---|---|
| Luật cờ | Chiếu mãi bị xử thua; đuổi bắt mãi bị xử thua trừ các ngoại lệ; hai bên không phạm luật mà không đổi nước thì hòa (Điều 23, 24.2, 7.2b/c). |
| Business rule hệ thống | Thế cờ (cùng vị trí quân + cùng bên đi) xuất hiện **đủ 3 lần** mới xét (`RuleProfile.repetitionThreshold` trong seed). Luật không quy định số lần; con số 3 là quyết định của nhóm, đổi được theo RuleProfile. |
| Quyết định thiết kế phần 1 | "Đuổi bắt" chỉ tính mối dọa bắt **mới** do **chính quân vừa đi** tạo ra (Điều 22.4), không tính nước mở đường cho quân khác bắt. Mẫu chưa đủ căn cứ thì trả `undetermined`, không đoán. |

## 3. Định nghĩa dùng trong code

- **Nước chiếu** (Điều 22.2): sau nước đi, Tướng đối phương bị chiếu. Nước vừa chiếu vừa dọa bắt tính là nước chiếu.
- **Nước đuổi bắt** (Điều 22.4): sau nước đi, quân vừa đi ăn hợp lệ được một quân đối phương (trừ Tướng) mà trước nước đi nó chưa ăn được quân đó.
- **Có căn thật** (Điều 22.15): nếu quân bị đuổi bị ăn, bên bị ăn **ăn lại hợp lệ ngay** được. Quân bảo vệ bị ghim (ăn lại sẽ tự chiếu hoặc lộ mặt tướng) = **căn giả** (Điều 22.16).
- **Chu kỳ lặp**: các nước từ lần xuất hiện đầu tiên tới lần hiện tại của thế cờ bị lặp. Một bên "chiếu mãi" khi **mọi** nước của bên đó trong chu kỳ đều là nước chiếu; "bắt mãi" khi mọi nước đều là nước đuổi bắt cùng một cặp quân đuổi – quân bị đuổi.

## 4. Độ phủ 10 điểm Điều 23

| Điểm | Nội dung (tóm tắt) | Phần 1 | Test |
|---|---|---|---|
| 1 | Chiếu mãi → thua | **Xử** (`loss`) | thế cờ thật, Điểm 1 |
| 2 | Một chiếu một dọa/bắt/dừng… không đổi → hòa | **Xử** (`draw`, không ai phạm luật) | judgeCycle Điểm 2 |
| 3 | Một quân đuổi bắt mãi một quân → thua, trừ Tốt chưa qua sông | **Xử** câu 1 + ngoại lệ Tốt; câu 2 (nhiều quân bắt một quân) → `undetermined` | thế cờ thật + judgeCycle |
| 4 | Một quân đuổi luân phiên nhiều quân → hòa; hai quân thay nhau bắt → hòa | **Xử** câu 1; câu 2 → `undetermined` | judgeCycle |
| 5 | Hai bắt một bắt lại → bên hai bắt phạm luật | Phần 2 | – |
| 6 | Bắt mãi quân có căn thật → hòa; căn giả → thua; Mã/Pháo bắt Xe có căn thật → thua | **Xử** đủ 3 vế | thế cờ thật (căn thật, căn giả do ghim) + judgeCycle |
| 7 | Quân có căn thật nhưng bị ghim không chạy được vẫn tính bắt mãi; Mã đuổi Mã bị cản | Phần 2 | – |
| 8 | Bắt kèm đòi đổi quân vẫn tính bắt mãi | Phần 2 | – |
| 9 | Tướng hoặc Tốt bắt mãi → hòa | **Xử** (vế quân đuổi là Tướng/Tốt); vế phối hợp với Xe/Mã/Pháo → phần 2 | judgeCycle |
| 10 | Cản mãi, thí quân mãi, đòi đổi mãi, dọa mãi chiếu rút bắt quân → hòa | Coi là không phạm luật → `draw` nếu bên kia cũng không phạm | gián tiếp (nước `idle`) |

Hai bên cùng phạm **cùng** một loại → hòa (Điều 7.2c). Hai bên phạm **khác** loại (một chiếu mãi, một bắt mãi) → `undetermined`.

## 5. Giới hạn đã biết (đưa vào XQA-95)

1. Chưa xét mối dọa bắt "mở đường" (quân A đi, quân B phía sau được thông đường bắt).
2. "Đổi quân" (Điều 22.5, Điểm 8) chưa tách khỏi "đuổi bắt".
3. Thế cờ test trong file spec do nhóm tự dựng theo từng điểm luật, **không** phải hình minh họa Điều 24; golden test theo hình Điều 24 thuộc XQA-79 (QA) và XQA-96 (harness).
