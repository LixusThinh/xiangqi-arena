# Contract Socket.IO v0.1 — Game (XQA-75)

Kênh realtime cho ván cờ. Gateway chỉ là transport: mọi luật (đúng người, đúng lượt, `expectedPly`, luật đi quân, kết thúc ván) do `GameService` quyết — giống hệt REST `POST /matches/:id/moves` (`docs/api/game.md`, XQA-74).

> Phạm vi v0.1: `game:join`, `game:move`, `game:update`, `game:end`. Chưa có: `game:resign` / `game:draw-*` (XQA-91), reconnect giữ ván 60s + `player:*` (XQA-93), đồng hồ (XQA-141), `room:*`, `webrtc:*` (XQA-124). Các event này sẽ thêm vào file này khi làm.

## Kết nối

- URL: cùng origin/cổng với API (mặc định `http://localhost:3000`), namespace mặc định `/`.
- CORS: theo `WEB_ORIGINS` như REST.
- Xác thực: gửi access JWT trong `auth.token` lúc handshake. Luật kiểm giống `AuthJwtGuard` (chữ ký, hạn, phiên chưa logout – XQA-66).

```ts
import { io } from 'socket.io-client';
const socket = io(API_URL, { auth: { token: accessToken }, transports: ['websocket'] });
socket.on('connect_error', (err) => console.log(err.data?.code)); // AUTH_TOKEN_MISSING | AUTH_TOKEN_INVALID | AUTH_TOKEN_EXPIRED | AUTH_SESSION_REVOKED
```

Token hết hạn lúc đang kết nối: socket không bị ngắt ở v0.1. Khi FE refresh token xong thì `socket.auth.token = newToken` rồi `socket.disconnect().connect()`.

## Ack

Mọi event client → server dùng ack (callback hoặc `emitWithAck`):

```ts
type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
```

`code` dùng lại mã lỗi REST của Game (`GAME_*`) + các mã riêng của socket bên dưới.

## Client → Server

### `game:join`

```jsonc
{ "matchId": "1" }        // hoặc
{ "roomCode": "K7MPQ2XA" }
```

- Thành công → `{ ok: true, data: GameState }` (GameState như `docs/api/game.md`, `yourColor` là màu của mình). Socket được vào phòng `match:<matchId>` để nhận `game:update`.
- Ván `WAITING` được bắt đầu khi người chơi join lần đầu (giống `GET /matches/:id`).
- Lỗi: `GAME_NOT_PLAYER` (không phải người chơi của ván), `GAME_NOT_FOUND`, `VALIDATION_ERROR`.

### `game:move`

```jsonc
{ "matchId": "1", "from": "h7", "to": "e7", "expectedPly": 0 }
```

- Phải `game:join` ván đó trước, không thì `GAME_NOT_JOINED`.
- Thành công → `{ ok: true, data: GameState }`, đồng thời server phát `game:update` cho mọi socket đã join (kể cả người vừa đi).
- Lỗi (thế cờ server **không đổi**): `GAME_NOT_PLAYER`, `GAME_NOT_ACTIVE`, `GAME_STALE_STATE`, `GAME_NOT_YOUR_TURN`, `GAME_ILLEGAL_MOVE`, `VALIDATION_ERROR`.
- Gửi trùng / 2 nước cùng lúc: chỉ 1 nước được ghi, nước còn lại nhận `GAME_STALE_STATE`.

## Server → Client

### `game:update` — `GameState`

Phát sau mỗi nước hợp lệ. Mỗi socket nhận `yourColor` của chính user đó. FE nên **thay toàn bộ** state bằng payload này (không tự áp nước ở client).

### `game:end`

```jsonc
{ "matchId": "1", "result": "DRAW", "endReason": "REPETITION", "endRule": "Điều 24.2 ..." }
```

Phát (sau `game:update`) khi ván chuyển `FINISHED`/`ABORTED`.

## Gợi ý luồng FE (XQA-76)

1. Vào trang ván: `GET /rooms/:code/match` để có state ban đầu (hoặc chỉ `game:join` với `roomCode`).
2. `game:join` → lưu `data` làm state.
3. Người chơi đi → `game:move` với `expectedPly = state.ply`; **không** đổi bàn cờ trước khi có kết quả.
   - `ok` → dùng `data` (hoặc đợi `game:update`, cùng nội dung).
   - lỗi → giữ nguyên bàn cờ, toast theo `error.code`; riêng `GAME_STALE_STATE` thì `game:join` lại để lấy state mới.
4. `game:update` → thay state. `game:end` → mở hộp thoại kết thúc.
5. Mất kết nối rồi `connect` lại → `game:join` lại (socket mới chưa ở trong phòng nào).
