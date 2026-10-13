export type Color = 'r' | 'b';
export type Side = Color;
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
