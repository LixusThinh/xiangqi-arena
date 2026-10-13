# Implementation Plan: Xiangqi Board Component & Web Scaffolding (XQA-43)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js Board Component for Xiangqi Arena (`apps/web`), rendering the 9x10 Xiangqi board, river, palaces, pieces, and orientation view from FEN strings using `@xiangqi-arena/xiangqi-core`.

**Architecture:** Next.js 14 App Router in `apps/web` consuming `@xiangqi-arena/xiangqi-core` via workspace protocol. The Board is rendered inside a responsive SVG container (`viewBox="0 0 741 821"`) with layered image assets (`/ChessImage/BOARD.BMP`, piece icons, selection masks) ensuring pixel-perfect alignment and scale on any device.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Jest, React Testing Library, `@xiangqi-arena/xiangqi-core`.

**Spec:** [`docs/superpowers/specs/2026-10-13-xqa-43-board-render-design.md`](file:///C:/Users/lamphatdev/Desktop/xiangqi-arena/docs/superpowers/specs/2026-10-13-xqa-43-board-render-design.md)

## Global Constraints

- **Workspace Protocol**: `apps/web` must consume `@xiangqi-arena/xiangqi-core` via `"@xiangqi-arena/xiangqi-core": "workspace:*"`.
- **Pure Dependency Rule**: No changes to `@xiangqi-arena/xiangqi-core` or `@xiangqi-arena/server` unless strictly necessary for integration.
- **Coordinate System**: 90 squares ($0..89$), row 0 is Black base ($y = 10$ px when Red view), row 9 is Red base ($y = 730$ px when Red view).
- **Asset Location**: All board, piece, and mask images must reside in `apps/web/public/ChessImage/`.
- **All tests pass**: `pnpm test` from monorepo root must pass across all packages (`server`, `xiangqi-core`, `web`).

---

### Task 1: Web App Scaffolding & Tooling (`apps/web`)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/jest.config.cjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Modify: `apps/web/README.md`

**Interfaces:**
- Consumes: `@xiangqi-arena/xiangqi-core` package from workspace.
- Produces: Working Next.js development and build setup in `apps/web`.

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@xiangqi-arena/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint \"app/**/*.{ts,tsx}\" \"components/**/*.{ts,tsx}\"",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@xiangqi-arena/xiangqi-core": "workspace:*",
    "next": "^14.2.24",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.24.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.13.10",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.24.0",
    "globals": "^16.0.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "ts-jest": "^29.3.1",
    "typescript": "^5.8.2",
    "typescript-eslint": "^8.28.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create Tailwind, PostCSS, Next config, and Jest config**

Create `apps/web/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
```

Create `apps/web/postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `apps/web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@xiangqi-arena/xiangqi-core'],
};

export default nextConfig;
```

Create `apps/web/jest.config.cjs`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.spec.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
```

Create `apps/web/tsconfig.jest.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

Create `apps/web/tests/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Create `apps/web/app/globals.css` and `apps/web/app/layout.tsx`**

Create `apps/web/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #f8fafc;
  color: #0f172a;
  min-height: 100vh;
}
```

