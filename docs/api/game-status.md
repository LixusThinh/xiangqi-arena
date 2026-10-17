# Hợp đồng trạng thái ván (XQA-216, hiện thực ở XQA-49)

> Trạng thái: engine đã hiện thực như dưới đây. Chờ Phát xác nhận và Nhân (XQA-50) comment đã đọc trên XQA-216.

## Kiểu dữ liệu (`@xiangqi-arena/xiangqi-core`)

```ts
type Side = 'r' | 'b';                  // dùng lại kiểu Side có sẵn trong core
type EndReason = 'checkmate' | 'no_moves';

interface GameResult {
  winner: Side;
  reason: EndReason;
}

interface GameStatus {
  turn: Side;                 // tới lượt bên nào đi
  inCheck: boolean;           // bên đang tới lượt có bị chiếu không
  result: GameResult | null;  // null = ván chưa kết thúc
}
```

**Khác bản nháp trên XQA-216:** `Side` là `'r' | 'b'` thay vì `'red' | 'black'`, vì core đã export `Side = 'r' | 'b'` và FE (`PlayerCard`, `MatchControls`, `page.tsx`) đang dùng kiểu này. FE cần nhãn tiếng Việt thì tự map khi hiển thị.

## Hàm trả về trạng thái

Gọi `position.getGameStatus()` sau mỗi `applyMove`.

| Tình huống | `inCheck` | `result` |
|---|---|---|
| Ván đang diễn ra | true/false | `null` |
| Bên tới lượt bị chiếu, không còn nước hợp lệ (Điều 7.1a, 7.1c) | `true` | `{ winner: <bên kia>, reason: 'checkmate' }` |
| Bên tới lượt không bị chiếu nhưng hết nước hợp lệ (Điều 7.1b) | `false` | `{ winner: <bên kia>, reason: 'no_moves' }` |

Sprint 1 chỉ có 2 lý do kết thúc trên. Xin thua, hòa, hết giờ, Điều 23 do GameService / RepetitionJudge bổ sung ở sprint sau (XQA-90, XQA-78, XQA-95).

## API engine liên quan

| Hàm | Ý nghĩa |
|---|---|
| `position.generateLegalMoves()` | Mọi nước hợp lệ của bên tới lượt (đã loại nước tự chiếu và lộ mặt tướng) |
| `position.generatePieceMoves(sq)` | Nước hợp lệ của 1 quân, FE dùng để highlight. **Từ XQA-49 đã lọc tự chiếu** |
| `position.generatePseudoLegalPieceMoves(sq)` | Nước đi vật lý, chưa xét chiếu (nội bộ / test / AI) |
| `position.isLegalMove(move)` | Server dùng để validate nước client gửi lên |
| `position.isCheck(color?)` | Tướng phe `color` (mặc định bên tới lượt) có bị chiếu không |

Hai Tướng đối mặt trên cùng cột không có quân che được tính như bị chiếu, nên nước đi để lộ mặt tướng tự động bị loại.
