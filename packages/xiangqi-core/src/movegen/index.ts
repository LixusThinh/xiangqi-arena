import { coordToSquare } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';
import { generateAdvisorMoves } from './advisor';
import { generateElephantMoves } from './elephant';
import { generateHorseMoves } from './horse';
import { generateKingMoves } from './king';

export * from './king';
export * from './advisor';
export * from './elephant';
export * from './horse';

/**
 * Dispatcher sinh danh sách nước đi vật lý (pseudo-legal) cho quân cờ tại ô chỉ định.
 * Nếu ô không có quân hoặc quân không thuộc về lượt đi (sideToMove), trả về mảng rỗng [].
 */
export function generatePieceMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const piece = board[from];
  if (!piece || piece.color !== sideToMove) {
    return [];
  }

  switch (piece.type) {
    case 'k':
      return generateKingMoves(board, from, sideToMove);
    case 'a':
      return generateAdvisorMoves(board, from, sideToMove);
    case 'b':
      return generateElephantMoves(board, from, sideToMove);
    case 'n':
      return generateHorseMoves(board, from, sideToMove);
    default:
      // Các quân Xe (r), Pháo (c), Tốt (p) sẽ được hiện thực trong XQA-45
      return [];
  }
}

/**
 * Kiểm tra xem hai Tướng có đang đối diện trực tiếp trên cùng một cột mà không có vật cản nào ở giữa không (Lộ mặt tướng).
 */
export function hasFlyingGeneral(board: (Piece | null)[]): boolean {
  // Tìm Tướng Đỏ (r in 7..9, c in 3..5)
  let redKingCol = -1;
  let redKingRow = -1;
  for (let r = 7; r <= 9; r++) {
    for (let c = 3; c <= 5; c++) {
      const p = board[coordToSquare(c, r)];
      if (p && p.color === 'r' && p.type === 'k') {
        redKingCol = c;
        redKingRow = r;
        break;
      }
    }
    if (redKingCol !== -1) break;
  }

  // Tìm Tướng Đen (r in 0..2, c in 3..5)
  let blackKingCol = -1;
  let blackKingRow = -1;
  for (let r = 0; r <= 2; r++) {
    for (let c = 3; c <= 5; c++) {
      const p = board[coordToSquare(c, r)];
      if (p && p.color === 'b' && p.type === 'k') {
        blackKingCol = c;
        blackKingRow = r;
        break;
      }
    }
    if (blackKingCol !== -1) break;
  }

  // Nếu không đủ 2 tướng hoặc không cùng cột thì không có lộ mặt tướng
  if (redKingCol === -1 || blackKingCol === -1 || redKingCol !== blackKingCol) {
    return false;
  }

  // Kiểm tra các ô giữa 2 tướng
  const minRow = Math.min(blackKingRow, redKingRow);
  const maxRow = Math.max(blackKingRow, redKingRow);
  for (let r = minRow + 1; r < maxRow; r++) {
    if (board[coordToSquare(redKingCol, r)] !== null) {
      return false; // Có vật cản
    }
  }

  return true;
}
