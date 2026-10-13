# XQA-42 Xiangqi Core Board, FEN & Zobrist Hash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng package `@xiangqi-arena/xiangqi-core` độc lập thuần TypeScript mô hình hóa bàn cờ 90 ô, parse/export FEN chuẩn WXF, apply/undo move vi sai $O(1)$ và Zobrist hash 64-bit tất định (hex 16 ký tự).

**Architecture:** Thiết kế theo kiến trúc Chess Engine chuẩn: Lớp `Position` chứa mảng phẳng 90 ô `(Piece | null)[]`, áp dụng mutation vi sai kèm struct `MoveUndo` cho các thao tác `applyMove` và `undoMove` với độ phức tạp $O(1)$, cập nhật Zobrist hash vi sai qua bảng số ngẫu nhiên SplitMix64 cố định. Cung cấp FEN parser/serializer và method `clone()` cho Frontend.

**Tech Stack:** TypeScript 5.8+, Jest 29+ (`ts-jest`), pnpm workspaces monorepo.

**Spec:** [docs/engine/board-fen-zobrist.md](../../engine/board-fen-zobrist.md)

## Global Constraints
- Pure TypeScript: Nghiêm cấm import bất kỳ thư viện ngoài nào (không Nest, không React, không DB).
- Monorepo package name: `@xiangqi-arena/xiangqi-core`.
- Coordinate system: Mảng 1D 90 ô (0..89), col 0..8 (a..i), row 0..9 (0..9). Row 0 là đáy Đen, Row 9 là đáy Đỏ.
- Piece notation: WXF standard (`K`, `A`, `B`, `N`, `R`, `C`, `P` - hoa là Đỏ, thường là Đen). Side: `'r'` | `'b'`.
- Starting FEN: `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1`.
- Zobrist hash: 64-bit BigInt với seed cố định `0x123456789ABCDEFn`, hàm format 16 hex chars padStart(16, '0').
- All tests must pass with `pnpm -r test` from monorepo root.

---

### Task 1: Package Scaffolding & Tooling

**Files:**
- Create: `packages/xiangqi-core/package.json`
- Create: `packages/xiangqi-core/tsconfig.json`
- Create: `packages/xiangqi-core/jest.config.cjs`

**Interfaces:**
- Produces: Package build (`pnpm --filter @xiangqi-arena/xiangqi-core build`) và test runner (`pnpm --filter @xiangqi-arena/xiangqi-core test`).

- [ ] **Step 1: Create package.json**

Tạo `packages/xiangqi-core/package.json`:
```json
{
  "name": "@xiangqi-arena/xiangqi-core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "test": "jest",
    "lint": "eslint \"src/**/*.ts\""
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^22.13.10",
    "jest": "^29.7.0",
    "ts-jest": "^29.3.1",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Tạo `packages/xiangqi-core/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests/**/*"]
}
```

- [ ] **Step 3: Create jest.config.cjs**

Tạo `packages/xiangqi-core/jest.config.cjs`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```

- [ ] **Step 4: Install dependencies in workspace & verify setup**

Run: `pnpm install`
Expected: pnpm links `@xiangqi-arena/xiangqi-core` in workspace without errors.

- [ ] **Step 5: Commit**

```bash
git add packages/xiangqi-core/package.json packages/xiangqi-core/tsconfig.json packages/xiangqi-core/jest.config.cjs pnpm-lock.yaml
git commit -m "chore(core): scaffold package.json, tsconfig, jest [XQA-42]"
```

---

### Task 2: Core Types, Constants & Coordinates Helper

**Files:**
- Create: `packages/xiangqi-core/src/types.ts`
- Create: `packages/xiangqi-core/src/constants.ts`
- Create: `packages/xiangqi-core/src/coordinates.ts`
- Test: `packages/xiangqi-core/tests/coordinates.spec.ts`

