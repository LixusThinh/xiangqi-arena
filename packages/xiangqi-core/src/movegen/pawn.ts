import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';
import { isInsideBoard } from './chariot';

/** Hướng "tiến" theo hàng: Đỏ ở dưới (hàng 9) đi lên, Đen ở trên (hàng 0) đi xuống. */
export function pawnForward(color: Color): number {
  return color === 'r' ? -1 : 1;
}

/** Tốt đã qua sông chưa: Đỏ khi ở hàng 0..4, Đen khi ở hàng 5..9. */
export function hasCrossedRiver(color: Color, row: number): boolean {
  return color === 'r' ? row <= 4 : row >= 5;
}

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Tốt (Pawn / Soldier) theo Điều 4.3h:
 * - Mỗi nước đi 1 bước.
 * - Chưa qua sông: chỉ được tiến.
 * - Đã qua sông: được tiến hoặc đi ngang. Không bao giờ được lùi.
 * - Ô đích không được chứa quân cùng phe. Tốt ăn quân theo đúng cách đi.
 */
export function generatePawnMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  const deltas = [{ dc: 0, dr: pawnForward(sideToMove) }];
  if (hasCrossedRiver(sideToMove, row)) {
    deltas.push({ dc: -1, dr: 0 }, { dc: 1, dr: 0 });
  }

  for (const { dc, dr } of deltas) {
    const nextCol = col + dc;
    const nextRow = row + dr;
    if (!isInsideBoard(nextCol, nextRow)) continue; // Tốt ở hàng đáy đối phương không tiến tiếp được

    const targetSq = coordToSquare(nextCol, nextRow);
    const pieceOnTarget = board[targetSq];
    if (pieceOnTarget === null || pieceOnTarget.color !== sideToMove) {
      moves.push({ from, to: targetSq });
    }
  }

  return moves;
}
