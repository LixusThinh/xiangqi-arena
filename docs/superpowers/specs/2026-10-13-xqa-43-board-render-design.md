# Design Specification: Xiangqi Board Component & Web Scaffolding (XQA-43)

## 1. Overview & Context

This document specifies the architecture, component design, asset organization, coordinate system, and test verification for **XQA-43**: Building the Next.js Board Component for Xiangqi Arena (`apps/web`), rendering the 9x10 Xiangqi board, river, palaces, and pieces based on FEN strings using the `@xiangqi-arena/xiangqi-core` package.

### 1.1 Acceptance Criteria
1. **AC1 (FEN Rendering)**: Correctly render the standard starting FEN (`STARTING_FEN`) and 3 arbitrary midgame/endgame FEN positions.
2. **AC2 (Orientation / Perspective)**: Correctly display the board from either Red's perspective (`orientation: 'r'`, Red at bottom) or Black's perspective (`orientation: 'b'`, Black at bottom, flipped 180°).

---

## 2. Architecture & File Structure

### 2.1 Workspace Integration
`apps/web` is a Next.js (App Router, React 18/19, TypeScript, Tailwind CSS) application in the `xiangqi-arena` pnpm monorepo.
It declares a dependency on `@xiangqi-arena/xiangqi-core`:
```json
{
  "dependencies": {
    "@xiangqi-arena/xiangqi-core": "workspace:*"
  }
}
```

### 2.2 Directory Layout
```
apps/web/
├── app/
│   ├── layout.tsx                # Root layout with Tailwind CSS & metadata
│   ├── page.tsx                  # Interactive FEN demo & visual verification page
│   └── globals.css               # Tailwind CSS directives
├── components/
│   ├── Board.tsx                 # Core Board rendering component
│   └── fen-presets.ts            # 4 pre-configured FEN test cases
├── public/
│   └── ChessImage/               # Assets folder copied from ChineseChess
│       ├── BOARD.BMP             # Board background image (741 x 821 px)
│       ├── mask.png              # Selection highlight mask (80 x 80 px)
│       ├── mask2.png             # Target/hint highlight mask (80 x 80 px)
│       ├── rk.ico, ra.ico, ...   # Red pieces: rk, ra, rb, rn, rr, rc, rp
│       └── bk.ico, ba.ico, ...   # Black pieces: bk, ba, bb, bn, br, bc, bp
├── tests/
│   └── Board.spec.tsx            # Unit & component test suite (Jest + React Testing Library)
├── package.json                  # Next.js, React, Tailwind, @xiangqi-arena/xiangqi-core
├── tsconfig.json                 # TypeScript config extending root
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── next.config.mjs               # Next.js configuration
└── jest.config.cjs               # Jest test runner configuration for React
```

---

## 3. Assets & Coordinate Geometry

### 3.1 Asset Specification (`public/ChessImage/`)
All graphical assets are located under `public/ChessImage/`:
- **Board Background**: `BOARD.BMP` (Dimensions: $741 \times 821$ px).
- **Coordinate Highlights**:
  - `mask.png`: Red-cornered focus frame ($80 \times 80$ px) for the currently selected square.
  - `mask2.png`: Target circular frame ($80 \times 80$ px) for move destinations.
- **Piece Icons (14 files)**:
  - Red: `rk.ico` (帥 King), `ra.ico` (仕 Advisor), `rb.ico` (相 Bishop), `rn.ico` (傌 Knight), `rr.ico` (俥 Rook), `rc.ico` (炮 Cannon), `rp.ico` (兵 Pawn).
  - Black: `bk.ico` (將 King), `ba.ico` (士 Advisor), `bb.ico` (象 Bishop), `bn.ico` (馬 Knight), `br.ico` (車 Rook), `bc.ico` (砲 Cannon), `bp.ico` (卒 Pawn).

### 3.2 Geometry & Coordinate Formulas
- **Board Width**: $741$ px
- **Board Height**: $821$ px
- **Cell / Piece Size**: $80$ px
- **Top-Left Margin Offset**: $\text{OFFSET\_X} = 10$ px, $\text{OFFSET\_Y} = 10$ px.

For any square index $sq \in [0, 89]$ in `@xiangqi-arena/xiangqi-core`:
* $\text{row} = \lfloor sq / 9 \rfloor$ ($0 \le \text{row} \le 9$, Row 0 is Black's baseline, Row 9 is Red's baseline)
* $\text{col} = sq \pmod 9$ ($0 \le \text{col} \le 8$, File 0 is `a`, File 8 is `i`)

#### Display Coordinate Mapping
- **Red Perspective** (`orientation === 'r'`, default):
  $$\text{displayCol} = \text{col}, \quad \text{displayRow} = \text{row}$$
- **Black Perspective** (`orientation === 'b'`, flipped):
  $$\text{displayCol} = 8 - \text{col}, \quad \text{displayRow} = 9 - \text{row}$$

#### Pixel Position on Canvas
$$\begin{aligned}
x &= 10 + \text{displayCol} \times 80 \\
y &= 10 + \text{displayRow} \times 80
\end{aligned}$$

---

## 4. Component Interface & Rendering Engine