**Interfaces:**
- Produces:
  - `Color`: `'r' | 'b'`
  - `PieceType`: `'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p'`
  - `Piece`: `{ color: Color; type: PieceType }`
  - `Square`: `number` (0..89)
  - `Move`: `{ from: Square; to: Square }`
  - `MoveUndo`: `{ move: Move; captured: Piece | null; prevHalfMoveClock: number; prevZobristHash: bigint }`
  - `PositionState`: `{ board: (Piece | null)[]; sideToMove: Color; halfMoveClock: number; fullMoveNumber: number }`
  - `coordToSquare(col: number, row: number): Square`
  - `squareToCoord(sq: Square): { col: number; row: number }`
  - `squareToAlgebraic(sq: Square): string`
  - `algebraicToSquare(alg: string): Square`
  - `isValidSquare(sq: number): boolean`

- [ ] **Step 1: Write failing tests for coordinates**

Tạo `packages/xiangqi-core/tests/coordinates.spec.ts`:
```typescript
import {
  coordToSquare,
  squareToCoord,
  squareToAlgebraic,
  algebraicToSquare,
  isValidSquare,
} from '../src/coordinates';

describe('Coordinates Helper', () => {
  it('converts square to coord and back accurately', () => {
    expect(squareToCoord(0)).toEqual({ col: 0, row: 0 });
    expect(squareToCoord(8)).toEqual({ col: 8, row: 0 });
    expect(squareToCoord(89)).toEqual({ col: 8, row: 9 });

    expect(coordToSquare(0, 0)).toBe(0);
    expect(coordToSquare(8, 0)).toBe(8);
    expect(coordToSquare(8, 9)).toBe(89);
  });

  it('converts algebraic notation accurately', () => {
    expect(squareToAlgebraic(0)).toBe('a0');
    expect(squareToAlgebraic(8)).toBe('i0');
    expect(squareToAlgebraic(89)).toBe('i9');

    expect(algebraicToSquare('a0')).toBe(0);
    expect(algebraicToSquare('i0')).toBe(8);
    expect(algebraicToSquare('i9')).toBe(89);
  });

  it('validates square range 0..89', () => {
    expect(isValidSquare(0)).toBe(true);
    expect(isValidSquare(89)).toBe(true);
    expect(isValidSquare(-1)).toBe(false);
    expect(isValidSquare(90)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/coordinates.spec.ts`
Expected: FAIL (Cannot find module '../src/coordinates')

- [ ] **Step 3: Write types, constants and coordinates implementation**

Tạo `packages/xiangqi-core/src/types.ts`:
```typescript
export type Color = 'r' | 'b';
export type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p';

export interface Piece {
  color: Color;
  type: PieceType;
}

export type Square = number; // 0..89

export interface Move {
  from: Square;
  to: Square;
}

export interface MoveUndo {
  move: Move;
  captured: Piece | null;
  prevHalfMoveClock: number;
  prevZobristHash: bigint;
}

export interface PositionState {
  board: (Piece | null)[];
  sideToMove: Color;
  halfMoveClock: number;
  fullMoveNumber: number;
}
```

Tạo `packages/xiangqi-core/src/constants.ts`:
```typescript
export const BOARD_FILES = 9;
export const BOARD_RANKS = 10;
export const TOTAL_SQUARES = 90;

export const STARTING_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1';
```

Tạo `packages/xiangqi-core/src/coordinates.ts`:
```typescript
import { BOARD_FILES, TOTAL_SQUARES } from './constants';
import { Square } from './types';

export function isValidSquare(sq: number): sq is Square {
  return Number.isInteger(sq) && sq >= 0 && sq < TOTAL_SQUARES;
}

export function squareToCoord(sq: Square): { col: number; row: number } {
  if (!isValidSquare(sq)) {
    throw new Error(`Invalid square: ${sq}`);
  }
  return {
    col: sq % BOARD_FILES,
    row: Math.floor(sq / BOARD_FILES),
  };
}

export function coordToSquare(col: number, row: number): Square {
  if (col < 0 || col >= 9 || row < 0 || row >= 10) {
    throw new Error(`Invalid coordinates: col=${col}, row=${row}`);
  }
  return row * BOARD_FILES + col;
}

export function squareToAlgebraic(sq: Square): string {
  const { col, row } = squareToCoord(sq);
  const fileChar = String.fromCharCode('a'.charCodeAt(0) + col);
  return `${fileChar}${row}`;
}

export function algebraicToSquare(alg: string): Square {
  if (!alg || alg.length !== 2) {
    throw new Error(`Invalid algebraic coordinate: ${alg}`);
  }
  const col = alg.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = Number(alg[1]);
  return coordToSquare(col, row);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/coordinates.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/xiangqi-core/src/types.ts packages/xiangqi-core/src/constants.ts packages/xiangqi-core/src/coordinates.ts packages/xiangqi-core/tests/coordinates.spec.ts
git commit -m "feat(core): add types, constants, coordinates [XQA-42]"
```

