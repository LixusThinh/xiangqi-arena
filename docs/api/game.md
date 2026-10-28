# Contract Game v0.2 (XQA-74, XQA-90, XQA-91)

GameService là authority của ván cờ (BR-03, NFR-06). REST dưới đây dùng để tải trạng thái (tải lại trang – NFR-07) và đi quân dự phòng; realtime đi qua Socket.IO (`docs/api/socket.md`, XQA-75), gateway gọi cùng GameService nên luật kiểm tra giống hệt.

Mọi endpoint cần `Authorization: Bearer <accessToken>`.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/matches/:id` | Trạng thái ván. Ván `WAITING` (vừa đủ 2 người) được bắt đầu khi một người chơi mở lần đầu |
| GET | `/rooms/:code/match` | Như trên, tìm theo mã phòng |
| POST | `/matches/:id/moves` | Đi một nước. Body `{ "from": "h7", "to": "e7", "expectedPly": 0 }` → `200` + trạng thái mới |
| POST | `/matches/:id/resign` | Xin thua (XQA-91). Không body → `200` + trạng thái mới |
| POST | `/matches/:id/draw-offer` | Đề nghị hòa |
| POST | `/matches/:id/draw-accept` | Đồng ý đề nghị hòa của đối thủ |
| POST | `/matches/:id/draw-reject` | Từ chối đề nghị hòa của đối thủ |

Luật và mã lỗi của xin thua / xin hòa: `docs/api/socket.md` mục `game:resign`, `game:draw-*`.

Ô theo ký hiệu xiangqi-core: cột `a`–`i` từ trái sang phải nhìn từ phía Đỏ, hàng `0` là hàng đáy bên Đen, hàng `9` là hàng đáy bên Đỏ.

## GameState

```jsonc
{
  "matchId": "1", "roomCode": "K7MPQ2XA",
  "status": "ACTIVE",                 // WAITING | ACTIVE | FINISHED | ABORTED
  "fen": "<FEN sau nước cuối>", "ply": 3,
  "turn": "BLACK",                    // null khi ván kết thúc
  "inCheck": false,
  "result": null,                     // RED_WIN | BLACK_WIN | DRAW
  "endReason": null,                  // CHECKMATE | STALEMATE (hết nước – Điều 7.1b) | REPETITION | RESIGNATION | DRAW_AGREEMENT
  "endRule": null,                    // căn cứ Điều 23 khi endReason = REPETITION
  "red": { "id": "1", "username": "...", "displayName": "...", "rating": 1200 },
  "black": { ... },
  "yourColor": "RED",                 // null nếu không phải người chơi
  "lastMove": { "ply": 3, "from": "h0", "to": "g2", "piece": "n", "captured": null, "isCheck": false },
  "moves": [ ... ],
  "drawOffer": null,                  // { "by": "RED", "atPly": 3 } khi có đề nghị hòa chờ (XQA-91)
  "redTimeLeftMs": 600000, "blackTimeLeftMs": 600000,   // chưa trừ giờ (XQA-141)
  "startedAt": "...", "endedAt": null
}
```

## Quy tắc kiểm tra nước đi (theo thứ tự)

1. Người gửi phải là người chơi của ván → `403 GAME_NOT_PLAYER`.
2. Ván phải `ACTIVE` → `409 GAME_NOT_ACTIVE`.
3. `expectedPly` phải bằng `ply` hiện tại → `409 GAME_STALE_STATE` (gửi trùng, thế cờ cũ, 2 request cùng lúc).
4. Đúng lượt màu của người gửi → `409 GAME_NOT_YOUR_TURN`.
5. Nước hợp lệ theo xiangqi-core (đúng cách đi, không tự chiếu, không lộ mặt tướng; đi quân đối phương cũng bị từ chối) → `400 GAME_ILLEGAL_MOVE`.

Sau nước đi: hết nước hợp lệ cho bên kia → kết thúc (`CHECKMATE` hoặc `STALEMATE` theo Điều 7.1, bên hết nước thua); RepetitionJudge xử lặp nước (Điều 23) → `REPETITION`. Ván kết thúc thì phòng chuyển `FINISHED`.

## Kết thúc ván và lưu kết quả (XQA-90)

| Cách kết thúc | `result` | `endReason` | Nguồn |
|---|---|---|---|
| Chiếu bí | bên chiếu thắng | `CHECKMATE` | Điều 7.1 |
| Hết nước đi | bên còn nước thắng | `STALEMATE` | Điều 7.1b |
| Lặp nước | theo RepetitionJudge | `REPETITION` (+ `endRule`) | Điều 23 |
| Xin thua | đối thủ thắng | `RESIGNATION` | FR-14 |
| Hai bên đồng ý hòa | `DRAW` | `DRAW_AGREEMENT` | FR-15 |

- Kết quả do server tính và ghi vào `matches` (`status`, `result`, `end_reason`, `ended_at`) trong cùng transaction với nước cuối / thao tác cuối. Không endpoint hay event nào nhận `result` từ client; field lạ trong body bị ValidationPipe bỏ (FR-13, BR-05).
- Chỉ ván `ACTIVE` mới được chốt (`updateMany ... where status = ACTIVE`). Hai thao tác kết thúc cùng lúc (ví dụ xin thua và nước chiếu bí) → cái đến sau nhận `409` (`GAME_NOT_ACTIVE`, hoặc `GAME_STALE_STATE` nếu là nước đi), kết quả đầu giữ nguyên.
- Sau khi chốt: phòng → `FINISHED`, đề nghị hòa còn chờ → `EXPIRED`.

Chưa có: trừ đồng hồ / hết giờ `TIMEOUT` (XQA-141, Sprint 5), mất kết nối `DISCONNECT` (XQA-93), cập nhật Elo (Sprint 6).