### 4.1 Component Props (`BoardProps`)
```typescript
import { Position } from '@xiangqi-arena/xiangqi-core';

export interface BoardProps {
  /** FEN string (optional). If provided and position is omitted, component parses it. */
  fen?: string;

  /** Position instance from @xiangqi-arena/xiangqi-core. Takes precedence if provided. */
  position?: Position;

  /** Perspective / orientation: 'r' = Red at bottom (default), 'b' = Black at bottom */
  orientation?: 'r' | 'b';

  /** Currently selected square (0..89) to highlight with mask.png */
  selectedSquare?: number | null;

  /** Last move to highlight destination / origin */
  lastMove?: { from: number; to: number } | null;

  /** Callback triggered when any board intersection / piece is clicked */
  onSquareClick?: (square: number) => void;

  /** Custom container CSS class */
  className?: string;
}
```

### 4.2 Rendering Architecture
The board is wrapped inside an SVG container with `viewBox="0 0 741 821"`:
```tsx
<div className={`relative inline-block w-full max-w-[560px] aspect-[741/821] ${className}`}>
  <svg
    viewBox="0 0 741 821"
    className="w-full h-full select-none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Layer 1: Background Board Image */}
    <image href="/ChessImage/BOARD.BMP" x="0" y="0" width="741" height="821" />

    {/* Layer 2: Selection / Last Move Masks */}
    {selectedSquare != null && (
      <image
        href="/ChessImage/mask.png"
        x={getSquareX(selectedSquare, orientation)}
        y={getSquareY(selectedSquare, orientation)}
        width="80"
        height="80"
      />
    )}

    {/* Layer 3: Interactive Click Targets (90 Squares) */}
    {Array.from({ length: 90 }, (_, sq) => (
      <rect
        key={`cell-${sq}`}
        x={getSquareX(sq, orientation)}
        y={getSquareY(sq, orientation)}
        width="80"
        height="80"
        fill="transparent"
        className="cursor-pointer"
        onClick={() => onSquareClick?.(sq)}
      />
    ))}

    {/* Layer 4: Pieces */}
    {board.map((piece, sq) => {
      if (!piece) return null;
      return (
        <image
          key={`piece-${sq}`}
          href={`/ChessImage/${piece.color}${piece.type}.ico`}
          x={getSquareX(sq, orientation)}
          y={getSquareY(sq, orientation)}
          width="80"
          height="80"
          className="cursor-pointer pointer-events-auto transition-transform duration-150 hover:scale-105"
          onClick={(e) => {
            e.stopPropagation();
            onSquareClick?.(sq);
          }}
        />
      );
    })}
  </svg>
</div>
```

---

## 5. FEN Test Presets

Four concrete FEN positions are defined in `components/fen-presets.ts`:

1. **Preset 0 (Initial Starting Position)**:
   - FEN: `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1`
   - Description: Full 32 pieces in standard initial deployment.
2. **Preset 1 (Midgame - Central Cannon vs Screen Horses)**:
   - FEN: `r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b - - 0 4`
   - Description: Classic opening-to-midgame transition; Black Knight moved to `c7` (`col: 2, row: 2`), Red Knight to `g2` (`col: 6, row: 7`), Red Cannon to `e2` (`col: 4, row: 7`).
3. **Preset 2 (Midgame - Fierce Cross-River Tactical Battle)**:
   - FEN: `2bakab2/9/1cn2n2c/p1p1C1p1p/4p4/2P6/P3P1P1P/1C1K2N2/9/RNBA1AB1R r - - 0 12`
   - Description: Complex midgame position with cross-river pawns, active cannons, and captures.
4. **Preset 3 (Endgame - Single Chariot & Horse vs Full Advisors & Elephants)**:
   - FEN: `3k1ab2/4a4/4b4/9/9/9/4R4/4K4/4A4/2B1AB3 r - - 0 35`
   - Description: Sparse endgame test verifying sparse empty squares, palace restrictions, and remaining pieces.

---

## 6. Interactive Demo Page (`app/page.tsx`)

The demo page provides a complete visual test harness:
- **Left / Center**: Responsive `<Board />` component.
- **Controls Panel**:
  - **Preset Selector**: Buttons to switch between Preset 0 (Initial), Preset 1 (Midgame 1), Preset 2 (Midgame 2), and Preset 3 (Endgame).
  - **Custom FEN Input**: An input field allowing users to paste any valid FEN string and render it instantly.
  - **Flip Orientation Button**: Toggles between Red perspective (`'r'`) and Black perspective (`'b'`).
  - **Live Game Inspector**:
    - Current side to move (Red / Black).
    - Selected square: index `0..89`, algebraic coordinate (e.g., `e7`), and piece information at that square.
    - Current 64-bit Zobrist Hash (16 hex chars) from `Position.toHashString()`.

---

## 7. Testing & Verification Plan

### 7.1 Automated Component Tests (`tests/Board.spec.tsx`)
- **Test 1**: Verify starting position renders exactly 32 pieces with correct image paths (`rk.ico`, `bk.ico`, etc.).
- **Test 2**: Verify rendering for Preset 1, Preset 2, and Preset 3 without errors.
- **Test 3**: Verify perspective flip:
  - In Red view (`orientation='r'`), King Red (`rk`) has $y = 730$ px, King Black (`bk`) has $y = 10$ px.
  - In Black view (`orientation='b'`), King Red (`rk`) has $y = 10$ px, King Black (`bk`) has $y = 730$ px.
- **Test 4**: Verify square click callback: Clicking square `sq` dispatches `onSquareClick(sq)` with exact square index.
- **Test 5**: Graceful error handling: Invalid FEN does not crash component, displays clear error fallback.

### 7.2 Manual & Visual Verification
- Build and run `pnpm --filter @xiangqi-arena/web dev`.
- Open browser at `http://localhost:3000` (or configured port).
- Verify all 4 preset boards render with high visual fidelity, correct image assets, and no layout jitter when toggling flip orientation.