---

### Task 3: FEN Parser & Serializer

**Files:**
- Create: `packages/xiangqi-core/src/fen.ts`
- Test: `packages/xiangqi-core/tests/fen.spec.ts`

**Interfaces:**
- Consumes: `Piece`, `Color`, `PieceType`, `PositionState` từ `types.ts`, `STARTING_FEN` từ `constants.ts`.
- Produces:
  - `parseFen(fen: string): PositionState`
  - `toFen(state: PositionState): string`

- [ ] **Step 1: Write failing tests for FEN round-trip & validation**

Tạo `packages/xiangqi-core/tests/fen.spec.ts`:
```typescript
import { STARTING_FEN } from '../src/constants';
import { parseFen, toFen } from '../src/fen';

describe('FEN Parser and Serializer', () => {
  it('round-trips the starting FEN accurately', () => {
    const parsed = parseFen(STARTING_FEN);
    expect(parsed.sideToMove).toBe('r');
    expect(parsed.halfMoveClock).toBe(0);
    expect(parsed.fullMoveNumber).toBe(1);
    expect(toFen(parsed)).toBe(STARTING_FEN);
  });

  it('parses midgame position and round-trips correctly', () => {
    const midgameFen = 'r1bakab1r/9/1cn2cn2/p1p1p1p1p/9/2P6/P3P1P1P/1C2C4/9/RNBAKABNR b - - 5 12';
    const parsed = parseFen(midgameFen);
    expect(parsed.sideToMove).toBe('b');
    expect(parsed.halfMoveClock).toBe(5);
    expect(parsed.fullMoveNumber).toBe(12);
    expect(toFen(parsed)).toBe(midgameFen);
  });

  it('throws descriptive error on invalid rank count', () => {
    expect(() => parseFen('rnbakabnr/9/1c5c1 r - - 0 1')).toThrow('Expected 10 ranks');
  });

  it('throws descriptive error on invalid column count', () => {
    expect(() => parseFen('rnbakabnr8/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1')).toThrow('Rank 0 has');
  });

  it('throws descriptive error on unrecognized piece char', () => {
    expect(() => parseFen('xnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1')).toThrow('Unrecognized piece');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/fen.spec.ts`
Expected: FAIL (Cannot find module '../src/fen')

- [ ] **Step 3: Implement FEN parse and toFen**

