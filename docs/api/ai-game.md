# Contract REST AI Game v0.1

Lưu và quản lý ván chơi với máy trên tài khoản người dùng (`/ai-games`).

- **Base URL local:** `http://localhost:3010`, JSON UTF-8, không có tiền tố `/api`.
- Mọi endpoint cần `Authorization: Bearer <accessToken>` (dùng `AuthJwtGuard`).
- Chỉ chủ ván mới xem và sửa được ván của mình; ván của người khác hoặc không tồn tại → `404` (`AI_GAME_NOT_FOUND`).

## Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| AI-01 | Mỗi người chơi được lưu tối đa 10 ván ở trạng thái `IN_PROGRESS`. Tạo ván thứ 11 → `409 AI_GAME_LIMIT`. |
| AI-02 | Toạ độ nước đi theo chuẩn algebraic coordinate `[a-i][0-9]` tương thích với core `algebraicToSquare`. |
| AI-03 | Khi lưu ván (`PUT /ai-games/:id`), server tự đi lại toàn bộ mảng `moves` từ `initialFen` bằng `Position` trong core để kiểm tra tính hợp lệ và tự tính `currentFen`, `plyCount`. |
| AI-04 | Nếu có nước đi sai luật hoặc sai toạ độ → `400 VALIDATION_ERROR` kèm vị trí nước sai trong `details`. |
| AI-05 | Ván đã ở trạng thái `FINISHED` không thể lưu thêm nước đi → `409 AI_GAME_FINISHED`. |

## 1. Tạo ván mới — `POST /ai-games` → `201`

Body:
```jsonc
{
  "level": "EASY", // "EASY" | "MEDIUM" | "HARD"
  "playerColor": "r" // "r" | "b"
}
```

Response: `AiGameDetailResponse` (initialFen khởi đầu, currentFen khởi đầu, plyCount = 0, moves = []).

## 2. Danh sách ván đang chơi — `GET /ai-games?status=IN_PROGRESS` → `200`

Query:
- `status`: tùy chọn (`IN_PROGRESS` | `FINISHED`)

Response: Mảng `AiGameSummaryResponse`, sắp xếp theo `updatedAt` giảm dần (mới nhất trước).

```jsonc
[
  {
    "id": "1",
    "level": "EASY",
    "playerColor": "r",
    "plyCount": 6,
    "updatedAt": "2026-11-02T07:30:00.000Z"
  }
]
```

## 3. Chi tiết ván — `GET /ai-games/:id` → `200`

Response: `AiGameDetailResponse`

```jsonc
{
  "id": "1",
  "userId": "100",
  "level": "EASY",
  "playerColor": "r",
  "initialFen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1",
  "moves": [
    { "from": "b2", "to": "e2" }
  ],
  "currentFen": "...",
  "plyCount": 1,
  "status": "IN_PROGRESS",
  "result": null,
  "createdAt": "2026-11-02T07:00:00.000Z",
  "updatedAt": "2026-11-02T07:30:00.000Z"
}
```

## 4. Cập nhật ván — `PUT /ai-games/:id` → `200`

Body:
```jsonc
{
  "moves": [
    { "from": "b2", "to": "e2" }
  ],
  "status": "FINISHED", // tùy chọn
  "result": "WIN:checkmate" // tùy chọn
}
```

Response: `AiGameDetailResponse` với `currentFen` và `plyCount` do server tính toán.

## 5. Xoá ván — `DELETE /ai-games/:id` → `204`
