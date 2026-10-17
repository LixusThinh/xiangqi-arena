import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';
import { ORTHOGONAL_DIRECTIONS, isInsideBoard } from './chariot';

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Pháo (Cannon) theo Điều 4.3g:
 * - Khi không bắt quân: đi ngang/dọc như Xe, đường đi phải trống hoàn toàn (0 ngòi).
 * - Khi bắt quân: giữa Pháo và quân bị bắt phải có ĐÚNG 1 quân bất kỳ (của bên nào cũng được)
 *   làm "ngòi". 0 ngòi hoặc từ 2 ngòi trở lên thì không được bắt.
 * - Sau ngòi, chỉ xét quân đầu tiên gặp: là quân đối phương thì ăn được, là quân mình thì thôi.
 *   Ô trống phía sau ngòi KHÔNG phải nước đi hợp lệ (Pháo không nhảy qua ngòi để tới ô trống).
 */
export function generateCannonMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    let c = col + dc;
    let r = row + dr;
    let screenFound = false;

    while (isInsideBoard(c, r)) {
      const targetSq = coordToSquare(c, r);
      const pieceOnTarget = board[targetSq];

      if (!screenFound) {
        if (pieceOnTarget === null) {
          moves.push({ from, to: targetSq });
        } else {
          screenFound = true; // Quân này là ngòi
        }
      } else if (pieceOnTarget !== null) {
        if (pieceOnTarget.color !== sideToMove) {
          moves.push({ from, to: targetSq });
        }
        break; // Quân thứ 2 trên đường: hoặc bị ăn, hoặc chặn — không xét tiếp
      }

      c += dc;
      r += dr;
    }
  }

  return moves;
}