Tạo `packages/xiangqi-core/src/fen.ts`:
```typescript
import { TOTAL_SQUARES } from './constants';
import { Color, Piece, PieceType, PositionState } from './types';

const VALID_PIECE_TYPES = new Set<PieceType>(['k', 'a', 'b', 'n', 'r', 'c', 'p']);

export function parsePieceChar(char: string): Piece {
  const isUpper = char === char.toUpperCase();
  const lower = char.toLowerCase() as PieceType;
  if (!VALID_PIECE_TYPES.has(lower)) {
    throw new Error(`Unrecognized piece character: '${char}'`);
  }
  return {
    color: isUpper ? 'r' : 'b',
    type: lower,
  };
}

export function pieceToChar(piece: Piece): string {
  return piece.color === 'r' ? piece.type.toUpperCase() : piece.type.toLowerCase();
}

export function parseFen(fen: string): PositionState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 1) {
    throw new Error('FEN string cannot be empty');
  }

  const [boardStr, sideStr = 'r', , , halfMoveStr = '0', fullMoveStr = '1'] = parts;

  const ranks = boardStr.split('/');
  if (ranks.length !== 10) {
    throw new Error(`Expected 10 ranks in FEN, received ${ranks.length}`);
  }

  const board: (Piece | null)[] = new Array(TOTAL_SQUARES).fill(null);

  for (let r = 0; r < 10; r++) {
    const rankStr = ranks[r];
    let col = 0;
    for (const char of rankStr) {
      if (char >= '1' && char <= '9') {
        col += Number(char);
      } else {
        if (col >= 9) {
          throw new Error(`Rank ${r} has more than 9 columns`);
        }
        const piece = parsePieceChar(char);
        board[r * 9 + col] = piece;
        col += 1;
      }
    }
    if (col !== 9) {
      throw new Error(`Rank ${r} has ${col} columns instead of 9`);
    }
  }

  const sideToMove: Color = sideStr.toLowerCase() === 'b' ? 'b' : 'r';
  const halfMoveClock = Math.max(0, parseInt(halfMoveStr, 10) || 0);
  const fullMoveNumber = Math.max(1, parseInt(fullMoveStr, 10) || 1);

  return {
    board,
    sideToMove,
    halfMoveClock,
    fullMoveNumber,
  };
}

export function toFen(state: PositionState): string {
  const ranks: string[] = [];

  for (let r = 0; r < 10; r++) {
    let rankStr = '';
    let emptyCount = 0;
    for (let c = 0; c < 9; c++) {
      const piece = state.board[r * 9 + c];
      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rankStr += emptyCount.toString();
          emptyCount = 0;
        }
        rankStr += pieceToChar(piece);
      }
    }
    if (emptyCount > 0) {
      rankStr += emptyCount.toString();
    }
    ranks.push(rankStr);
  }

  return `${ranks.join('/')} ${state.sideToMove} - - ${state.halfMoveClock} ${state.fullMoveNumber}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/fen.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/xiangqi-core/src/fen.ts packages/xiangqi-core/tests/fen.spec.ts
git commit -m "feat(core): implement FEN parse and toFen round-trip [XQA-42]"
```

---

### Task 4: Zobrist Hashing (SplitMix64 & Incremental XOR)

**Files:**
- Create: `packages/xiangqi-core/src/zobrist.ts`
- Test: `packages/xiangqi-core/tests/zobrist.spec.ts`

**Interfaces:**
- Consumes: `Piece`, `Color`, `Square`, `TOTAL_SQUARES`
- Produces:
  - `computeZobristHash(board: (Piece | null)[], sideToMove: Color): bigint`
  - `getPieceZobristKey(piece: Piece, sq: Square): bigint`
  - `getSideZobristKey(): bigint`
  - `toHashString(hash: bigint): string` (16 hex chars)

- [ ] **Step 1: Write failing tests for Zobrist hashing**

Tạo `packages/xiangqi-core/tests/zobrist.spec.ts`:
```typescript
import { STARTING_FEN } from '../src/constants';
import { parseFen } from '../src/fen';
import {
  computeZobristHash,
  getPieceZobristKey,
  getSideZobristKey,
  toHashString,
} from '../src/zobrist';

