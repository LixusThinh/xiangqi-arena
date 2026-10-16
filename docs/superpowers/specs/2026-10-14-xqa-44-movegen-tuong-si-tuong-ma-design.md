# Thiết kế Kỹ thuật XQA-44: Bộ Sinh & Kiểm Tra Nước Đi cho Tướng, Sĩ, Tượng, Mã

- **Mã tính năng / Nhánh**: `feat/XQA-44-MoveGen-Tuong-Si-Tuong-Ma`
- **Gói áp dụng**: `@xiangqi-arena/xiangqi-core` & `apps/web`
- **Ngày cập nhật**: 14/10/2026
- **Trạng thái**: Đã thống nhất (Approved)

---

## 1. Mục tiêu & Phạm vi

1. **Core Engine (`@xiangqi-arena/xiangqi-core`)**:
   - Hoàn thiện bộ sinh nước đi vật lý (pseudo-legal) cho 4 quân cờ:
     - **Tướng (King - `k`)**: 1 ô trực giao trong Cung; hỗ trợ bay tướng ăn Tướng đối phương (Flying General) khi không có quân cản.
     - **Sĩ (Advisor - `a`)**: 1 ô chéo giữa 5 vị trí trong Cung.
     - **Tượng (Elephant - `b`)**: 2 ô chéo (chữ Điền), không qua sông, kiểm tra cản mắt Tượng.
     - **Mã (Horse - `n`)**: Đi chữ L (8 hướng), kiểm tra cản chân Mã tại 4 hướng trực giao.
   - Các quân chưa hỗ trợ trong ticket này: **Xe (`r`), Pháo (`c`), Tốt (`p`)** tạm thời sinh ra 0 nước đi (`[]`) và chờ ticket `XQA-45`.
   - Bổ sung hàm kiểm tra tính hợp lệ của nước đi:
     ```typescript
     Position.prototype.isLegalMove(move: Move): boolean
     ```
     Nước đi được coi là hợp lệ nếu ô `from` có quân thuộc lượt đi (`sideToMove`), và ô `to` nằm trong danh sách nước đi sinh ra từ `generatePieceMoves(from)`.
   - Lưu ý phạm vi: Chưa áp dụng kiểm tra chống tự sát / chiếu tướng (`isChecked`).

2. **Web Client (`apps/web`)**:
   - **Gợi ý nước đi (Move Hints)**:
     - Component `Board.tsx` nhận thêm prop `validMoves?: number[]`.
     - Khi chọn một quân cờ (Tướng, Sĩ, Tượng, Mã), bàn cờ hiển thị điểm đánh dấu gợi ý tại các ô đích hợp lệ:
       - Ô trống: chấm tròn xanh bán trong suốt (`fill="rgba(34, 197, 94, 0.55)"`).
       - Ô có quân địch (ăn quân): vòng tròn bao quanh quân địch (`stroke="rgba(239, 68, 68, 0.85)"`).
   - **Chặn nước đi không hợp lệ**:
     - `ArenaPage` (`apps/web/app/page.tsx`): Khi click vào ô đích hoặc quân địch, chỉ thực hiện `applyMove` nếu `position.isLegalMove({ from: selectedSquare, to: sq }) === true`.
     - Quân Xe, Pháo, Tốt bị khóa (không sinh nước đi hợp lệ, không thể di chuyển cho đến ticket XQA-45).

---

## 2. Ràng buộc Kỹ thuật

- **Pure TypeScript & Zero Dependencies** trong `xiangqi-core`.
- **Hệ toạ độ 1D (0..89)**: `col = sq % 9`, `row = Math.floor(sq / 9)`.
- **Tương thích ngược**: Giữ nguyên tính toàn vẹn của `applyMove` và `undoMove` cho việc kiểm thử và lưu lịch sử.
- **TDD (Test-Driven Development)**: 100% chức năng mới có bài kiểm thử tương ứng ở cả `xiangqi-core` và `apps/web`.
- **Hiệu năng**: Các phép toán kiểm tra nước đi và render gợi ý đều thực hiện tức thì ($O(1)$).

---

## 3. Chi tiết API & Kiến trúc

### 3.1. `Position.prototype.isLegalMove(move: Move): boolean`
```typescript
isLegalMove(move: Move): boolean {
  const { from, to } = move;
  if (!isValidSquare(from) || !isValidSquare(to) || from === to) {
    return false;
  }
  const piece = this.board[from];
  if (!piece || piece.color !== this.sideToMove) {
    return false;
  }
  const legalMoves = this.generatePieceMoves(from);
  return legalMoves.some((m) => m.to === to);
}
```

### 3.2. `Board.tsx` Prop & SVG Overlay
```typescript
export interface BoardProps {
  board?: (Piece | null)[];
  fen?: string;
  position?: Position;
  orientation?: 'r' | 'b';
  selectedSquare?: number | null;
  lastMove?: { from: number; to: number } | null;
  validMoves?: number[]; // <-- Mảng danh sách ô đích hợp lệ
  onSquareClick?: (square: number) => void;
  className?: string;
}
```

Trong SVG của `Board.tsx`:
Thêm Layer `validMoves` hiển thị giữa Layer tương tác click và Layer quân cờ (hoặc ngay trên Layer click):
- Duyệt qua `validMoves`:
  - Lấy tọa độ tâm: `cx = coords.x + CELL_SIZE / 2`, `cy = coords.y + CELL_SIZE / 2`.
  - Nếu `board[sq]` có quân đối phương: vẽ `circle` viền đỏ (`r = CELL_SIZE * 0.42`, `fill="none"`, `stroke="rgba(239, 68, 68, 0.85)"`, `strokeWidth={3}`).
  - Nếu `board[sq] === null`: vẽ `circle` chấm xanh (`r = CELL_SIZE * 0.16`, `fill="rgba(34, 197, 94, 0.6)"`).

### 3.3. `handleSquareClick` trong `ArenaPage`
1. Khi chọn quân đồng minh:
   - `setSelectedSquare(sq)`.
   - Tính `const validMoves = position.generatePieceMoves(sq).map(m => m.to)`.
   - `setValidMoves(validMoves)`.
2. Khi bấm ô đích (ô trống hoặc quân địch):
   - Gọi `position.isLegalMove({ from: selectedSquare, to: sq })`.
   - Nếu `false`: bỏ qua (không đi cờ).
   - Nếu `true`:
     - Thực hiện `position.applyMove({ from: selectedSquare, to: sq })`.
     - Cập nhật bàn cờ, xóa `selectedSquare`, xóa `validMoves`.

---

## 4. Cấu trúc File

```text
packages/xiangqi-core/
├── src/
│   ├── movegen/
│   │   ├── king.ts          # King moves + Flying General check
│   │   ├── advisor.ts       # Advisor moves
│   │   ├── elephant.ts      # Elephant moves + Eye blocking
│   │   ├── horse.ts         # Horse moves + Leg blocking
│   │   └── index.ts         # Dispatcher & re-exports
│   ├── position.ts          # Position class with isLegalMove & generatePieceMoves
│   └── index.ts             # Public exports
└── tests/
    └── position-islegal.spec.ts # Tests for isLegalMove

apps/web/
├── components/
│   └── Board.tsx            # Support validMoves visual hint dots/rings
├── app/
│   └── page.tsx             # Enforce isLegalMove and manage validMoves state
└── tests/
    ├── Board.spec.tsx       # Tests for validMoves rendering in Board
    └── gameplay.spec.tsx    # Tests for valid move enforcement and locked pieces
```
