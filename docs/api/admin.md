# Contract REST Admin v0.1

XQA-31 + XQA-35 · FR-25 … 29 · AC-31-* & AC-35-*. Dành cho trang Quản trị hệ thống (`/admin`).

- **Base URL local:** `http://localhost:3000`, JSON UTF-8, không có tiền tố `/api`.
- Mọi endpoint cần `Authorization: Bearer <accessToken>` của tài khoản có role `ADMIN`.
- Tài khoản chưa đăng nhập -> `401 AUTH_TOKEN_MISSING` / `AUTH_TOKEN_INVALID`.
- Tài khoản role `PLAYER` -> **`403 FORBIDDEN` cho mọi endpoint `/admin/*`**, không thay đổi bất kỳ dữ liệu nào (AC-31-02).

## 1. Dashboard tổng quan — `GET /admin/dashboard` → `200`
Trả về số liệu thống kê thời gian thực của hệ thống (AC-35-03).

Response Body:
```jsonc
{
  "totalUsers": 120,    // tổng số user trong hệ thống
  "totalMatches": 450,  // tổng số ván đấu trong DB
  "todayMatches": 25,   // số ván đấu được bắt đầu trong ngày hôm nay (tính theo giờ Việt Nam UTC+7)
  "openReports": 3,     // số báo cáo đang ở trạng thái OPEN
  "onlineUsers": 14     // số user đang có ít nhất 1 socket kết nối vào ván đấu
}
```

## 2. Quản lý người dùng — `GET /admin/users` → `200`
Tìm kiếm và phân trang người dùng (AC-31-03).

Query Parameters:
- `q` (tùy chọn): tìm kiếm theo `username`, `email` hoặc `displayName` (chứa chuỗi, không phân biệt hoa thường).
- `page` (tùy chọn, mặc định 1): trang hiện tại.
- `pageSize` (tùy chọn, mặc định 20): số phần tử mỗi trang.

Response Body:
```jsonc
{
  "items": [
    {
      "id": "1",
      "username": "player1",
      "displayName": "Kỳ thủ Một",
      "email": "player1@xiangqi.local",
      "role": "PLAYER", // "PLAYER" | "ADMIN"
      "accountStatus": "ACTIVE", // "ACTIVE" | "LOCKED"
      "rating": 1250,
      "createdAt": "2026-10-21T08:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 120,
  "totalPages": 6
}
```

## 3. Khóa / Mở khóa tài khoản — `PATCH /admin/users/:id/status` → `200`
Thay đổi trạng thái tài khoản người dùng (AC-31-04, AC-31-05).

Request Body:
```jsonc
{
  "status": "LOCKED" // "ACTIVE" | "LOCKED"
}
```
- Khi khóa (`LOCKED`): toàn bộ phiên đăng nhập (`auth_sessions`) của user đó bị thu hồi ngay lập tức (`revokedAt = now()`); user đang kết nối sẽ bị từ chối ở các yêu cầu tiếp theo; đăng nhập lại trả về `403 ACCOUNT_LOCKED`.
- Khi mở khóa (`ACTIVE`): user có thể đăng nhập lại bình thường.
- **Ràng buộc an toàn (AC-31-06):** Chặn tự khóa chính mình và chặn khóa các tài khoản Admin khác (`400 VALIDATION_ERROR`).
- **Audit Logging (AC-31-07):** Server ghi log hành động: Admin ID, User ID mục tiêu, hành động (KHÓA/MỞ KHÓA), thời điểm.

## 4. Quản lý ván đấu — `GET /admin/matches` → `200`
Danh sách ván đấu phân trang, có thể lọc theo trạng thái (AC-35-01).

Query Parameters:
- `status` (tùy chọn): `WAITING` | `ACTIVE` | `FINISHED` | `ABORTED`.
- `page` (tùy chọn, mặc định 1).
- `pageSize` (tùy chọn, mặc định 20).

Response Body:
```jsonc
{
  "items": [
    {
      "id": "101",
      "red": { "id": "1", "username": "player1", "displayName": "Kỳ thủ Một" },
      "black": { "id": "2", "username": "player2", "displayName": "Kỳ thủ Hai" },
      "status": "FINISHED",
      "result": "RED_WIN", // "RED_WIN" | "BLACK_WIN" | "DRAW" | null
      "endReason": "CHECKMATE",
      "startedAt": "2026-11-02T09:00:00.000Z",
      "endedAt": "2026-11-02T09:15:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 450,
  "totalPages": 23
}
```

## 5. Chi tiết ván đấu — `GET /admin/matches/:id` → `200`
Xem chi tiết ván đấu cùng toàn bộ danh sách nước đi đã thực hiện (AC-35-01).

Response Body:
```jsonc
{
  "id": "101",
  "red": { "id": "1", "username": "player1", "displayName": "Kỳ thủ Một" },
  "black": { "id": "2", "username": "player2", "displayName": "Kỳ thủ Hai" },
  "status": "FINISHED",
  "result": "RED_WIN",
  "endReason": "CHECKMATE",
  "currentFen": "...",
  "startedAt": "2026-11-02T09:00:00.000Z",
  "endedAt": "2026-11-02T09:15:00.000Z",
  "moves": [
    {
      "ply": 1,
      "from": "h7",
      "to": "e7",
      "piece": "C",
      "captured": null,
      "isCheck": false,
      "fenAfter": "...",
      "thinkTimeMs": 1200,
      "createdAt": "2026-11-02T09:00:05.000Z"
    }
  ]
}
```

## 6. Danh sách báo cáo vi phạm — `GET /admin/reports` → `200`
Danh sách báo cáo phân trang, có thể lọc theo trạng thái (AC-35-02).

Query Parameters:
- `status` (tùy chọn): `OPEN` | `PROCESSING` | `CLOSED`.
- `page`, `pageSize`.

Response Body:
```jsonc
{
  "items": [
    {
      "id": "1",
      "matchId": "101",
      "reporter": { "id": "1", "username": "player1", "displayName": "Kỳ thủ Một" },
      "reportedUser": { "id": "2", "username": "player2", "displayName": "Kỳ thủ Hai" },
      "reason": "CHEATING",
      "description": "Nghi vấn dùng công cụ hỗ trợ",
      "status": "OPEN",
      "handledBy": null,
      "handledAt": null,
      "createdAt": "2026-11-02T09:16:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 5,
  "totalPages": 1
}
```

## 7. Xử lý báo cáo vi phạm — `PATCH /admin/reports/:id` → `200`
Chuyển trạng thái xử lý của báo cáo (AC-35-02).

Request Body:
```jsonc
{
  "status": "PROCESSING" // "OPEN" | "PROCESSING" | "CLOSED"
}
```
- **Quy tắc chuyển trạng thái (AC-35-02):** Chỉ cho phép chuyển tuần tự `OPEN` → `PROCESSING` → `CLOSED`. Chặn đi lùi trạng thái (ví dụ từ PROCESSING về OPEN, từ CLOSED về OPEN/PROCESSING trả về `400 VALIDATION_ERROR`).
- Tự động ghi nhận `handledById` = ID của Admin thực hiện và `handledAt` = thời điểm xử lý.
