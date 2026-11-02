# Contract REST User Profile v0.1

XQA-102 · Story XQA-29 · FR-04. Hồ sơ người chơi và cập nhật thông tin cá nhân.

- **Base URL local:** `http://localhost:3000` (hoặc cổng cấu hình trong `.env`), JSON UTF-8.
- `GET /users/:username/profile` là endpoint công khai, không yêu cầu xác thực.
- `PATCH /me/profile` yêu cầu header `Authorization: Bearer <accessToken>`.

---

## 1. Xem hồ sơ công khai — `GET /users/:username/profile` → `200 OK`

Trả về thông tin cơ bản và số liệu thống kê thi đấu của người chơi.
Chỉ tính các ván có trạng thái `FINISHED`.

### URL Parameters:
- `username` (string): Tên đăng nhập của người dùng.

### Phản hồi thành công `200 OK`:
```jsonc
{
  "username": "kythu1",
  "displayName": "Kỳ Thủ Một",
  "avatarUrl": "https://example.com/avatar.jpg",
  "bio": "Yêu thích cờ tướng từ nhỏ.",
  "rating": 1250,
  "totalMatches": 20,
  "wins": 12,
  "losses": 6,
  "draws": 2,
  "winRate": 60.0,
  "createdAt": "2026-10-20T08:00:00.000Z"
}
```

### Lỗi thường gặp:
- `404 NOT_FOUND` (`code: USER_NOT_FOUND`): Không tìm thấy người chơi với username đã cho.

---

## 2. Cập nhật hồ sơ cá nhân — `PATCH /me/profile` → `200 OK`

Cho phép người dùng đã đăng nhập chỉnh sửa tên hiển thị, giới thiệu bản thân và ảnh đại diện.

### Header:
- `Authorization: Bearer <accessToken>`

### Body (JSON):
Các trường là tùy chọn (chỉ gửi trường cần cập nhật):
- `displayName` (string): 1–80 ký tự sau khi loại bỏ khoảng trắng ở đầu và cuối (trim).
- `bio` (string | null): Tối đa 500 ký tự (được phép để trống hoặc null).
- `avatarUrl` (string | null): Rỗng (`""`), `null`, hoặc đường dẫn URL bắt đầu bằng `https://` và dài tối đa 2048 ký tự.

```jsonc
{
  "displayName": "Kỳ Vương Phương Nam",
  "bio": "Đam mê khai cuộc Pháo đầu.",
  "avatarUrl": "https://example.com/new-avatar.png"
}
```

### Phản hồi thành công `200 OK`:
```jsonc
{
  "id": "1",
  "username": "kythu1",
  "displayName": "Kỳ Vương Phương Nam",
  "avatarUrl": "https://example.com/new-avatar.png",
  "bio": "Đam mê khai cuộc Pháo đầu.",
  "rating": 1250,
  "createdAt": "2026-10-20T08:00:00.000Z"
}
```

### Lỗi thường gặp:
- `400 VALIDATION_ERROR` (`code: VALIDATION_ERROR`):
  - `displayName` rỗng sau khi trim hoặc dài hơn 80 ký tự.
  - `bio` dài hơn 500 ký tự.
  - `avatarUrl` không bắt đầu bằng `https://` hoặc dài hơn 2048 ký tự.
- `401 Unauthorized`: Thiếu hoặc token không hợp lệ / hết hạn.
- `404 NOT_FOUND` (`code: USER_NOT_FOUND`): Tài khoản người dùng không tồn tại trong hệ thống.