Create `apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xiangqi Arena - Chinese Chess',
  description: 'Online Chinese Chess platform with real-time gameplay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Run `pnpm install` and verify build**

Run from repo root:
```bash
pnpm install
pnpm --filter @xiangqi-arena/web build
```
Expected: Build passes (or outputs compiled app directory).

- [ ] **Step 6: Commit scaffolding**

```bash
git add apps/web
git commit -m "chore(web): scaffold Next.js 14, Tailwind, and Jest in apps/web [XQA-43]"
```

---

### Task 2: Assets Integration (`apps/web/public/ChessImage/`)

**Files:**
- Create: `apps/web/public/ChessImage/BOARD.BMP`
- Create: `apps/web/public/ChessImage/mask.png`
- Create: `apps/web/public/ChessImage/mask2.png`
- Create: `apps/web/public/ChessImage/{rk,ra,rb,rn,rr,rc,rp,bk,ba,bb,bn,br,bc,bp}.ico`
- Test: `apps/web/tests/assets.spec.ts`

**Interfaces:**
- Consumes: Asset files from `C:\Users\lamphatdev\Desktop\ChineseChess\ChessImage`.
- Produces: Static web assets in `/ChessImage/*` accessible by browser and Board component.

- [ ] **Step 1: Write failing test for assets existence**

Create `apps/web/tests/assets.spec.ts`:
```ts
import * as fs from 'fs';
import * as path from 'path';

describe('ChessImage Assets', () => {
  const assetDir = path.resolve(__dirname, '../public/ChessImage');

  it('contains the board background image', () => {
    const boardPath = path.join(assetDir, 'BOARD.BMP');
    expect(fs.existsSync(boardPath)).toBe(true);
    expect(fs.statSync(boardPath).size).toBeGreaterThan(0);
  });

  it('contains mask images', () => {
    ['mask.png', 'mask2.png'].forEach((file) => {
      const filePath = path.join(assetDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    });
  });

  it('contains all 14 piece icons', () => {
    const pieces = [
      'rk.ico', 'ra.ico', 'rb.ico', 'rn.ico', 'rr.ico', 'rc.ico', 'rp.ico',
      'bk.ico', 'ba.ico', 'bb.ico', 'bn.ico', 'br.ico', 'bc.ico', 'bp.ico',
    ];
    pieces.forEach((piece) => {
      const piecePath = path.join(assetDir, piece);
      expect(fs.existsSync(piecePath)).toBe(true);
      expect(fs.statSync(piecePath).size).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/assets.spec.ts`
Expected: FAIL (directory or files do not exist yet).

- [ ] **Step 3: Copy assets from `ChineseChess/ChessImage` into `apps/web/public/ChessImage`**

Copy all files:
```powershell
New-Item -ItemType Directory -Force -Path apps/web/public/ChessImage
Copy-Item -Path "C:\Users\lamphatdev\Desktop\ChineseChess\ChessImage\*" -Destination "apps/web/public/ChessImage\" -Recurse -Force
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/assets.spec.ts`
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Commit assets**

```bash
git add apps/web/public/ChessImage apps/web/tests/assets.spec.ts
git commit -m "feat(web): add board, piece, and mask assets in ChessImage [XQA-43]"
```

---

### Task 3: Board Geometry & FEN Presets Helper

**Files:**
- Create: `apps/web/components/fen-presets.ts`
- Create: `apps/web/components/board-geometry.ts`
- Test: `apps/web/tests/board-geometry.spec.ts`

**Interfaces:**
- Consumes: None (pure calculations).
- Produces:
  - `FEN_PRESETS`: Array of 4 FEN presets (Starting + 3 midgame/endgame).
  - `getSquareCoordinates(sq: number, orientation: 'r' | 'b'): { x: number; y: number }`.
  - Constants: `CELL_SIZE`, `OFFSET_X`, `OFFSET_Y`, `BOARD_WIDTH`, `BOARD_HEIGHT`.

- [ ] **Step 1: Write failing test for geometry calculations**

Create `apps/web/tests/board-geometry.spec.ts`:
```ts
import {
  getSquareCoordinates,
  CELL_SIZE,
  OFFSET_X,
  OFFSET_Y,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from '../components/board-geometry';

describe('board-geometry', () => {
  it('has correct geometric constants', () => {
    expect(CELL_SIZE).toBe(80);
    expect(OFFSET_X).toBe(10);
    expect(OFFSET_Y).toBe(10);
    expect(BOARD_WIDTH).toBe(741);
    expect(BOARD_HEIGHT).toBe(821);
  });

  describe('Red perspective (orientation = "r")', () => {
    it('maps Black baseline (sq 0: a9/Black Rook) to top-left (10, 10)', () => {
      const { x, y } = getSquareCoordinates(0, 'r');
      expect(x).toBe(10);
      expect(y).toBe(10);
    });

    it('maps Black King (sq 4: e9) to (330, 10)', () => {
      const { x, y } = getSquareCoordinates(4, 'r');
      expect(x).toBe(10 + 4 * 80); // 330
      expect(y).toBe(10);
    });

    it('maps Red baseline (sq 89: i0/Red Rook) to bottom-right (650, 730)', () => {
      const { x, y } = getSquareCoordinates(89, 'r');
      expect(x).toBe(10 + 8 * 80); // 650
      expect(y).toBe(10 + 9 * 80); // 730
    });

    it('maps Red King (sq 85: e0) to (330, 730)', () => {
      const { x, y } = getSquareCoordinates(85, 'r');
      expect(x).toBe(10 + 4 * 80); // 330
      expect(y).toBe(10 + 9 * 80); // 730
    });
  });

  describe('Black perspective (orientation = "b")', () => {
    it('maps Black baseline (sq 0) to bottom-right (650, 730)', () => {
      const { x, y } = getSquareCoordinates(0, 'b');
      expect(x).toBe(650);
      expect(y).toBe(730);
    });

    it('maps Black King (sq 4) to (330, 730)', () => {
      const { x, y } = getSquareCoordinates(4, 'b');
      expect(x).toBe(330);
      expect(y).toBe(730);
    });

    it('maps Red baseline (sq 89) to top-left (10, 10)', () => {
      const { x, y } = getSquareCoordinates(89, 'b');
      expect(x).toBe(10);
      expect(y).toBe(10);
    });

    it('maps Red King (sq 85) to (330, 10)', () => {
      const { x, y } = getSquareCoordinates(85, 'b');
      expect(x).toBe(330);
      expect(y).toBe(10);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/board-geometry.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `board-geometry.ts` and `fen-presets.ts`**

Create `apps/web/components/board-geometry.ts`:
```ts
export const CELL_SIZE = 80;
export const OFFSET_X = 10;
export const OFFSET_Y = 10;
export const BOARD_WIDTH = 741;
export const BOARD_HEIGHT = 821;

export function getSquareCoordinates(
  sq: number,
  orientation: 'r' | 'b' = 'r',
): { x: number; y: number } {
  const col = sq % 9;
  const row = Math.floor(sq / 9);

  const displayCol = orientation === 'r' ? col : 8 - col;
  const displayRow = orientation === 'r' ? row : 9 - row;

  return {
    x: OFFSET_X + displayCol * CELL_SIZE,
    y: OFFSET_Y + displayRow * CELL_SIZE,
  };
}
```

Create `apps/web/components/fen-presets.ts`:
```ts
export interface FenPreset {
  id: string;
  name: string;
  description: string;
  fen: string;
}

export const FEN_PRESETS: FenPreset[] = [
  {
    id: 'initial',
    name: 'Khởi đầu (Standard Initial)',
    description: 'Thế cờ 32 quân khởi đầu tiêu chuẩn WXF',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
  },
  {
    id: 'midgame-1',
    name: 'Trung cuộc 1: Pháo đầu đối Bình Phong Mã',
    description: 'Khai cuộc chuyển trung cuộc, Mã đen c7, Mã đỏ g2, Pháo đỏ e2',
    fen: 'r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b - - 0 4',
  },
  {
    id: 'midgame-2',
    name: 'Trung cuộc 2: Giao tranh qua sông',
    description: 'Thế trận đối công quyết liệt, Chốt qua sông, Xe Pháo dâng cao',
    fen: '2bakab2/9/1cn2n2c/p1p1C1p1p/4p4/2P6/P3P1P1P/1C1K2N2/9/RNBA1AB1R r - - 0 12',
  },
  {
    id: 'endgame-1',
    name: 'Tàn cuộc: Đơn Xa Mã chốt đối Sĩ Tượng bền',
    description: 'Tàn cuộc kinh điển với số lượng quân thưa thớt kiểm tra ô trống',
    fen: '3k1ab2/4a4/4b4/9/9/9/4R4/4K4/4A4/2B1AB3 r - - 0 35',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/board-geometry.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit geometry & presets**

```bash
git add apps/web/components/board-geometry.ts apps/web/components/fen-presets.ts apps/web/tests/board-geometry.spec.ts
git commit -m "feat(web): add board geometry mapping and FEN presets [XQA-43]"
```

---

### Task 4: `<Board />` Component Implementation & Testing

**Files:**
- Create: `apps/web/components/Board.tsx`
- Test: `apps/web/tests/Board.spec.tsx`

**Interfaces:**
- Consumes:
  - `Position` from `@xiangqi-arena/xiangqi-core`
  - `getSquareCoordinates`, `BOARD_WIDTH`, `BOARD_HEIGHT`, `CELL_SIZE` from `components/board-geometry`
- Produces: `<Board />` React component.

- [ ] **Step 1: Write failing component tests**

Create `apps/web/tests/Board.spec.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Board from '../components/Board';
import { FEN_PRESETS } from '../components/fen-presets';
import { Position, STARTING_FEN } from '@xiangqi-arena/xiangqi-core';

describe('<Board />', () => {
  it('renders starting FEN with exactly 32 pieces', () => {
    render(<Board fen={STARTING_FEN} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });

  it('renders correctly with a Position instance', () => {
    const pos = Position.fromFen(STARTING_FEN);
    render(<Board position={pos} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });

  it('renders all 3 midgame and endgame presets without throwing', () => {
    FEN_PRESETS.slice(1).forEach((preset) => {
      const { unmount } = render(<Board fen={preset.fen} />);
      const pieces = screen.getAllByTestId(/^piece-/);
      expect(pieces.length).toBeGreaterThan(0);
      expect(pieces.length).toBeLessThan(32);
      unmount();
    });
  });

  it('correctly flips piece coordinates between Red and Black orientation', () => {
    // Red King is at sq 85 (e0), Black King is at sq 4 (e9)
    const { rerender } = render(<Board fen={STARTING_FEN} orientation="r" />);
    const redKingR = screen.getByTestId('piece-85');
    const blackKingR = screen.getByTestId('piece-4');

    expect(redKingR).toHaveAttribute('y', '730');
    expect(blackKingR).toHaveAttribute('y', '10');

    // Flip to Black perspective
    rerender(<Board fen={STARTING_FEN} orientation="b" />);
    const redKingB = screen.getByTestId('piece-85');
    const blackKingB = screen.getByTestId('piece-4');

    expect(redKingB).toHaveAttribute('y', '10');
    expect(blackKingB).toHaveAttribute('y', '730');
  });

  it('triggers onSquareClick callback when square is clicked', () => {
    const handleClick = jest.fn();
    render(<Board fen={STARTING_FEN} onSquareClick={handleClick} />);

    // Click on Red King (sq 85)
    const redKing = screen.getByTestId('piece-85');
    fireEvent.click(redKing);
    expect(handleClick).toHaveBeenCalledWith(85);

    // Click on empty square 40
    const cell40 = screen.getByTestId('cell-40');
    fireEvent.click(cell40);
    expect(handleClick).toHaveBeenCalledWith(40);
  });

  it('displays error banner when given an invalid FEN', () => {
    render(<Board fen="invalid-fen-string" />);
    expect(screen.getByText(/FEN không hợp lệ/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/Board.spec.tsx`
Expected: FAIL (Board component does not exist).

- [ ] **Step 3: Implement `apps/web/components/Board.tsx`**

Create `apps/web/components/Board.tsx`:
```tsx
'use client';

import React, { useMemo } from 'react';
import { Position, STARTING_FEN } from '@xiangqi-arena/xiangqi-core';
import {
  getSquareCoordinates,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
} from './board-geometry';

export interface BoardProps {
  /** Chuỗi FEN. Nếu không truyền position, component sẽ parse FEN này. */
  fen?: string;

  /** Đối tượng Position từ @xiangqi-arena/xiangqi-core. */
  position?: Position;

  /** Hướng nhìn: 'r' = Đỏ ở dưới (mặc định), 'b' = Đen ở dưới */
  orientation?: 'r' | 'b';

  /** Ô cờ đang được chọn (0..89) */
  selectedSquare?: number | null;

  /** Nước đi gần nhất để highlight { from, to } */
  lastMove?: { from: number; to: number } | null;

  /** Callback khi click vào bất kỳ ô nào (quân cờ hoặc ô trống) */
  onSquareClick?: (square: number) => void;

  /** CSS class tùy biến */
  className?: string;
}

