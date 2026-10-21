import { squareToCoord } from '../coordinates';
import { hasCrossedRiver } from '../movegen/pawn';
import type { Position } from '../position';
import { Color, Piece, PieceType, Square } from '../types';

/**
 * Hàm đánh giá thế cờ (XQA-80): giá trị quân + thưởng vị trí.
 *
 * GIÁ TRỊ QUÂN – lấy theo bảng "consensus" (Xe 9, Pháo 4.5, Mã 4, Sĩ 2, Tượng 2.5, Tốt 1 / 2 khi qua sông,
 * Tốt ở hàng đáy đối phương trở lại 1), nhân 100 cho số nguyên. Nguồn: pychess.org/variants/xiangqi (mục
 * Piece Values); xiangqi.com "The Value of the Pieces in Xiangqi" cho cùng bảng (Tượng 2 hoặc 2.5). Ghi ở
 * docs/engine/ai-evaluate-search.md.
 *
 * THƯỞNG VỊ TRÍ – heuristic do nhóm tự đặt (KHÔNG lấy từ nguồn ngoài), cố ý nhỏ hơn nhiều so với giá trị quân
 * để AI không đổi quân lấy vị trí: Mã/Pháo/Xe gần cột giữa và tiến lên được cộng chút điểm; Tốt đã qua sông
 * ở cột giữa / gần cung đối phương được cộng thêm.
 */
export const PIECE_VALUES: Readonly<Record<Exclude<PieceType, 'k'>, number>> = {
  r: 900,
  c: 450,
  n: 400,
  a: 200,
  b: 250,
  p: 100,
};

/** Tốt đã qua sông (trừ khi đã xuống hàng đáy đối phương). */
export const CROSSED_PAWN_VALUE = 200;

/** Điểm thắng/thua tuyệt đối. Lớn hơn hẳn mọi tổng giá trị quân. */
export const MATE_SCORE = 100_000;

/** Số hàng đã tiến về phía đối phương, 0..9 (0 = hàng đáy nhà mình). */
function advance(color: Color, row: number): number {
  return color === 'r' ? 9 - row : row;
}

/** Giá trị của một quân tại một ô, nhìn từ phe sở hữu quân (luôn ≥ 0). */
export function pieceSquareValue(piece: Piece, sq: Square): number {
  if (piece.type === 'k') return 0; // Tướng không tính điểm; mất Tướng = hết nước, xử ở search
  const { col, row } = squareToCoord(sq);
  const centrality = 4 - Math.abs(col - 4); // 0 (cột biên) .. 4 (cột giữa)
  const adv = advance(piece.color, row);

  switch (piece.type) {
    case 'p': {
      if (!hasCrossedRiver(piece.color, row)) return PIECE_VALUES.p;
      if (adv === 9) return PIECE_VALUES.p; // Tốt "già" ở hàng đáy đối phương: chỉ còn đi ngang (theo bảng nguồn)
      // Qua sông: ưu tiên cột giữa và áp sát cung đối phương (hàng tiến 6..8)
      const nearPalace = adv >= 6 && col >= 3 && col <= 5 ? 20 : 0;
      return CROSSED_PAWN_VALUE + centrality * 5 + nearPalace;
    }
    case 'n':
      // Mã ở biên kém linh hoạt; Mã qua sông tạo áp lực
      return PIECE_VALUES.n + centrality * 6 + (adv >= 5 ? 15 : 0);
    case 'c':
      return PIECE_VALUES.c + centrality * 4;
    case 'r':
      return PIECE_VALUES.r + centrality * 3 + (adv >= 5 ? 10 : 0);
    case 'a':
    case 'b':
      return PIECE_VALUES[piece.type];
    default:
      return 0;
  }
}

/** Tổng điểm của một phe trên bàn. */
export function materialOf(board: readonly (Piece | null)[], color: Color): number {
  let total = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (p && p.color === color) total += pieceSquareValue(p, sq);
  }
  return total;
}

/**
 * Điểm thế cờ theo góc nhìn BÊN ĐANG TỚI LƯỢT (quy ước negamax): dương = bên tới lượt đang hơn.
 * Đối xứng: đảo màu + lật bàn + đổi bên đi thì điểm không đổi (AC XQA-80).
 */
export function evaluate(position: Position): number {
  const side = position.sideToMove;
  const enemy: Color = side === 'r' ? 'b' : 'r';
  return materialOf(position.board, side) - materialOf(position.board, enemy);
}
