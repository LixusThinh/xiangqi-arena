# Contract REST Auth v0.2

Tài liệu dành cho Nhân làm mock/tích hợp FE và BE triển khai. Contract này là nguồn thống nhất cho các API Auth theo quyết định D-05.

- **Base URL local:** `http://localhost:3000`
- Gửi và nhận dữ liệu dạng JSON UTF-8.
- Không có tiền tố `/api`.
- **v0.2 (XQA-66, 21/10):** thêm `refreshToken`, `refreshExpiresIn` vào response đăng ký/đăng nhập; thêm `POST /auth/refresh`, `POST /auth/logout`; thêm mã lỗi `AUTH_SESSION_REVOKED`, `AUTH_REFRESH_INVALID`, `AUTH_REFRESH_EXPIRED`. Access token cấp trước v0.2 không còn hợp lệ (thiếu `sid`) → FE đăng nhập lại.

## 1. Đăng ký — `POST /auth/register`

Tạo tài khoản người chơi mới.

### Request body

```json
{
  "username": "nguoichoi",
  "email": "player@example.com",
  "password": "example-pass-123",
  "displayName": "Nguoi Choi"
}
```

Quy tắc dữ liệu:

- `username`: từ 3 đến 30 ký tự; chỉ gồm chữ cái tiếng Anh, chữ số hoặc `_`. Không phân biệt chữ hoa/thường; lưu dạng chữ thường.
- `email`: email hợp lệ, tối đa 254 ký tự. Chuẩn hóa thành chữ thường trước khi lưu.
- `password`: từ 8 đến 72 ký tự và tối đa 72 byte UTF-8 (giới hạn của bcrypt).
- `displayName`: từ 1 đến 80 ký tự.

### Thành công — `201 Created`

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "<43 ký tự base64url>",
  "refreshExpiresIn": 604800,
  "user": {
    "id": "1",
    "username": "nguoichoi",
    "email": "player@example.com",
    "displayName": "Nguoi Choi",
    "role": "PLAYER",
    "rating": 1200,
    "createdAt": "2026-10-12T10:00:00.000Z"
  }
}
```

Nếu `username` hoặc `email` đã được đăng ký, trả `409 Conflict` với mã `AUTH_IDENTIFIER_TAKEN`.

## 2. Đăng nhập — `POST /auth/login`

Trường `identifier` nhận username **hoặc** email đã đăng ký. So khớp không phân biệt chữ hoa/thường.

### Request body

```json
{
  "identifier": "player@example.com",
  "password": "example-pass-123"
}
```

### Thành công — `200 OK`

Trả cùng cấu trúc với response đăng ký, gồm `accessToken` mới.

Nếu không tìm thấy tài khoản hoặc mật khẩu sai, trả `401 Unauthorized`, mã `AUTH_INVALID_CREDENTIALS`. Cùng một lỗi được dùng cho cả hai trường hợp để không tiết lộ tài khoản nào tồn tại.

## 3. Thông tin tài khoản hiện tại — `GET /auth/me`

Trả thông tin tài khoản tương ứng với access token hợp lệ.

### Request header

```http
Authorization: Bearer <accessToken>
```

### Thành công — `200 OK`

```json
{
  "id": "1",
  "username": "nguoichoi",
  "email": "player@example.com",
  "displayName": "Nguoi Choi",
  "role": "PLAYER",
  "rating": 1200,
  "createdAt": "2026-10-12T10:00:00.000Z"
}
```

`id` là chuỗi số thập phân vì kiểu PostgreSQL `BIGINT` không thể biểu diễn chính xác bằng JSON number. Không response nào trả mật khẩu hoặc password hash.

## 4. Đổi token — `POST /auth/refresh`

Gọi khi access token hết hạn (lỗi `AUTH_TOKEN_EXPIRED`) để lấy cặp token mới mà không bắt người dùng đăng nhập lại.

### Request body

```json
{ "refreshToken": "<refreshToken đang giữ>" }
```

### Thành công — `200 OK`

Trả cùng cấu trúc với response đăng nhập, gồm **cả `accessToken` lẫn `refreshToken` mới**. FE phải lưu đè cả hai.

Quy tắc:

- **Rotation:** refresh token chỉ dùng được 1 lần. Sau khi đổi thành công, token cũ trả `401 AUTH_REFRESH_INVALID`.
- **Hạn phiên tuyệt đối:** phiên sống tối đa `REFRESH_TOKEN_TTL_SEC` (mặc định 7 ngày) tính từ lúc đăng nhập. Refresh không kéo dài hạn này; `refreshExpiresIn` là số giây còn lại của phiên.
- Hai request refresh cùng một token chạy song song: chỉ một request thành công, request kia nhận `401 AUTH_REFRESH_INVALID`. FE không nên gọi refresh song song (xem mục lưu token).
- Tài khoản bị khóa: trả `403 ACCOUNT_LOCKED` và phiên bị thu hồi.

## 5. Đăng xuất — `POST /auth/logout`

### Request body

```json
{ "refreshToken": "<refreshToken đang giữ>" }
```

### Thành công — `204 No Content`

Thu hồi phiên. Từ thời điểm này:

- access token của phiên (dù chưa hết 15 phút) gọi API cần đăng nhập trả `401 AUTH_SESSION_REVOKED`;
- refresh token của phiên trả `401 AUTH_REFRESH_INVALID`.

Logout luôn trả `204`, kể cả khi token không tồn tại hoặc đã logout trước đó (idempotent, không tiết lộ token nào còn hiệu lực). Logout chỉ thu hồi phiên hiện tại, các thiết bị khác vẫn đăng nhập.

## Format lỗi chung

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    { "field": "email", "message": "email must be an email" }
  ]
}
```