export default function Board({
  fen,
  position,
  orientation = 'r',
  selectedSquare,
  lastMove,
  onSquareClick,
  className = '',
}: BoardProps) {
  // Resolve Position instance or parse FEN safely
  const { currentPos, error } = useMemo(() => {
    if (position) {
      return { currentPos: position, error: null };
    }
    const fenStringToUse = fen ?? STARTING_FEN;
    try {
      return { currentPos: Position.fromFen(fenStringToUse), error: null };
    } catch (err) {
      return {
        currentPos: null,
        error: err instanceof Error ? err.message : 'Invalid FEN',
      };
    }
  }, [position, fen]);

  if (error || !currentPos) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 ${className}`}>
        <p className="font-semibold">FEN không hợp lệ</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  const boardArray = currentPos.board;

  return (
    <div
      className={`relative inline-block w-full max-w-[560px] aspect-[741/821] select-none shadow-2xl rounded-lg overflow-hidden ${className}`}
    >
      <svg
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 1: Nền bàn cờ */}
        <image
          href="/ChessImage/BOARD.BMP"
          x="0"
          y="0"
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
        />

        {/* Layer 2: Highlight nước vừa đi (lastMove) */}
        {lastMove && (
          <>
            {(() => {
              const fromCoords = getSquareCoordinates(lastMove.from, orientation);
              return (
                <image
                  href="/ChessImage/mask2.png"
                  x={fromCoords.x}
                  y={fromCoords.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  className="pointer-events-none opacity-80"
                />
              );
            })()}
            {(() => {
              const toCoords = getSquareCoordinates(lastMove.to, orientation);
              return (
                <image
                  href="/ChessImage/mask2.png"
                  x={toCoords.x}
                  y={toCoords.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  className="pointer-events-none opacity-80"
                />
              );
            })()}
          </>
        )}

        {/* Layer 2b: Highlight ô đang chọn (selectedSquare) */}
        {selectedSquare != null && (
          (() => {
            const coords = getSquareCoordinates(selectedSquare, orientation);
            return (
              <image
                data-testid="selected-mask"
                href="/ChessImage/mask.png"
                x={coords.x}
                y={coords.y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                className="pointer-events-none"
              />
            );
          })()
        )}

        {/* Layer 3: 90 ô tương tác click */}
        {Array.from({ length: 90 }, (_, sq) => {
          const { x, y } = getSquareCoordinates(sq, orientation);
          return (
            <rect
              key={`cell-${sq}`}
              data-testid={`cell-${sq}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSquareClick?.(sq)}
            />
          );
        })}

        {/* Layer 4: Quân cờ */}
        {boardArray.map((piece, sq) => {
          if (!piece) return null;
          const { x, y } = getSquareCoordinates(sq, orientation);
          const iconName = `${piece.color}${piece.type}.ico`;
          const isSelected = selectedSquare === sq;

          return (
            <image
              key={`piece-${sq}`}
              data-testid={`piece-${sq}`}
              data-piece={`${piece.color}${piece.type}`}
              href={`/ChessImage/${iconName}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              className={`cursor-pointer pointer-events-auto transition-transform duration-100 ${
                isSelected ? 'scale-105 filter drop-shadow-md' : 'hover:scale-105'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSquareClick?.(sq);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/Board.spec.tsx`
Expected: PASS (All 6 tests pass).

- [ ] **Step 5: Commit `<Board />` component**

```bash
git add apps/web/components/Board.tsx apps/web/tests/Board.spec.tsx
git commit -m "feat(web): implement Board SVG component with FEN rendering and flip view [XQA-43]"
```

---

### Task 5: Interactive Demo Page (`apps/web/app/page.tsx`)

**Files:**
- Create: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `<Board />`, `FEN_PRESETS`, `@xiangqi-arena/xiangqi-core` (squareToAlgebraic, Position).
- Produces: Interactive demo page at `/` verifying AC1 & AC2 visually.

- [ ] **Step 1: Implement `apps/web/app/page.tsx`**

Create `apps/web/app/page.tsx`:
```tsx
'use client';

import React, { useState, useMemo } from 'react';
import Board from '@/components/Board';
import { FEN_PRESETS } from '@/components/fen-presets';
import { Position, squareToAlgebraic, squareToCoord } from '@xiangqi-arena/xiangqi-core';

export default function DemoPage() {
  const [currentFen, setCurrentFen] = useState<string>(FEN_PRESETS[0].fen);
  const [inputFen, setInputFen] = useState<string>(FEN_PRESETS[0].fen);
  const [orientation, setOrientation] = useState<'r' | 'b'>('r');
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);

  // Position derived for status readout
  const positionInfo = useMemo(() => {
    try {
      const pos = Position.fromFen(currentFen);
      return {
        sideToMove: pos.sideToMove === 'r' ? 'Đỏ' : 'Đen',
        zobristHash: pos.toHashString(),
        board: pos.board,
        error: null,
      };
    } catch (e) {
      return {
        sideToMove: '-',
        zobristHash: '-',
        board: [],
        error: e instanceof Error ? e.message : 'Invalid FEN',
      };
    }
  }, [currentFen]);

  const handleSelectPreset = (fen: string) => {
    setCurrentFen(fen);
    setInputFen(fen);
    setSelectedSquare(null);
  };

  const handleApplyCustomFen = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentFen(inputFen.trim());
    setSelectedSquare(null);
  };

  const handleSquareClick = (sq: number) => {
    setSelectedSquare((prev) => (prev === sq ? null : sq));
  };

  const selectedPiece = selectedSquare != null && positionInfo.board[selectedSquare];

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-900 text-slate-100 flex flex-col items-center">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-amber-400">
          Xiangqi Arena — Bàn Cờ Tướng Web
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Issue XQA-43: Render bàn cờ từ FEN & Thay đổi góc nhìn Đỏ / Đen
        </p>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cột hiển thị bàn cờ */}
        <section className="lg:col-span-7 flex flex-col items-center">
          <Board
            fen={currentFen}
            orientation={orientation}
            selectedSquare={selectedSquare}
            onSquareClick={handleSquareClick}
          />
        </section>

        {/* Cột điều khiển & Thông tin */}
        <section className="lg:col-span-5 flex flex-col gap-6 bg-slate-800/80 backdrop-blur p-6 rounded-xl border border-slate-700 shadow-xl">
          {/* Nút lật bàn cờ */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block mb-2">
              Góc nhìn bàn cờ (Orientation)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrientation('r')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  orientation === 'r'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                🔴 Góc nhìn Đỏ (Mặc định)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('b')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  orientation === 'b'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                ⚫ Góc nhìn Đen (Lật 180°)
              </button>
            </div>
          </div>

          {/* Chọn 4 FEN mẫu */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block mb-2">
              Thế cờ mẫu (Acceptance Criteria)
            </label>
            <div className="flex flex-col gap-2">
              {FEN_PRESETS.map((preset, idx) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.fen)}
                  className={`text-left p-3 rounded-lg border text-sm transition-all ${
                    currentFen === preset.fen
                      ? 'bg-amber-500/10 border-amber-500/60 text-amber-300'
                      : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <div className="font-semibold">
                    {idx + 1}. {preset.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Nhập FEN tùy ý */}
          <form onSubmit={handleApplyCustomFen} className="flex flex-col gap-2">
            <label htmlFor="custom-fen" className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Nhập FEN tùy ý
            </label>
            <div className="flex gap-2">
              <input
                id="custom-fen"
                type="text"
                value={inputFen}
                onChange={(e) => setInputFen(e.target.value)}
                placeholder="Dán chuỗi FEN vào đây..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"
              >
                Áp dụng
              </button>
            </div>
          </form>

          {/* Bảng trạng thái */}
          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700 text-xs flex flex-col gap-2 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400 font-sans">Lượt đi:</span>
              <span className="font-bold text-amber-400">{positionInfo.sideToMove}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400 font-sans">Zobrist Hash:</span>
              <span className="text-slate-300">{positionInfo.zobristHash}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Ô đang chọn:</span>
              <span className="text-slate-300">
                {selectedSquare != null
                  ? `${squareToAlgebraic(selectedSquare)} (sq: ${selectedSquare}, col: ${
                      squareToCoord(selectedSquare).col
                    }, row: ${squareToCoord(selectedSquare).row}) ${
                      selectedPiece ? `[${selectedPiece.color === 'r' ? 'Đỏ' : 'Đen'} ${selectedPiece.type.toUpperCase()}]` : '[Ô trống]'
                    }`
                  : 'Chưa chọn'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify Next.js build**

Run: `pnpm --filter @xiangqi-arena/web build`
Expected: Build passes with 0 errors.

- [ ] **Step 3: Commit demo page**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): add interactive FEN demo page with preset selectors and flip toggle [XQA-43]"
```

---

### Task 6: Monorepo Integration, Linter & Documentation

**Files:**
- Modify: `package.json` (root dev script if needed)
- Modify: `apps/web/README.md`

**Interfaces:**
- Consumes: All tests across packages.
- Produces: Clean, passing monorepo test and lint suite.

- [ ] **Step 1: Run full monorepo test suite**

Run: `pnpm test`
Expected: PASS across `@xiangqi-arena/server`, `@xiangqi-arena/xiangqi-core`, and `@xiangqi-arena/web`.

- [ ] **Step 2: Run full monorepo lint suite**

Run: `pnpm lint`
Expected: PASS with 0 lint errors.

- [ ] **Step 3: Update `apps/web/README.md`**

Update documentation with:
- Description of the web app and `<Board />` component.
- Props documentation and usage snippet.
- Instructions to run dev server and tests.

- [ ] **Step 4: Commit documentation and integration**

```bash
git add apps/web/README.md
git commit -m "docs(web): document Board component props, usage, and assets [XQA-43]"
```
