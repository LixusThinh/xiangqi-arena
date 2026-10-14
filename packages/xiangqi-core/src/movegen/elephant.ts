import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Tượng (Elephant / Bishop):
 * - Đi chéo đúng 2 ô hình chữ Điền (|dr| === 2 && |dc| === 2).
 * - Không được qua sông: Đỏ ở hàng 5..9, Đen ở hàng 0..4.
 * - Cản mắt tượng: Ô chính giữa (eye) phải là ô trống.
 * - Ô đích không được chứa quân cùng phe.
 */
export function generateElephantMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  // 4 hướng chéo 2 ô
  const deltas = [
    { dc: -2, dr: -2 },
    { dc: 2, dr: -2 },
    { dc: -2, dr: 2 },
    { dc: 2, dr: 2 },
  ];

  for (const { dc, dr } of deltas) {
    const nextCol = col + dc;
    const nextRow = row + dr;

    // Kiểm tra biên bàn cờ theo chiều ngang
    if (nextCol < 0 || nextCol > 8) continue;

    // Kiểm tra giới hạn qua sông
    if (sideToMove === 'r') {
      if (nextRow < 5 || nextRow > 9) continue;
    } else {
      if (nextRow < 0 || nextRow > 4) continue;
    }

    // Kiểm tra mắt tượng (Elephant Eye)
    const eyeCol = col + dc / 2;
    const eyeRow = row + dr / 2;
    const eyeSq = coordToSquare(eyeCol, eyeRow);
    if (board[eyeSq] !== null) {
      continue; // Bị chẹn mắt tượng
    }

    // Kiểm tra ô đích
    const targetSq = coordToSquare(nextCol, nextRow);
    const pieceOnTarget = board[targetSq];
    if (pieceOnTarget === null || pieceOnTarget.color !== sideToMove) {
      moves.push({ from, to: targetSq });
    }
  }

  return moves;
}
