# Contract REST History v0.1

XQA-97 · Story XQA-27 · FR-17. Dành cho FE trang Lịch sử (XQA-98) và Replay (XQA-33).

- **Base URL local:** `http://localhost:3000`, JSON UTF-8, không có tiền tố `/api`.
- Mọi endpoint cần `Authorization: Bearer <accessToken>` (lỗi xác thực theo [Auth contract](./auth.md)).
- `id` của user/match là chuỗi số thập phân (PostgreSQL `BIGINT`). Thời điểm là chuỗi ISO 8601 UTC.

## Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| H-01 | Chỉ trả ván người gọi là Đỏ hoặc Đen. Ván của người khác trả `404`, không phân biệt với ván không tồn tại. |
| H-02 | Chỉ trả ván `FINISHED`. Ván đang chơi đọc qua `GET /matches/:id` ([Game contract](./game.md)). |
| H-03 | Sắp xếp: ván kết thúc gần nhất lên đầu (`endedAt` giảm dần, trùng thì `matchId` giảm dần). |
| H-04 | `outcome` tính theo góc nhìn người gọi: `WIN` / `LOSS` / `DRAW`. `result` giữ nguyên giá trị lưu DB (`RED_WIN` / `BLACK_WIN` / `DRAW`). |
| H-05 | `plyCount` là tổng số lần đi của **cả hai bên** (Đỏ đi 1 lần = 1, Đen đi 1 lần = 1). FE muốn hiện "số nước" theo kiểu cặp Đỏ–Đen thì làm tròn lên `ceil(plyCount / 2)`. |
| H-06 | `ratingChange` chỉ có khi ván có bản ghi `RatingHistory` (ván tính Elo, XQA-40). Ván `VN_STANDARD` không tính Elo → `null`, FE hiện "không tính". |

## 1. Danh sách ván đã chơi — `GET /me/matches` → `200`

Query (tùy chọn):

| Tham số | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `page` | số nguyên | `1` | ≥ 1 |
| `pageSize` | số nguyên | `20` | 1–50 |

Sai ràng buộc → `400 VALIDATION_ERROR`, `details[].field` là tên tham số. Trang vượt quá số trang trả `items: []`, vẫn `200`.

```jsonc
{
  "items": [MatchHistoryItem],
  "page": 1,
  "pageSize": 20,
  "total": 37,       // tổng số ván FINISHED của người gọi
  "totalPages": 2
}
```

## 2. Chi tiết ván — `GET /me/matches/:id` → `200`

Trả `MatchHistoryDetail`. Dùng cho trang chi tiết và Replay: FE có sẵn `initialFen` + `moves[].fenAfter` nên nhảy tới nước bất kỳ không cần tự đi lại từ đầu.

## Kiểu dữ liệu

```jsonc
// MatchHistoryItem
{
  "matchId": "12",
  "roomCode": "K7MPQ2XA",
  "ruleProfileCode": "VN_STANDARD",
  "isRanked": false,
  "yourColor": "RED",                    // RED | BLACK
  "opponent": { "id": "2", "username": "player2", "displayName": "Người chơi 2", "rating": 1200 },
  "outcome": "WIN",                      // WIN | LOSS | DRAW
  "result": "RED_WIN",                   // RED_WIN | BLACK_WIN | DRAW
  "endReason": "CHECKMATE",              // xem bảng dưới
  "plyCount": 41,
  "startedAt": "2026-10-20T08:00:00.000Z",
  "endedAt": "2026-10-20T08:12:30.000Z",
  "durationSec": 750                     // null nếu thiếu startedAt/endedAt
}

// MatchHistoryDetail = MatchHistoryItem +
{
  "initialFen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1",
  "finalFen": "…",
  "ratingChange": { "before": 1200, "after": 1216, "delta": 16 },   // hoặc null (H-06)
  "moves": [
    {
      "ply": 1,
      "color": "RED",                    // ply lẻ = Đỏ, ply chẵn = Đen
      "from": "h7", "to": "e7",          // ô a0..i9, hàng 0 = hàng đáy bên Đen (như xiangqi-core)
      "piece": "C",                      // ký tự quân theo FEN: chữ hoa = Đỏ, chữ thường = Đen
      "captured": null,
      "isCheck": false,
      "thinkTimeMs": 3200,
      "fenAfter": "…"
    }
  ]
}
```

`endReason` (enum `MatchEndReason` trong schema):

| Giá trị | Nghĩa hiển thị gợi ý |
|---|---|
| `CHECKMATE` | Chiếu bí |
| `STALEMATE` | Hết nước đi – bên hết nước **thua** (Điều 7.1b), khác cờ vua. Tên enum đang chờ chốt ở SRS v2 (XQA-84) |
| `RESIGNATION` | Xin thua |
| `TIMEOUT` | Hết giờ |
| `DISCONNECT` | Mất kết nối quá thời gian chờ |
| `DRAW_AGREEMENT` | Hòa theo thỏa thuận |
| `REPETITION` | Xử theo luật lặp nước (Điều 23) |
| `MOVE_LIMIT` | Hết số nước tự nhiên |

## Mã lỗi

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `page` / `pageSize` sai kiểu hoặc ngoài khoảng |
| 401 | (theo Auth contract) | Thiếu / sai / hết hạn access token |
| 404 | `HISTORY_NOT_FOUND` | `id` sai định dạng, không tồn tại, chưa `FINISHED`, hoặc người gọi không phải người chơi của ván |

## Việc còn mở

1. `GET /matches/:id` (XQA-74) hiện cho mọi người đã đăng nhập đọc trạng thái ván bất kỳ (`yourColor: null`). Nếu AC "chỉ xem được ván của mình" áp cho cả ván đang chơi thì cần Phát chặn ở GameService; nếu muốn giữ cho tính năng người xem (spectator) thì ghi thành business rule.
2. Ván `ABORTED` chưa có luồng nào tạo ra nên chưa đưa vào lịch sử. Khi XQA-93 (mất kết nối) dùng `ABORTED`, cần chốt có hiện ở lịch sử không.
