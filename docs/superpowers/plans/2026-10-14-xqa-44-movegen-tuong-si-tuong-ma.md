# XQA-44 MoveGen & Move Legality Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế kiểm tra nước đi hợp lệ (`isLegalMove`) cho 4 quân Tướng, Sĩ, Tượng, Mã trong `@xiangqi-arena/xiangqi-core`, tạm khóa các quân Xe, Pháo, Tốt, và tích hợp giao diện gợi ý nước đi (`validMoves`) kèm chặn thao tác sai luật trên Web UI (`apps/web`).

**Architecture:** 
1. `@xiangqi-arena/xiangqi-core`: Bổ sung method `isLegalMove(move: Move): boolean` vào lớp `Position`. Phương thức này xác thực ô xuất phát có quân thuộc lượt đi hiện tại (`sideToMove`), và ô đích nằm trong danh sách nước đi pseudo-legal sinh ra bởi `generatePieceMoves(from)`. Các quân chưa làm movegen ('r', 'c', 'p') sinh ra mảng rỗng `[]` nên tự động không thể đi.
2. `apps/web/components/Board.tsx`: Bổ sung prop `validMoves?: number[]`. Render các điểm gợi ý SVG (chấm tròn xanh cho ô trống, vòng tròn cảnh báo đỏ cho ô ăn quân đối thủ).
3. `apps/web/app/page.tsx`: Quản lý state `validMoves`. Khi click chọn quân phe mình, tính toán các ô hợp lệ để hiển thị gợi ý. Khi click ô đích, chỉ thực hiện `applyMove` nếu `position.isLegalMove(move)` trả về true.

**Tech Stack:** TypeScript strict, Jest 29+ (`ts-jest`), React 19, Next.js 15, Tailwind CSS, pnpm workspaces monorepo.

**Spec:** [docs/superpowers/specs/2026-10-14-xqa-44-movegen-tuong-si-tuong-ma-design.md](../specs/2026-10-14-xqa-44-movegen-tuong-si-tuong-ma-design.md)

## Global Constraints

- Pure TypeScript không dependency ngoài trong `xiangqi-core`.
- Zero ESLint warnings / errors trên cả `xiangqi-core` và `web`.
- Tất cả unit tests và integration tests phải pass 100%.
- Không phá vỡ chức năng Undo Move (`XQA-42`) và bộ đếm thời gian.

---

### Task 1: Thêm `Position.prototype.isLegalMove` trong `@xiangqi-arena/xiangqi-core`

**Files:**
- Create: `packages/xiangqi-core/tests/position-islegal.spec.ts`
- Modify: `packages/xiangqi-core/src/position.ts`

**Interfaces:**
- Consumes: `Move`, `Square`, `isValidSquare`, `this.board`, `this.sideToMove`, `this.generatePieceMoves`
- Produces: `Position.prototype.isLegalMove(move: Move): boolean`

- [ ] **Step 1: Viết failing test trong `packages/xiangqi-core/tests/position-islegal.spec.ts`**

