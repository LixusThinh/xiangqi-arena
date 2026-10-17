# Tài liệu Đặc tả & Kiến trúc Test Fixture Luật Đi Quân (XQA-47 / XQA-48)

Tài liệu kiểm định và quy cách bộ dữ liệu fixture kiểm thử luật đi quân Cờ Tướng trong dự án Xiangqi Arena.

## 1. Mục tiêu và Phạm vi
- **Ticket XQA-47**: Xây dựng bộ test case luật đi quân chuẩn hóa dạng JSON (`rules-movegen.fixture.json`).
- **Ticket XQA-48**: Xây dựng Test Runner và tích hợp CI Harness chạy tự động, báo cáo pass/fail chi tiết từng test case trên pipeline CI.
- **Yêu cầu độ phủ (Acceptance Criteria)**:
  - Tối thiểu ≥50 test cases, bao phủ toàn bộ 7 loại quân cờ: Tướng (`k`), Sĩ (`a`), Tượng (`b`), Mã (`n`), Xe (`r`), Pháo (`c`), Tốt (`p`).
  - Bao gồm cả ca hợp lệ (`expectedLegal: true`) và ca bất hợp lệ (`expectedLegal: false`).
  - Mỗi test case được gắn Requirement ID rõ ràng (`FR-08`, `FR-11`, `FR-12`, `FR-13`, `Điều 7.1b`).
  - Gắn trạng thái thực thi (`status: "active" | "pending"`) và mã ticket phụ thuộc (`blockedBy`).

## 2. Quy cách Cấu trúc Test Case (Schema)

```json
{
  "id": "TC-FR12-N01",
  "requirementId": "FR-12",
  "piece": "n",
  "color": "r",
  "description": "Mô tả hành vi nước đi cần kiểm thử",
  "fen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1",
  "move": {
    "from": 82,
    "to": 66,
    "fromAlgebraic": "b9",
    "toAlgebraic": "a7"
  },
  "expectedLegal": true,
  "status": "active",
  "blockedBy": null,
  "reason": "Giải thích chi tiết căn cứ theo luật cờ"
}
```

Đối với các ca kiểm thử thế cờ toàn cục (ví dụ thế bí theo Điều 7.1b):
```json
{
  "id": "TC-7.1B-STALEMATE-01",
  "kind": "noLegalMoves",
  "requirementId": "Điều 7.1b",
  "color": "b",
  "description": "Thế bí hợp lệ bên Đen (Stalemate)",
  "fen": "3k5/9/9/2N6/9/9/9/9/9/4K4 b - - 0 1",
  "expected": true,
  "status": "pending",
  "blockedBy": "XQA-49",
  "reason": "Chứng minh không có nước đi hợp lệ..."
}
```

## 3. Quản lý trạng thái Ca kiểm thử (`status` & `blockedBy`)
- **`active`**: Áp dụng cho các quân cờ và quy tắc đã được implement MoveGen trong engine (Tướng, Sĩ, Tượng, Mã). Nếu ca active thất bại, test harness sẽ exit với mã lỗi `1`.
- **`pending`**:
  - `blockedBy: "XQA-45"`: Áp dụng cho tất cả các ca của Xe, Pháo, Tốt (chờ hoàn thành MoveGen cho 3 quân này).
  - `blockedBy: "XQA-49"`: Áp dụng cho các ca kiểm tra chống lộ mặt Tướng và thế cờ bí nước toàn cục.

## 4. Báo cáo Thực thi CI
Khi pipeline CI thực thi lệnh `pnpm --filter @xiangqi-arena/xiangqi-core test:harness`, kết quả chạy động sẽ được ghi nhận tự động vào artifact `packages/xiangqi-core/reports/rules-harness-report.md` và hiển thị trên GitHub Step Summary cũng như GitHub Checks.
