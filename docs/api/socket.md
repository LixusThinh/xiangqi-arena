# Contract Socket.IO v0.3 — Game (XQA-75, XQA-91, XQA-93)

Kênh realtime cho ván cờ. Gateway chỉ là transport: mọi luật (đúng người, đúng lượt, `expectedPly`, luật đi quân, kết thúc ván) do `GameService` quyết — giống hệt REST `POST /matches/:id/moves` (`docs/api/game.md`, XQA-74).

> Phạm vi v0.2: `game:join`, `game:move`, `game:resign`, `game:draw-offer` / `draw-accept` / `draw-reject`, `game:update`, `game:end`, `game:draw-offered`, `game:draw-rejected`. v0.3 thêm `player:disconnected`, `player:reconnected` và giữ ván khi mất kết nối (XQA-93). Chưa có: đồng hồ (XQA-141), `room:*`, `webrtc:*` (XQA-124).

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

### `game:resign` (XQA-91)

```jsonc
{ "matchId": "1" }
```

- Phải `game:join` trước (`GAME_NOT_JOINED`). Gửi được cả khi không phải lượt mình.
- Thành công → ván `FINISHED`, đối thủ thắng, `endReason = "RESIGNATION"`; server phát `game:update` + `game:end`.
- Xác nhận "có chắc muốn xin thua" là việc của FE (XQA-92). Server không hỏi lại.
- Lỗi: `GAME_NOT_ACTIVE` (ván đã kết thúc), `GAME_NOT_PLAYER`, `VALIDATION_ERROR`.

### `game:draw-offer` · `game:draw-accept` · `game:draw-reject` (XQA-91)

Payload cả ba: `{ "matchId": "1" }`.

| Event | Ai gửi | Kết quả |
|---|---|---|
| `game:draw-offer` | người chơi bất kỳ | Tạo đề nghị chờ. `state.drawOffer = { by, atPly }`. Server phát `game:draw-offered { matchId, by, atPly }` + `game:update` |
| `game:draw-accept` | **đối thủ** của người đề nghị | Ván `FINISHED`, `result = "DRAW"`, `endReason = "DRAW_AGREEMENT"`; `game:update` + `game:end` |
| `game:draw-reject` | **đối thủ** của người đề nghị | Ván tiếp tục, `drawOffer = null`; `game:draw-rejected { matchId, by }` + `game:update` |

Lỗi riêng:

| Code | Khi nào |
|---|---|
| `GAME_DRAW_OFFER_PENDING` | Đã có một đề nghị đang chờ (của mình hoặc đối thủ) |
| `GAME_DRAW_OFFER_TOO_SOON` | Đề nghị trước của mình bị từ chối và mình chưa đi thêm nước nào (BR-DRAW-01) |
| `GAME_NO_DRAW_OFFER` | Đồng ý / từ chối khi không có đề nghị chờ |
| `GAME_DRAW_OFFER_OWN` | Tự đồng ý / từ chối đề nghị của chính mình |

Luật hệ thống (business rule, **đề xuất, chờ PM duyệt**, không phải luật Cờ Tướng):

- **BR-DRAW-01:** đề nghị bị từ chối thì người đó phải đi thêm ít nhất 1 nước mới được đề nghị lại. Chống spam popup.
- **BR-DRAW-02:** đối thủ đi quân thay vì trả lời → đề nghị hết hạn (`EXPIRED`). Người đề nghị tự đi quân thì đề nghị vẫn còn.
- Ván kết thúc bằng bất kỳ cách nào → đề nghị đang chờ chuyển `EXPIRED`.

REST tương đương (dự phòng, **không** phát event cho đối thủ): `POST /matches/:id/resign`, `/draw-offer`, `/draw-accept`, `/draw-reject` → `200` + GameState.

## Server → Client

### `game:update` — `GameState`

Phát sau mỗi nước hợp lệ. Mỗi socket nhận `yourColor` của chính user đó. FE nên **thay toàn bộ** state bằng payload này (không tự áp nước ở client).

