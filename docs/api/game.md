# Contract Game v0.1 (XQA-74)

GameService là authority của ván cờ (BR-03, NFR-06). REST dưới đây dùng để tải trạng thái (tải lại trang – NFR-07) và đi quân dự phòng; realtime đi qua Socket.IO (`docs/api/socket.md`, XQA-75), gateway gọi cùng GameService nên luật kiểm tra giống hệt.

Mọi endpoint cần `Authorization: Bearer <accessToken>`.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/matches/:id` | Trạng thái ván. Ván `WAITING` (vừa đủ 2 người) được bắt đầu khi một người chơi mở lần đầu |
| GET | `/rooms/:code/match` | Như trên, tìm theo mã phòng |
| POST | `/matches/:id/moves` | Đi một nước. Body `{ "from": "h7", "to": "e7", "expectedPly": 0 }` → `200` + trạng thái mới |

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
  "endReason": null,                  // CHECKMATE | STALEMATE (hết nước – Điều 7.1b) | REPETITION | ...
  "endRule": null,                    // căn cứ Điều 23 khi endReason = REPETITION
  "red": { "id": "1", "username": "...", "displayName": "...", "rating": 1200 },
  "black": { ... },
  "yourColor": "RED",                 // null nếu không phải người chơi
  "lastMove": { "ply": 3, "from": "h0", "to": "g2", "piece": "n", "captured": null, "isCheck": false },
  "moves": [ ... ],
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

Chưa có: trừ đồng hồ / hết giờ (XQA-141), xin thua / xin hòa (XQA-91), mất kết nối (XQA-93), cập nhật Elo.
