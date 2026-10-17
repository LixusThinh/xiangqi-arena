import { coordToSquare, squareToCoord } from '../coordinates';
import { BOARD_FILES, BOARD_RANKS } from '../constants';
import { Color, Move, Piece, Square } from '../types';

/** 4 hướng trực giao dùng chung cho Xe và Pháo. */
export const ORTHOGONAL_DIRECTIONS: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
];

export function isInsideBoard(col: number, row: number): boolean {
  return col >= 0 && col < BOARD_FILES && row >= 0 && row < BOARD_RANKS;
}

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Xe (Chariot / Rook):
 * - Đi thẳng ngang hoặc dọc, không giới hạn số bước (Điều 4.3d).
 * - Không được nhảy qua quân: dừng ở quân đầu tiên gặp trên mỗi hướng.
 * - Quân đầu tiên là quân đối phương thì được ăn, là quân mình thì dừng trước nó.
 */
export function generateChariotMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    let c = col + dc;
    let r = row + dr;
    while (isInsideBoard(c, r)) {
      const targetSq = coordToSquare(c, r);
      const pieceOnTarget = board[targetSq];
      if (pieceOnTarget === null) {
        moves.push({ from, to: targetSq });
      } else {
        if (pieceOnTarget.color !== sideToMove) {
          moves.push({ from, to: targetSq });
        }
        break;
      }
      c += dc;
      r += dr;
    }
  }

  return moves;
}