`details` chỉ có trong lỗi kiểm tra dữ liệu request; các lỗi khác bỏ trường này.

| HTTP status | `code` | Khi nào xảy ra |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Thiếu field hoặc dữ liệu không hợp lệ/vượt giới hạn |
| `401` | `AUTH_INVALID_CREDENTIALS` | Username/email không tồn tại hoặc mật khẩu sai |
| `401` | `AUTH_TOKEN_MISSING` | Gọi `/auth/me` nhưng không gửi Bearer token |
| `401` | `AUTH_TOKEN_INVALID` | Token sai định dạng, không hợp lệ hoặc không được hỗ trợ |
| `401` | `AUTH_TOKEN_EXPIRED` | Access token hết hạn; gọi `POST /auth/refresh` |
| `401` | `AUTH_SESSION_REVOKED` | Access token thuộc phiên đã logout hoặc hết hạn phiên; đăng nhập lại |
| `401` | `AUTH_REFRESH_INVALID` | Refresh token không tồn tại, đã dùng (rotation) hoặc đã logout; đăng nhập lại |
| `401` | `AUTH_REFRESH_EXPIRED` | Phiên quá `REFRESH_TOKEN_TTL_SEC`; đăng nhập lại |
| `409` | `AUTH_IDENTIFIER_TAKEN` | Username hoặc email đã được đăng ký |
| `403` | `ACCOUNT_LOCKED` | Tài khoản bị khóa |

## Cách FE lưu và gửi token

- Đăng ký/đăng nhập nhận token trong field `accessToken` của JSON response.
- Khi gọi endpoint cần xác thực, gửi header `Authorization: Bearer <accessToken>`.
- Access token có thời hạn `900` giây (15 phút). Hết hạn thì gọi `POST /auth/refresh`; refresh lỗi `401` thì xóa phiên và chuyển về `/login`.
- Refresh token gửi trong body JSON (không dùng cookie) cho khớp cách FE đang lưu phiên ở `localStorage`. Đánh đổi: dễ tích hợp, nhưng XSS đọc được token; vì vậy refresh token có rotation, hạn tuyệt đối và bị thu hồi khi logout.
- Không gọi refresh song song: khi nhiều request cùng gặp `AUTH_TOKEN_EXPIRED`, FE dùng chung một lời gọi refresh đang chạy.
- Backend chỉ nhận CORS từ các origin trong biến `WEB_ORIGINS` (mặc định `http://localhost:3001`).

## Ví dụ gọi thử bằng PowerShell

```powershell
$body = @{
  username = "nhan_test"
  email = "nhan@example.com"
  password = "example-pass-123"
  displayName = "Nhan Test"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/auth/register" `
  -ContentType "application/json" `
  -Body $body

$session.accessToken

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3000/auth/me" `
  -Headers @{ Authorization = "Bearer $($session.accessToken)" }
```
