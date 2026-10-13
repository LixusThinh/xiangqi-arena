# @xiangqi-arena/xiangqi-core

Pure TypeScript core rules and state engine for Xiangqi (Chinese Chess / Cờ Tướng).

Designed as a framework-agnostic, zero-runtime-dependency package used by backend services, web clients, and game engines.

---

## Features (XQA-42)

- **Board Representation**: 90-square linear index (`0..89`, 10 ranks × 9 files) with algebraic coordinate helpers (`a0`–`i9`).
- **FEN Parser & Serializer**: Full round-trip parsing and serialization of Xiangqi FEN strings conforming to 10 ranks, active color (`r` / `b`), halfmove counter, and fullmove number.
- **Deterministic Zobrist Hashing**: 64-bit BigInt Zobrist keys generated via deterministic SplitMix64 PRNG for 14 piece types across 90 squares plus turn flag.
- **Position State & Move Application**:
  - `Position.fromFen(fen?)`: Instantiates position state and precomputes initial Zobrist hash.
  - `applyMove(move)`: Mutates position in-place, advances move counters, and applies incremental O(1) Zobrist hash XOR updates. Returns `MoveUndo`.
  - `undoMove(undoInfo)`: Exactly reverts state, restores captured pieces, restores halfmove/fullmove counters, and restores previous Zobrist hash.
  - `toFen()` & `toHashString()`: Formats current board into standard FEN string and 16-character hexadecimal hash.
  - `clone()`: Deep clones position state and hash.

---

## Board Coordinate System

```text
Rank 0 (Black back rank):  a0 b0 c0 d0 e0 f0 g0 h0 i0  (sq: 0..8)
...
Rank 4 (River - Black):    a4 b4 c4 d4 e4 f4 g4 h4 i4  (sq: 36..44)
----------------------- River -----------------------
Rank 5 (River - Red):      a5 b5 c5 d5 e5 f5 g5 h5 i5  (sq: 45..53)
...
Rank 9 (Red back rank):    a9 b9 c9 d9 e9 f9 g9 h9 i9  (sq: 81..89)
```

Square index calculation: `sq = rank * 9 + file` (where `file`: `0..8` [a-i], `rank`: `0..9`).

---

## Public API Reference

### 1. Types & Interfaces (`src/types.ts`)

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

### 2. Coordinates (`src/coordinates.ts`)

- `isValidSquare(sq: number): sq is Square`
- `squareToCoord(sq: Square): { col: number; row: number }`
- `coordToSquare(col: number, row: number): Square`
- `squareToAlgebraic(sq: Square): string`
- `algebraicToSquare(alg: string): Square`

### 3. FEN (`src/fen.ts`)

- `parseFen(fen: string): PositionState`
- `toFen(state: PositionState): string`
- `parsePieceChar(char: string): Piece`
- `pieceToChar(piece: Piece): string`

### 4. Zobrist Hashing (`src/zobrist.ts`)

- `computeZobristHash(board: (Piece | null)[], sideToMove: Color): bigint`
- `getPieceZobristKey(piece: Piece, sq: Square): bigint`
- `getSideZobristKey(): bigint`
- `toHashString(hash: bigint): string`

### 5. Position (`src/position.ts`)

- `class Position implements PositionState`
  - `static fromFen(fen?: string): Position`
  - `applyMove(move: Move): MoveUndo`
  - `undoMove(undo: MoveUndo): void`
  - `toFen(): string`
  - `toHashString(): string`
  - `clone(): Position`

---

## Quickstart

```typescript
import { Position, algebraicToSquare } from '@xiangqi-arena/xiangqi-core';

// Initialize from default standard starting position
const pos = Position.fromFen();

console.log('Turn:', pos.sideToMove); // 'r'
console.log('Initial FEN:', pos.toFen());
console.log('Zobrist Hash:', pos.toHashString());

// Move central cannon: b7 -> e7 (cannon to central column)
const from = algebraicToSquare('b7');
const to = algebraicToSquare('e7');

const undo = pos.applyMove({ from, to });
console.log('Turn after move:', pos.sideToMove); // 'b'
console.log('New Hash:', pos.toHashString());

// Revert move
pos.undoMove(undo);
console.log('Restored Turn:', pos.sideToMove); // 'r'
console.log('Restored Hash:', pos.toHashString());
```

---

## Development & Testing

```bash
# Build TypeScript declarations and CommonJS bundle
pnpm --filter @xiangqi-arena/xiangqi-core build

# Run unit tests
pnpm --filter @xiangqi-arena/xiangqi-core test
```
