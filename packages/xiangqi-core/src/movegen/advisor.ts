import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';

/**
 * Kiểm tra toạ độ có phải là 1 trong 5 vị trí hợp lệ của Sĩ (Advisor) trong Cung hay không.
 * Đỏ: (4,8) tâm hoặc (3,7), (5,7), (3,9), (5,9) 4 góc.
 * Đen: (4,1) tâm hoặc (3,0), (5,0), (3,2), (5,2) 4 góc.
 */
export function isAdvisorSquare(color: Color, col: number, row: number): boolean {
  if (color === 'r') {
    return (
      (col === 4 && row === 8) ||
      ((col === 3 || col === 5) && (row === 7 || row === 9))
    );
  }
  return (
    (col === 4 && row === 1) ||
    ((col === 3 || col === 5) && (row === 0 || row === 2))
  );
}

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Sĩ (Advisor):
 * - Đi chéo đúng 1 ô (|dr| === 1 && |dc| === 1)
 * - Ô đích phải là 1 trong 5 vị trí Sĩ hợp lệ trong Cung
 * - Không được đi vào ô chứa quân cùng phe
 */
export function generateAdvisorMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  // 4 hướng chéo 1 ô
  const deltas = [
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 1 },
    { dc: 1, dr: 1 },
  ];

  for (const { dc, dr } of deltas) {
    const nextCol = col + dc;
    const nextRow = row + dr;

    if (isAdvisorSquare(sideToMove, nextCol, nextRow)) {
      const targetSq = coordToSquare(nextCol, nextRow);
      const pieceOnTarget = board[targetSq];
      if (pieceOnTarget === null || pieceOnTarget.color !== sideToMove) {
        moves.push({ from, to: targetSq });
      }
    }
  }

  return moves;
}
