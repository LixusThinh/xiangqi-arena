# Contract REST Room v0.1

XQA-69 · Story XQA-20 · FR-05, FR-06. Dành cho FE màn Sảnh (XQA-70), link mời (XQA-72), Phòng chờ (XQA-71) và GameService (XQA-74).

- **Base URL local:** `http://localhost:3000`, JSON UTF-8, không có tiền tố `/api`.
- Mọi endpoint cần `Authorization: Bearer <accessToken>` (lỗi xác thực theo [Auth contract](./auth.md)).
- `id` của user/match là chuỗi số thập phân (PostgreSQL `BIGINT`).

## Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| R-01 | Phòng tối đa 2 người. Mã phòng 8 ký tự `A-Z` trừ `I`, `O` và số `2-9` (bỏ ký tự dễ nhầm); không phân biệt hoa/thường khi gọi API. |
| R-02 | Phòng mới ở trạng thái `WAITING`, chủ phòng là thành viên đầu tiên. |
| R-03 | Người thứ 2 vào → phòng `PLAYING`, chia màu, tạo `Match` trạng thái `WAITING` (đồng hồ = `baseTimeSec` của RuleProfile). GameService (XQA-74) chuyển Match sang `ACTIVE` khi bắt đầu ván. |
| R-04 | `hostColorPref`: `RED` / `BLACK` = chủ phòng cầm màu đó; `RANDOM` = bốc ngẫu nhiên lúc đủ người. Đỏ đi trước. |
| R-05 | Phòng `PRIVATE` không hiện ở Sảnh nhưng ai có mã (link mời) đều vào được. |
| R-06 | Mỗi người chỉ ở 1 phòng `WAITING`/`PLAYING` tại một thời điểm. |
| R-07 | Chỉ rời được khi phòng còn `WAITING`. Phòng `WAITING` chỉ có chủ phòng, nên chủ phòng rời = phòng `CANCELLED`. Ván đã bắt đầu thì phải xin thua (XQA-91). |

## 1. Tạo phòng — `POST /rooms` → `201`

```json
{
  "name": "Phòng luyện tập",
  "visibility": "PUBLIC",
  "hostColorPref": "RANDOM",
  "ruleProfileCode": "VN_STANDARD"
}
```

Mọi field đều tùy chọn. Mặc định: `name` = `"Phòng của <displayName>"` (1–80 ký tự), `visibility` = `PUBLIC`, `hostColorPref` = `RANDOM`, `ruleProfileCode` = `VN_STANDARD` (seed có `VN_STANDARD` 10 phút, `ONLINE_RAPID` 5 phút + 2 giây). Trả `RoomDetail`.

## 2. Danh sách phòng ở Sảnh — `GET /rooms` → `200`

Mảng `RoomSummary` của phòng `PUBLIC` + `WAITING`, mới nhất trước, tối đa 50. Chưa có realtime: FE gọi lại định kỳ (gợi ý 3 giây) cho tới khi Socket gateway có sự kiện `room:list` / `room:update`.

## 3. Chi tiết phòng — `GET /rooms/:code` → `200`

Trả `RoomDetail`. Dùng cho màn Phòng chờ và mở link mời. Màn Phòng chờ gọi lại định kỳ để biết khi nào `status` đổi sang `PLAYING`.

## 4. Phòng hiện tại của tôi — `GET /rooms/current` → `200`

`{ "room": RoomDetail | null }` — phòng `WAITING`/`PLAYING` người dùng đang ở. FE dùng để đưa người chơi quay lại phòng sau khi tải lại trang.

## 5. Vào phòng — `POST /rooms/:code/join` → `200`

Không có body. Trả `RoomDetail` sau khi vào. Gọi lại khi đã ở trong phòng đó vẫn trả `200` (idempotent).

## 6. Rời phòng — `POST /rooms/:code/leave` → `204`

Không có body. Phòng đã `FINISHED`/`CANCELLED` cũng trả `204`.

## Kiểu dữ liệu

```jsonc
// RoomSummary
{
  "code": "K7MPQ2XA",
  "name": "Phòng của Chủ Phòng",
  "visibility": "PUBLIC",          // PUBLIC | PRIVATE
  "status": "WAITING",             // WAITING | PLAYING | FINISHED | CANCELLED
  "hostColorPref": "RANDOM",       // RED | BLACK | RANDOM
  "ruleProfile": { "code": "VN_STANDARD", "baseTimeSec": 600, "incrementSec": 0, "isRanked": false },
  "host": { "id": "1", "username": "host1", "displayName": "Chủ Phòng", "rating": 1200 },
  "playerCount": 1,
  "createdAt": "2026-10-21T08:00:00.000Z"
}

// RoomDetail = RoomSummary + 
{
  "members": [
    { "id": "1", "username": "host1", "displayName": "Chủ Phòng", "rating": 1200,
      "isHost": true, "color": null, "joinedAt": "2026-10-21T08:00:00.000Z" }
  ],
  "matchId": null                  // chuỗi id khi phòng đã PLAYING
}
```

`members[].color` là `"RED"` / `"BLACK"` khi phòng `PLAYING`, `null` khi còn `WAITING`.

## Mã lỗi

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Field sai kiểu/giá trị, hoặc `ruleProfileCode` không tồn tại (`details[].field = "ruleProfileCode"`) |
| 403 | `ROOM_NOT_MEMBER` | Rời phòng mình không ở trong |
| 404 | `ROOM_NOT_FOUND` | Mã phòng không tồn tại hoặc sai định dạng |
| 409 | `ROOM_FULL` | Phòng đã đủ 2 người / đang chơi |
| 409 | `ROOM_CLOSED` | Vào phòng đã `FINISHED` hoặc `CANCELLED` |
| 409 | `ROOM_USER_BUSY` | Đang ở một phòng `WAITING`/`PLAYING` khác (`message` có mã phòng đó) |
| 409 | `ROOM_ALREADY_STARTED` | Rời phòng khi ván đã bắt đầu |

## Việc còn mở (cần Kiệt/Phát xác nhận)

1. Đổi cơ chế gọi lại định kỳ sang sự kiện Socket.IO khi gateway (contract XQA-60) được merge.
2. Phát xác nhận cách GameService nhận `Match` ở trạng thái `WAITING` (R-03) có khớp thiết kế XQA-74 không.