```typescript
import { Position } from '../src';

describe('Position.isLegalMove', () => {
  it('returns false for invalid squares or from === to', () => {
    const pos = Position.initial();
    expect(pos.isLegalMove({ from: -1, to: 10 })).toBe(false);
    expect(pos.isLegalMove({ from: 10, to: 90 })).toBe(false);
    expect(pos.isLegalMove({ from: 66, to: 66 })).toBe(false);
  });

  it('returns false when source square is empty or has opponent piece', () => {
    const pos = Position.initial(); // sideToMove is 'r'
    expect(pos.isLegalMove({ from: 40, to: 41 })).toBe(false); // Empty square
    expect(pos.isLegalMove({ from: 1, to: 19 })).toBe(false); // Black horse on Red turn
  });

  it('validates legal and illegal moves for Horse (Mã) including leg blocking', () => {
    const pos = Position.initial();
    // Red Horse at b0 (sq 82): legal moves to a2 (sq 63), c2 (sq 65)
    expect(pos.isLegalMove({ from: 82, to: 63 })).toBe(true);
    expect(pos.isLegalMove({ from: 82, to: 65 })).toBe(true);
    // Invalid jumping to illegal squares
    expect(pos.isLegalMove({ from: 82, to: 73 })).toBe(false);
    expect(pos.isLegalMove({ from: 82, to: 0 })).toBe(false);

    // Block Red horse leg at sq 73 with a custom fen
    const blockedFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/1P7/RNBAKABNR r - - 0 1';
    const blockedPos = Position.fromFen(blockedFen);
    // Red horse at sq 82 has leg blocked at sq 73 by pawn (sq 73)
    expect(blockedPos.isLegalMove({ from: 82, to: 63 })).toBe(false);
    expect(blockedPos.isLegalMove({ from: 82, to: 65 })).toBe(false);
  });

  it('validates legal and illegal moves for Elephant (Tượng)', () => {
    const pos = Position.initial();
    // Red Elephant at c0 (sq 83): legal moves to a2 (sq 63), e2 (sq 67)
    expect(pos.isLegalMove({ from: 83, to: 63 })).toBe(true);
    expect(pos.isLegalMove({ from: 83, to: 67 })).toBe(true);
    // Cannot move across river or arbitrary square
    expect(pos.isLegalMove({ from: 83, to: 47 })).toBe(false);
  });

  it('validates legal and illegal moves for Advisor (Sĩ) and King (Tướng)', () => {
    const pos = Position.initial();
    // Red Advisor at d0 (sq 84): legal move to e1 (sq 76)
    expect(pos.isLegalMove({ from: 84, to: 76 })).toBe(true);
    // Red King at e0 (sq 85): all adjacent palace squares occupied by friendly pieces initially
    expect(pos.isLegalMove({ from: 85, to: 76 })).toBe(false);
    expect(pos.isLegalMove({ from: 85, to: 84 })).toBe(false);
  });

  it('returns false for locked pieces: Chariot (Xe), Cannon (Pháo), Soldier (Tốt)', () => {
    const pos = Position.initial();
    // Red Chariot at a0 (sq 81)
    expect(pos.isLegalMove({ from: 81, to: 72 })).toBe(false);
    // Red Cannon at b2 (sq 64)
    expect(pos.isLegalMove({ from: 64, to: 67 })).toBe(false);
    // Red Soldier at c3 (sq 56)
    expect(pos.isLegalMove({ from: 56, to: 47 })).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy lệnh:
```bash
pnpm --filter @xiangqi-arena/xiangqi-core test tests/position-islegal.spec.ts
```
Kỳ vọng: Lỗi biên dịch `Property 'isLegalMove' does not exist on type 'Position'`.

- [ ] **Step 3: Hiện thực `isLegalMove` trong `packages/xiangqi-core/src/position.ts`**

Mở `packages/xiangqi-core/src/position.ts` và thêm method:
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

- [ ] **Step 4: Chạy lại test suite để xác nhận pass**

Chạy:
```bash
pnpm --filter @xiangqi-arena/xiangqi-core test
```
Kỳ vọng: Toàn bộ test suites (bao gồm 9 test cũ + 1 test mới) đều PASS.

- [ ] **Step 5: Kiểm tra lint và commit**

```bash
pnpm --filter @xiangqi-arena/xiangqi-core lint
git add packages/xiangqi-core/src/position.ts packages/xiangqi-core/tests/position-islegal.spec.ts
git commit -m "feat(xiangqi-core): add isLegalMove method to Position class [XQA-44]"
```

---

### Task 2: Thêm lớp hiển thị gợi ý nước đi (`validMoves`) vào `Board.tsx`

**Files:**
- Modify: `apps/web/components/Board.tsx`
- Modify: `apps/web/tests/Board.spec.tsx`

**Interfaces:**
- Consumes: `validMoves?: number[]`
- Produces: SVG circles/indicators trên các ô đích hợp lệ với `data-testid="hint-sq-${sq}"` và thuộc tính xác định capture vs peaceful move.

- [ ] **Step 1: Thêm test trong `apps/web/tests/Board.spec.tsx`**

Thêm describe block:
```tsx
  it('renders move hints when validMoves prop is provided', () => {
    // Square 63 is empty, square 67 is occupied by enemy piece in custom FEN
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2n4/9/RNBAKAB1R r - - 4 10';
    render(
      <Board
        fen={customFen}
        selectedSquare={82}
        validMoves={[63, 67]}
      />
    );

    const hint63 = screen.getByTestId('hint-sq-63');
    expect(hint63).toBeInTheDocument();
    expect(hint63.getAttribute('data-hint-type')).toBe('peaceful');

    const hint67 = screen.getByTestId('hint-sq-67');
    expect(hint67).toBeInTheDocument();
    expect(hint67.getAttribute('data-hint-type')).toBe('capture');
  });

  it('renders no move hints when validMoves is empty or not provided', () => {
    render(<Board selectedSquare={82} validMoves={[]} />);
    expect(screen.queryByTestId(/hint-sq-/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Chạy test để xác nhận fail**

```bash
pnpm --filter @xiangqi-arena/web test tests/Board.spec.tsx
```
Kỳ vọng: FAIL do chưa render `hint-sq-*`.

- [ ] **Step 3: Cập nhật `apps/web/components/Board.tsx`**

1. Mở rộng `BoardProps`:
```typescript
export interface BoardProps {
  board?: (Piece | null)[];
  fen?: string;
  position?: Position;
  orientation?: 'r' | 'b';
  selectedSquare?: number | null;
  lastMove?: { from: number; to: number } | null;
  validMoves?: number[]; // <-- Mảng ô hợp lệ để gợi ý
  onSquareClick?: (square: number) => void;
  className?: string;
}
```

2. Render SVG Hints Layer trong SVG (ngay sau Layer 2b highlight selectedSquare và trước hoặc sau Layer click):
```tsx
        {/* Layer 2c: Gợi ý các ô đi hợp lệ (validMoves) */}
        {validMoves && validMoves.length > 0 && validMoves.map((sq) => {
          if (!isValidSquare(sq)) return null;
          const coords = getSquareCoordinates(sq, orientation);
          const targetPiece = boardArray[sq];
          const isCapture = targetPiece !== null && targetPiece !== undefined;
          const cx = coords.x + CELL_SIZE / 2;
          const cy = coords.y + CELL_SIZE / 2;

          if (isCapture) {
            return (
              <circle
                key={`hint-${sq}`}
                data-testid={`hint-sq-${sq}`}
                data-hint-type="capture"
                cx={cx}
                cy={cy}
                r={CELL_SIZE * 0.42}
                fill="none"
                stroke="rgba(239, 68, 68, 0.85)"
                strokeWidth={3}
                strokeDasharray="4 2"
                className="pointer-events-none animate-pulse"
              />
            );
          }

          return (
            <circle
              key={`hint-${sq}`}
              data-testid={`hint-sq-${sq}`}
              data-hint-type="peaceful"
              cx={cx}
              cy={cy}
              r={CELL_SIZE * 0.16}
              fill="rgba(34, 197, 94, 0.65)"
              className="pointer-events-none"
            />
          );
        })}
```

- [ ] **Step 4: Chạy lại test suite của `Board.spec.tsx`**

```bash
pnpm --filter @xiangqi-arena/web test tests/Board.spec.tsx
```
Kỳ vọng: PASS toàn bộ.

- [ ] **Step 5: Kiểm tra lint và commit**

```bash
pnpm --filter @xiangqi-arena/web lint
git add apps/web/components/Board.tsx apps/web/tests/Board.spec.tsx
git commit -m "feat(web): render move hints on board for valid destination squares [XQA-44]"
```

---

### Task 3: Chặn nước đi sai luật và tích hợp gợi ý trên `ArenaPage` (`apps/web/app/page.tsx`)

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/tests/gameplay.spec.tsx`

**Interfaces:**
- Consumes: `position.isLegalMove(move)`, `position.generatePieceMoves(sq)`, `<Board validMoves={validMoves} ... />`
- Produces: Web UI chỉ cho phép đi nước cờ hợp lệ của Tướng, Sĩ, Tượng, Mã; hiển thị gợi ý khi chọn quân; khóa Xe, Pháo, Tốt.

- [ ] **Step 1: Thêm integration tests trong `apps/web/tests/gameplay.spec.tsx`**

```tsx
  it('displays move hints when selecting friendly Horse and blocks illegal moves', () => {
    render(<ArenaPage />);

    // Click Red Horse at b0 (sq 82)
    const redHorse = screen.getByTestId('piece-82');
    fireEvent.click(redHorse);

    // Expect valid move hints for sq 63 and sq 65
    expect(screen.getByTestId('hint-sq-63')).toBeInTheDocument();
    expect(screen.getByTestId('hint-sq-65')).toBeInTheDocument();

    // Click an illegal empty square (e.g. sq 73 directly in front of Horse)
    const illegalCell = screen.getByTestId('cell-73');
    fireEvent.click(illegalCell);

    // Horse should NOT move, turn should remain Red ('r')
    expect(screen.getByTestId('piece-82')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-73')).not.toBeInTheDocument();
    expect(screen.getByText('Đỏ (Đi trước)')).toBeInTheDocument();

    // Click legal destination sq 63
    const legalCell = screen.getByTestId('cell-63');
    fireEvent.click(legalCell);

    // Horse should now be at sq 63, sq 82 is empty, turn toggles to Black ('b'), hints cleared
    expect(screen.getByTestId('piece-63')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-82')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-sq-63')).not.toBeInTheDocument();
    expect(screen.getByText('Đen')).toBeInTheDocument();
  });

  it('keeps locked pieces (Chariot, Cannon, Soldier) immovable', () => {
    render(<ArenaPage />);

    // Click Red Soldier at sq 56
    const soldier = screen.getByTestId('piece-56');
    fireEvent.click(soldier);

    // No hints rendered
    expect(screen.queryByTestId(/hint-sq-/)).not.toBeInTheDocument();

    // Click forward sq 47
    fireEvent.click(screen.getByTestId('cell-47'));

    // Soldier should NOT move
    expect(screen.getByTestId('piece-56')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-47')).not.toBeInTheDocument();
    expect(screen.getByText('Đỏ (Đi trước)')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Chạy test để xác nhận fail**

```bash
pnpm --filter @xiangqi-arena/web test tests/gameplay.spec.tsx
```
Kỳ vọng: FAIL vì hiện tại quân lính và mã vẫn đi được mọi ô mà không bị chặn.

- [ ] **Step 3: Cập nhật `apps/web/app/page.tsx`**

1. Thêm state `validMoves`:
```typescript
  const [validMoves, setValidMoves] = useState<number[]>([]);
```

2. Cập nhật hàm tính gợi ý:
```typescript
  const updateValidMovesForPiece = (sq: number | null) => {
    if (sq === null) {
      setValidMoves([]);
      return;
    }
    const moves = position.generatePieceMoves(sq);
    setValidMoves(moves.map((m) => m.to));
  };
```

3. Cập nhật `handleSquareClick`:
```typescript
  const handleSquareClick = (sq: number) => {
    const clickedPiece = board[sq];

    // 1. If no piece selected: selecting any square with a piece of the active side selects it
    if (selectedSquare === null) {
      if (clickedPiece && clickedPiece.color === sideToMove) {
        setSelectedSquare(sq);
        updateValidMovesForPiece(sq);
      }
      return;
    }

    const currentPiece = board[selectedSquare];
    if (!currentPiece) {
      if (clickedPiece && clickedPiece.color === sideToMove) {
        setSelectedSquare(sq);
        updateValidMovesForPiece(sq);
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    // 2. Re-clicking the selected piece: deselects it
    if (sq === selectedSquare) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    // 3. Clicking another friendly piece: switches selection without moving
    if (clickedPiece && clickedPiece.color === currentPiece.color) {
      setSelectedSquare(sq);
      updateValidMovesForPiece(sq);
      return;
    }

    // 4. Clicking destination square: validate legal move
    const move = { from: selectedSquare, to: sq };
    if (!position.isLegalMove(move)) {
      // Invalid move according to piece movement rules: ignore
      return;
    }

    const undoInfo = position.applyMove(move);
    setUndoHistory((prev) => [...prev, { undo: undoInfo, prevLastMove: lastMove }]);
    setBoard([...position.board]);
    setLastMove(move);
    setSelectedSquare(null);
    setValidMoves([]);

    const nextSide = position.sideToMove;
    setSideToMove(nextSide);
    if (nextSide === 'r') {
      setRedTimer(60);
    } else {
      setBlackTimer(60);
    }
  };
```

4. Cập nhật `handleUndoMove` và `handleResetGame`:
   - Reset `setValidMoves([])`.

5. Truyền `validMoves` vào `<Board ... validMoves={validMoves} />`.

- [ ] **Step 4: Chạy test gameplay và toàn bộ frontend test suite**

```bash
pnpm --filter @xiangqi-arena/web test
```
Kỳ vọng: Toàn bộ test của web app đều PASS.

- [ ] **Step 5: Kiểm tra lint và commit**

```bash
pnpm --filter @xiangqi-arena/web lint
git add apps/web/app/page.tsx apps/web/tests/gameplay.spec.tsx
git commit -m "feat(web): enforce move legality and display hints in ArenaPage [XQA-44]"
```

---

### Task 4: Chạy toàn bộ Verification của Dự án (Build & Test Monorepo)

- [ ] **Step 1: Chạy build cho toàn bộ monorepo**
```bash
pnpm build
```
- [ ] **Step 2: Chạy kiểm thử cho toàn bộ monorepo**
```bash
pnpm test
```
- [ ] **Step 3: Chạy lint cho toàn bộ monorepo**
```bash
pnpm lint
```
- [ ] **Step 4: Kiểm tra trạng thái git**
```bash
git status
```
