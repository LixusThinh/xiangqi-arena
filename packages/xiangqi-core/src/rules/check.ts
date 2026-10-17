import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Piece, Square } from '../types';
import { ORTHOGONAL_DIRECTIONS, isInsideBoard } from '../movegen/chariot';
import { hasCrossedRiver, pawnForward } from '../movegen/pawn';

export function opponentOf(color: Color): Color {
  return color === 'r' ? 'b' : 'r';
}

/** Tìm ô của Tướng phe `color`. Trả về null nếu bàn cờ không có Tướng đó (thế cờ test). */
export function findKing(board: (Piece | null)[], color: Color): Square | null {
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (p && p.color === color && p.type === 'k') {
      return sq;
    }
  }
  return null;
}

function pieceAt(board: (Piece | null)[], col: number, row: number): Piece | null {
  return isInsideBoard(col, row) ? board[coordToSquare(col, row)] : null;
}

function isPiece(p: Piece | null, color: Color, type: Piece['type']): boolean {
  return p !== null && p.color === color && p.type === type;
}

/**
 * Ô `target` có bị quân của phe `attacker` bắt được ở nước kế tiếp không.
 *
 * Dùng để kiểm tra Tướng có bị chiếu (Điều 6.1). Xét các quân có thể với tới Tướng đối phương:
 * Xe, Pháo (đúng 1 ngòi), Mã (có xét cản chân), Tốt, và Tướng đối phương trên cùng cột không
 * có quân che (lộ mặt tướng, Điều 4.3a). Sĩ và Tượng không bao giờ ra khỏi sân nhà nên không
 * thể tấn công cung Tướng đối phương, vì vậy hàm này CHỈ dùng cho ô Tướng.
 */
export function isKingSquareAttacked(
  board: (Piece | null)[],
  target: Square,
  attacker: Color,
): boolean {
  const { col, row } = squareToCoord(target);

  // Xe, Pháo, Tướng đối mặt: quét 4 hướng trực giao
  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    let c = col + dc;
    let r = row + dr;
    let blockers = 0;
    while (isInsideBoard(c, r)) {
      const p = board[coordToSquare(c, r)];
      if (p !== null) {
        if (blockers === 0) {
          if (p.color === attacker && p.type === 'r') return true;
          if (p.color === attacker && p.type === 'k' && dc === 0) return true; // lộ mặt tướng
        } else if (p.color === attacker && p.type === 'c') {
          return true; // Pháo với đúng 1 ngòi
        }
        blockers++;
        if (blockers === 2) break;
      }
      c += dc;
      r += dr;
    }
  }

  // Mã: Mã ở ô H đi tới target; chân Mã là ô kề H theo hướng bước 2 ô
  const horseOffsets = [
    { dc: -1, dr: -2 }, { dc: 1, dr: -2 }, { dc: -1, dr: 2 }, { dc: 1, dr: 2 },
    { dc: -2, dr: -1 }, { dc: -2, dr: 1 }, { dc: 2, dr: -1 }, { dc: 2, dr: 1 },
  ];
  for (const { dc, dr } of horseOffsets) {
    // Mã đứng ở target - (dc, dr) và nhảy (dc, dr) để tới target
    const hc = col - dc;
    const hr = row - dr;
    if (!isPiece(pieceAt(board, hc, hr), attacker, 'n')) continue;
    const legC = Math.abs(dc) === 2 ? hc + dc / 2 : hc;
    const legR = Math.abs(dr) === 2 ? hr + dr / 2 : hr;
    if (pieceAt(board, legC, legR) === null) return true;
  }

  // Tốt: tiến 1 ô tới target, hoặc (đã qua sông) đi ngang 1 ô tới target
  const fwd = pawnForward(attacker);
  if (isPiece(pieceAt(board, col, row - fwd), attacker, 'p')) return true;
  for (const dc of [-1, 1]) {
    if (isPiece(pieceAt(board, col + dc, row), attacker, 'p') && hasCrossedRiver(attacker, row)) {
      return true;
    }
  }

  return false;
}

/** Tướng phe `color` có đang bị chiếu không (kể cả bị Tướng đối phương "đối mặt"). */
export function isInCheck(board: (Piece | null)[], color: Color): boolean {
  const kingSq = findKing(board, color);
  if (kingSq === null) return false;
  return isKingSquareAttacked(board, kingSq, opponentOf(color));
}
