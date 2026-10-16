import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';

/**
 * Kiểm tra toạ độ có nằm trong Cung tướng (Palace) của phe chỉ định hay không.
 * Cột 3..5 (d, e, f). Đỏ hàng 7..9, Đen hàng 0..2.
 */
export function isInPalace(color: Color, col: number, row: number): boolean {
  if (col < 3 || col > 5) return false;
  if (color === 'r') {
    return row >= 7 && row <= 9;
  }
  return row >= 0 && row <= 2;
}

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Tướng (King):
 * 1. Di chuyển 1 ô trực giao trong Cung (không ăn quân cùng phe).
 * 2. Bay tướng (Flying General): Ăn trực diện Tướng đối thủ trên cùng cột nếu đường đi thông suốt.
 */
export function generateKingMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  // 4 hướng trực giao: lên, xuống, trái, phải
  const deltas = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ];

  for (const { dc, dr } of deltas) {
    const nextCol = col + dc;
    const nextRow = row + dr;

    if (isInPalace(sideToMove, nextCol, nextRow)) {
      const targetSq = coordToSquare(nextCol, nextRow);
      const pieceOnTarget = board[targetSq];
      if (pieceOnTarget === null || pieceOnTarget.color !== sideToMove) {
        moves.push({ from, to: targetSq });
      }
    }
  }

  // Flying General: Kiểm tra xem có thể bay ăn Tướng đối phương trên cùng cột
  const opponentColor: Color = sideToMove === 'r' ? 'b' : 'r';
  const oppRowStart = opponentColor === 'r' ? 7 : 0;
  const oppRowEnd = opponentColor === 'r' ? 9 : 2;

  let opponentKingSq: Square | null = null;
  for (let r = oppRowStart; r <= oppRowEnd; r++) {
    const sq = coordToSquare(col, r);
    const p = board[sq];
    if (p && p.color === opponentColor && p.type === 'k') {
      opponentKingSq = sq;
      break;
    }
  }

  if (opponentKingSq !== null) {
    const oppRow = Math.floor(opponentKingSq / 9);
    const minRow = Math.min(row, oppRow);
    const maxRow = Math.max(row, oppRow);
    let obstructed = false;
    for (let r = minRow + 1; r < maxRow; r++) {
      if (board[coordToSquare(col, r)] !== null) {
        obstructed = true;
        break;
      }
    }
    if (!obstructed) {
      moves.push({ from, to: opponentKingSq });
    }
  }

  return moves;
}
