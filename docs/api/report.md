# Contract REST Report v0.1

XQA-30 · Story XQA-30 · FR-24. Báo cáo người chơi vi phạm trong ván cờ.

- **Base URL local:** `http://localhost:3000`, JSON UTF-8, không có tiền tố `/api`.
- Cần `Authorization: Bearer <accessToken>` (lỗi xác thực theo [Auth contract](./auth.md)).

## Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| RP-01 | Chỉ người chơi của ván đấu (`redPlayer` hoặc `blackPlayer`) mới được báo cáo đối thủ của mình. Người ngoài gửi yêu cầu trả `403 GAME_NOT_PLAYER`. |
| RP-02 | Mỗi người chơi chỉ được báo cáo tối đa 1 lần cho cùng một ván đấu. Gửi lại trả `409 REPORT_DUPLICATE`. |
| RP-03 | Không được tự báo cáo chính mình. Nếu vi phạm trả `400 VALIDATION_ERROR`. |
| RP-04 | Lý do báo cáo (`reason`) bắt buộc thuộc enum `ReportReason`: `CHEATING`, `HARASSMENT`, `SPAM`, `OTHER`. Sai enum trả `400 VALIDATION_ERROR`. |
| RP-05 | Mô tả (`description`) là tùy chọn, nếu có tối đa 500 ký tự (Unicode code points). Vượt quá 500 ký tự trả `400 VALIDATION_ERROR`. |
| RP-06 | Nội dung mô tả chứa HTML/script được lưu nguyên văn dạng text và render an toàn trên FE (chống XSS, NFR-04). |
| RP-07 | Báo cáo tạo mới có trạng thái ban đầu là `OPEN`. |

## 1. Báo cáo đối thủ trong ván — `POST /matches/:id/report` → `201`

Request Body:
```jsonc
{
  "reason": "CHEATING", // "CHEATING" | "HARASSMENT" | "SPAM" | "OTHER"
  "description": "Đối thủ sử dụng công cụ hỗ trợ gian lận." // tùy chọn, tối đa 500 ký tự
}
```

Response Body (`201 Created`):
```jsonc
{
  "id": "1",
  "matchId": "101",
  "reporterId": "12",
  "reportedUserId": "15",
  "reason": "CHEATING",
  "description": "Đối thủ sử dụng công cụ hỗ trợ gian lận.",
  "status": "OPEN",
  "createdAt": "2026-11-02T10:00:00.000Z"
}
```

## Bảng mã lỗi

| HTTP | Code | Ý nghĩa |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Lý do không hợp lệ, mô tả > 500 ký tự hoặc tự báo cáo chính mình |
| 401 | `AUTH_TOKEN_MISSING` / `AUTH_TOKEN_INVALID` | Chưa đăng nhập hoặc token không hợp lệ |
| 403 | `GAME_NOT_PLAYER` | Người gửi không phải người chơi của ván đấu này |
| 404 | `GAME_NOT_FOUND` | Không tìm thấy ván đấu |
| 409 | `REPORT_DUPLICATE` | Bạn đã báo cáo ván đấu này rồi |