describe('Zobrist Hashing', () => {
  it('computes deterministic hash for identical board states', () => {
    const s1 = parseFen(STARTING_FEN);
    const s2 = parseFen(STARTING_FEN);
    const h1 = computeZobristHash(s1.board, s1.sideToMove);
    const h2 = computeZobristHash(s2.board, s2.sideToMove);

    expect(h1).toBe(h2);
    expect(toHashString(h1)).toHaveLength(16);
  });

  it('produces different hashes when side to move changes', () => {
    const s = parseFen(STARTING_FEN);
    const hRed = computeZobristHash(s.board, 'r');
    const hBlack = computeZobristHash(s.board, 'b');

    expect(hRed).not.toBe(hBlack);
    expect(hRed ^ hBlack).toBe(getSideZobristKey());
  });

  it('updates incrementally matching full recalculation', () => {
    const s = parseFen(STARTING_FEN);
    const initialHash = computeZobristHash(s.board, s.sideToMove);

    // Make move: Red Cannon at row 7, col 1 (sq 64) moves to row 7, col 4 (sq 67)
    const from = 64;
    const to = 67;
    const movingPiece = s.board[from]!;

    let incHash = initialHash;
    incHash ^= getPieceZobristKey(movingPiece, from);
    incHash ^= getPieceZobristKey(movingPiece, to);
    incHash ^= getSideZobristKey(); // Flip side

    // Apply change manually to board
    s.board[to] = movingPiece;
    s.board[from] = null;
    s.sideToMove = 'b';

    const fullRecalcHash = computeZobristHash(s.board, s.sideToMove);
    expect(incHash).toBe(fullRecalcHash);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/zobrist.spec.ts`
Expected: FAIL (Cannot find module '../src/zobrist')

- [ ] **Step 3: Implement SplitMix64 and Zobrist hashing**

Tạo `packages/xiangqi-core/src/zobrist.ts`:
```typescript
import { TOTAL_SQUARES } from './constants';
import { Color, Piece, PieceType, Square } from './types';

class SplitMix64 {
  private state: bigint;
  constructor(seed: bigint) {
    this.state = seed;
  }
  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }
}

// 14 piece types: 7 red + 7 black
const PIECE_TYPES: PieceType[] = ['k', 'a', 'b', 'n', 'r', 'c', 'p'];

function pieceToIndex(piece: Piece): number {
  const typeIndex = PIECE_TYPES.indexOf(piece.type);
  return piece.color === 'r' ? typeIndex : 7 + typeIndex;
}

const prng = new SplitMix64(0x123456789abcdefn);

// 14 pieces * 90 squares
const PIECE_KEYS: bigint[][] = Array.from({ length: 14 }, () =>
  Array.from({ length: TOTAL_SQUARES }, () => prng.next()),
);

const SIDE_KEY: bigint = prng.next();

export function getPieceZobristKey(piece: Piece, sq: Square): bigint {
  const pIdx = pieceToIndex(piece);
  return PIECE_KEYS[pIdx][sq];
}

export function getSideZobristKey(): bigint {
  return SIDE_KEY;
}

export function computeZobristHash(board: (Piece | null)[], sideToMove: Color): bigint {
  let hash = 0n;
  for (let sq = 0; sq < TOTAL_SQUARES; sq++) {
    const piece = board[sq];
    if (piece !== null) {
      hash ^= getPieceZobristKey(piece, sq);
    }
  }
  if (sideToMove === 'b') {
    hash ^= SIDE_KEY;
  }
  return hash;
}

export function toHashString(hash: bigint): string {
  return (hash & 0xffffffffffffffffn).toString(16).padStart(16, '0');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/zobrist.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/xiangqi-core/src/zobrist.ts packages/xiangqi-core/tests/zobrist.spec.ts
git commit -m "feat(core): implement deterministic Zobrist hashing [XQA-42]"
```

---

### Task 5: Position Class (ApplyMove, UndoMove, Clone & Public Exports)

**Files:**
- Create: `packages/xiangqi-core/src/position.ts`
- Create: `packages/xiangqi-core/src/index.ts`
- Test: `packages/xiangqi-core/tests/position.spec.ts`

**Interfaces:**
- Consumes: `types`, `fen`, `zobrist`, `constants`, `coordinates`
- Produces:
  - Class `Position`:
    - `static fromFen(fen?: string): Position`
    - `board: (Piece | null)[]`
    - `sideToMove: Color`
    - `halfMoveClock: number`
    - `fullMoveNumber: number`
    - `zobristHash: bigint`
    - `applyMove(move: Move): MoveUndo`
    - `undoMove(undo: MoveUndo): void`
    - `toFen(): string`
    - `toHashString(): string`
    - `clone(): Position`
  - Public export `packages/xiangqi-core/src/index.ts`

- [ ] **Step 1: Write failing tests for Position applyMove and undoMove**

Tạo `packages/xiangqi-core/tests/position.spec.ts`:
```typescript
import { STARTING_FEN } from '../src/constants';
import { algebraicToSquare } from '../src/coordinates';
import { Position } from '../src/position';

describe('Position Class', () => {
  it('initializes from starting FEN accurately', () => {
    const pos = Position.fromFen();
    expect(pos.toFen()).toBe(STARTING_FEN);
    expect(pos.sideToMove).toBe('r');
    expect(pos.halfMoveClock).toBe(0);
    expect(pos.fullMoveNumber).toBe(1);
    expect(pos.toHashString()).toHaveLength(16);
  });

  it('applies a peaceful move and undos back to identical state and hash', () => {
    const pos = Position.fromFen();
    const initialFen = pos.toFen();
    const initialHash = pos.zobristHash;

    // Cannon b2 to e2: algebraic b2 = sq 64, e2 = sq 67
    const move = {
      from: algebraicToSquare('b7'), // Row 7, col 1
      to: algebraicToSquare('e7'),   // Row 7, col 4
    };

    const undoInfo = pos.applyMove(move);
    expect(pos.sideToMove).toBe('b');
    expect(pos.halfMoveClock).toBe(1);
    expect(pos.fullMoveNumber).toBe(1);
    expect(pos.zobristHash).not.toBe(initialHash);

    pos.undoMove(undoInfo);
    expect(pos.toFen()).toBe(initialFen);
    expect(pos.zobristHash).toBe(initialHash);
    expect(pos.sideToMove).toBe('r');
    expect(pos.halfMoveClock).toBe(0);
  });

  it('applies a capture move, resets halfmove, and restores captured piece on undo', () => {
    // Setup a position where Red Cannon can capture Black Horse
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2N4/9/RNBAKAB1R r - - 4 10';
    const pos = Position.fromFen(customFen);
    const initialHash = pos.zobristHash;

    // Cannon at b7 (sq 64) captures Horse at e7 (sq 67)
    const move = { from: 64, to: 67 };
    const undoInfo = pos.applyMove(move);

    expect(undoInfo.captured).toEqual({ color: 'r', type: 'n' });
    expect(pos.halfMoveClock).toBe(0); // Reset after capture
    expect(pos.board[67]?.type).toBe('c');

    pos.undoMove(undoInfo);
    expect(pos.toFen()).toBe(customFen);
    expect(pos.zobristHash).toBe(initialHash);
    expect(pos.board[67]?.type).toBe('n');
    expect(pos.board[64]?.type).toBe('c');
  });

  it('supports multi-move sequence and full unroll to original state', () => {
    const pos = Position.fromFen();
    const initialFen = pos.toFen();
    const initialHash = pos.zobristHash;

    const undos = [];
    // Move 1 (Red): Horse at b9 to c7
    undos.push(pos.applyMove({ from: 82, to: 65 }));
    // Move 2 (Black): Horse at b0 to c2
    undos.push(pos.applyMove({ from: 1, to: 20 }));
    // Move 3 (Red): Pawn at c6 to c5
    undos.push(pos.applyMove({ from: 56, to: 47 }));

    expect(pos.fullMoveNumber).toBe(2);

    // Unroll all
    while (undos.length > 0) {
      pos.undoMove(undos.pop()!);
    }

    expect(pos.toFen()).toBe(initialFen);
    expect(pos.zobristHash).toBe(initialHash);
  });

  it('clones position without sharing board reference', () => {
    const pos = Position.fromFen();
    const cloned = pos.clone();
    expect(cloned.toFen()).toBe(pos.toFen());
    expect(cloned.zobristHash).toBe(pos.zobristHash);

    // Modifying cloned should not affect original
    cloned.applyMove({ from: 64, to: 67 });
    expect(cloned.toFen()).not.toBe(pos.toFen());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/position.spec.ts`
Expected: FAIL (Cannot find module '../src/position')

- [ ] **Step 3: Implement Position class and index.ts**

Tạo `packages/xiangqi-core/src/position.ts`:
```typescript
import { STARTING_FEN, TOTAL_SQUARES } from './constants';
import { parseFen, toFen } from './fen';
import { Color, Move, MoveUndo, Piece, PositionState } from './types';
import {
  computeZobristHash,
  getPieceZobristKey,
  getSideZobristKey,
  toHashString,
} from './zobrist';

export class Position implements PositionState {
  board: (Piece | null)[];
  sideToMove: Color;
  halfMoveClock: number;
  fullMoveNumber: number;
  zobristHash: bigint;

  constructor(state: PositionState, hash?: bigint) {
    this.board = [...state.board];
    this.sideToMove = state.sideToMove;
    this.halfMoveClock = state.halfMoveClock;
    this.fullMoveNumber = state.fullMoveNumber;
    this.zobristHash = hash ?? computeZobristHash(this.board, this.sideToMove);
  }

  static fromFen(fen: string = STARTING_FEN): Position {
    const state = parseFen(fen);
    return new Position(state);
  }

  applyMove(move: Move): MoveUndo {
    const { from, to } = move;
    if (from < 0 || from >= TOTAL_SQUARES || to < 0 || to >= TOTAL_SQUARES) {
      throw new Error(`Move square out of range: from=${from}, to=${to}`);
    }

    const movingPiece = this.board[from];
    if (!movingPiece) {
      throw new Error(`No piece at source square ${from}`);
    }

    if (movingPiece.color !== this.sideToMove) {
      throw new Error(`Piece at square ${from} belongs to ${movingPiece.color}, but side to move is ${this.sideToMove}`);
    }

    const captured = this.board[to];
    const prevHalfMoveClock = this.halfMoveClock;
    const prevZobristHash = this.zobristHash;

    // Update board
    this.board[to] = movingPiece;
    this.board[from] = null;

    // Update halfmove clock: reset on capture or pawn move, else increment
    if (captured !== null || movingPiece.type === 'p') {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Update fullmove number after Black moves
    if (this.sideToMove === 'b') {
      this.fullMoveNumber++;
    }

    // Update Zobrist hash incrementally
    let newHash = this.zobristHash;
    newHash ^= getPieceZobristKey(movingPiece, from);
    newHash ^= getPieceZobristKey(movingPiece, to);
    if (captured !== null) {
      newHash ^= getPieceZobristKey(captured, to);
    }
    newHash ^= getSideZobristKey();
    this.zobristHash = newHash;

    // Toggle turn
    this.sideToMove = this.sideToMove === 'r' ? 'b' : 'r';

    return {
      move,
      captured,
      prevHalfMoveClock,
      prevZobristHash,
    };
  }

  undoMove(undo: MoveUndo): void {
    const { move, captured, prevHalfMoveClock, prevZobristHash } = undo;
    const { from, to } = move;

    const movingPiece = this.board[to];
    if (!movingPiece) {
      throw new Error(`Cannot undo move: destination square ${to} is empty`);
    }

    // Restore board
    this.board[from] = movingPiece;
    this.board[to] = captured;

    // Reverse turn
    this.sideToMove = this.sideToMove === 'r' ? 'b' : 'r';

    // Reverse fullmove number if Black was the one who moved
    if (this.sideToMove === 'b') {
      this.fullMoveNumber--;
    }

    // Restore counters and hash
    this.halfMoveClock = prevHalfMoveClock;
    this.zobristHash = prevZobristHash;
  }

  toFen(): string {
    return toFen(this);
  }

  toHashString(): string {
    return toHashString(this.zobristHash);
  }

  clone(): Position {
    return new Position(
      {
        board: [...this.board],
        sideToMove: this.sideToMove,
        halfMoveClock: this.halfMoveClock,
        fullMoveNumber: this.fullMoveNumber,
      },
      this.zobristHash,
    );
  }
}
```

Tạo `packages/xiangqi-core/src/index.ts`:
```typescript
export * from './types';
export * from './constants';
export * from './coordinates';
export * from './fen';
export * from './zobrist';
export * from './position';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/position.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/xiangqi-core/src/position.ts packages/xiangqi-core/src/index.ts packages/xiangqi-core/tests/position.spec.ts
git commit -m "feat(core): implement Position class with applyMove and undoMove [XQA-42]"
```

---

### Task 6: Monorepo Build & Test Verification

**Files:**
- Modify: `packages/xiangqi-core/README.md` (cập nhật trạng thái)

- [ ] **Step 1: Build packages/xiangqi-core**

Run: `pnpm --filter @xiangqi-arena/xiangqi-core build`
Expected: Successfully generates `dist/` containing `.js` and `.d.ts` declaration files.

- [ ] **Step 2: Run root test suite across entire monorepo**

Run: `pnpm test`
Expected: All test suites in both `apps/server` and `packages/xiangqi-core` PASS without failure.

- [ ] **Step 3: Update packages/xiangqi-core/README.md**

Cập nhật `packages/xiangqi-core/README.md` tài liệu hóa các hàm đã hoàn thành: FEN parse/export, Position class, applyMove, undoMove, Zobrist hashing.

- [ ] **Step 4: Commit**

```bash
git add packages/xiangqi-core/README.md
git commit -m "docs(core): update package documentation for XQA-42 [XQA-42]"
```