### `game:end`

```jsonc
{ "matchId": "1", "result": "DRAW", "endReason": "REPETITION", "endRule": "Điều 24.2 ..." }
```

Phát (sau `game:update`) khi ván chuyển `FINISHED`/`ABORTED`. `endReason` gồm cả `RESIGNATION`, `DRAW_AGREEMENT` (XQA-91).

### `game:draw-offered` — `{ matchId, by: "RED" | "BLACK", atPly }`

Có đề nghị hòa mới. FE bên kia mở popup Đồng ý / Từ chối. Trạng thái chuẩn vẫn là `state.drawOffer` (reload trang vẫn thấy).

### `game:draw-rejected` — `{ matchId, by }`

`by` là người **từ chối**. FE của người đề nghị hiện toast.

## Mất kết nối và vào lại (XQA-93)

Khi socket **cuối cùng** của một người chơi rời ván đang `ACTIVE` (rớt mạng, reload, tắt tab), server giữ ván `RuleProfile.reconnectGraceSec` giây (seed: 60) và báo đối thủ.

### `player:disconnected` — `{ matchId, color, deadline, graceSec }`

`deadline` là ISO time hết hạn chờ. FE đối thủ hiện banner đếm ngược tới `deadline`. `GameState.disconnected = [{ color, deadline }]` cũng có trong `game:join` / `GET /matches/:id`, nên reload vẫn thấy.

### `player:reconnected` — `{ matchId, color }`

Người đó `game:join` lại trong hạn. Ack `game:join` trả GameState đầy đủ (thế cờ, lượt, đề nghị hòa…) để khôi phục bàn cờ.

### Hết hạn

- Người mất kết nối thua: `result` = đối thủ thắng, `endReason = "DISCONNECT"`; server phát `game:update` + `game:end`.
- **BR-RECON-01 (đề xuất, chờ PM duyệt):** lúc hết hạn mà đối thủ cũng đang mất kết nối → ván `ABORTED`, `result = null`, `endReason = "DISCONNECT"`. Ván `ABORTED` không vào lịch sử (`/me/matches` chỉ lấy `FINISHED`).
- Ván kết thúc bằng cách khác trong lúc chờ (đối thủ xin thua, …) → hết hạn không làm gì.

Quy tắc khác:
- Mở nhiều tab: chỉ tính mất kết nối khi **tất cả** tab của người đó đã đóng.
- Ván đã `FINISHED`/`ABORTED`: rời đi không giữ ván.

**Giới hạn:** trạng thái chờ nằm trong RAM của một tiến trình server (`PresenceService`). Server khởi động lại thì mất đồng hồ chờ, ván vẫn `ACTIVE` và người chơi vào lại chơi tiếp được. Chạy nhiều instance cần Redis adapter + lưu presence vào Redis (ngoài phạm vi đồ án).

## Gợi ý luồng FE (XQA-76)

1. Vào trang ván: `GET /rooms/:code/match` để có state ban đầu (hoặc chỉ `game:join` với `roomCode`).
2. `game:join` → lưu `data` làm state.
3. Người chơi đi → `game:move` với `expectedPly = state.ply`; **không** đổi bàn cờ trước khi có kết quả.
   - `ok` → dùng `data` (hoặc đợi `game:update`, cùng nội dung).
   - lỗi → giữ nguyên bàn cờ, toast theo `error.code`; riêng `GAME_STALE_STATE` thì `game:join` lại để lấy state mới.
4. `game:update` → thay state. `game:end` → mở hộp thoại kết thúc.
5. Mất kết nối rồi `connect` lại → `game:join` lại (socket mới chưa ở trong phòng nào). Phải join lại trong `graceSec` giây, không thì bị xử thua (XQA-93).
6. Nhận `player:disconnected` → banner "Đối thủ mất kết nối" đếm ngược tới `deadline`; `player:reconnected` → tắt banner (XQA-94).
