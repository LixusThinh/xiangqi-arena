# Contract REST Auth v0.1

Tài liệu dành cho Nhân làm mock/tích hợp FE và BE triển khai. Contract này là nguồn thống nhất cho các API Auth theo quyết định D-05.

- **Base URL local:** `http://localhost:3000`
- Gửi và nhận dữ liệu dạng JSON UTF-8.
- Không có tiền tố `/api`.

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
| `401` | `AUTH_TOKEN_EXPIRED` | Token hết hạn; đăng nhập lại để lấy token mới |
| `409` | `AUTH_IDENTIFIER_TAKEN` | Username hoặc email đã được đăng ký |
| `403` | `ACCOUNT_LOCKED` | Tài khoản bị khóa |

## Cách FE lưu và gửi token

- Đăng ký/đăng nhập nhận token trong field `accessToken` của JSON response.
- Khi gọi endpoint cần xác thực, gửi header `Authorization: Bearer <accessToken>`.
- Token có thời hạn `900` giây (15 phút). Hết hạn thì đăng nhập lại.
- Contract phiên bản này chưa định nghĩa refresh token.

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
