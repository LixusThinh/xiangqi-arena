import { coordToSquare, squareToCoord } from '../coordinates';
import { Color, Move, Piece, Square } from '../types';

interface HorsePattern {
  leg: { dc: number; dr: number };
  steps: { dc: number; dr: number }[];
}

const HORSE_PATTERNS: HorsePattern[] = [
  // Hướng dọc lên (North)
  {
    leg: { dc: 0, dr: -1 },
    steps: [
      { dc: -1, dr: -2 },
      { dc: 1, dr: -2 },
    ],
  },
  // Hướng dọc xuống (South)
  {
    leg: { dc: 0, dr: 1 },
    steps: [
      { dc: -1, dr: 2 },
      { dc: 1, dr: 2 },
    ],
  },
  // Hướng ngang trái (West)
  {
    leg: { dc: -1, dr: 0 },
    steps: [
      { dc: -2, dr: -1 },
      { dc: -2, dr: 1 },
    ],
  },
  // Hướng ngang phải (East)
  {
    leg: { dc: 1, dr: 0 },
    steps: [
      { dc: 2, dr: -1 },
      { dc: 2, dr: 1 },
    ],
  },
];

/**
 * Sinh danh sách nước đi vật lý (pseudo-legal) của Mã (Horse / Knight):
 * - Đi hình chữ L (8 hướng)
 * - Kiểm tra cản chân Mã theo 4 hướng trực giao tương ứng (leg square)
 * - Ô đích nằm trong bàn cờ và không chứa quân cùng phe
 */
export function generateHorseMoves(
  board: (Piece | null)[],
  from: Square,
  sideToMove: Color,
): Move[] {
  const moves: Move[] = [];
  const { col, row } = squareToCoord(from);

  for (const pattern of HORSE_PATTERNS) {
    const legCol = col + pattern.leg.dc;
    const legRow = row + pattern.leg.dr;

    // Nếu chân mã nằm ngoài bàn cờ thì không thể đi theo hướng này
    if (legCol < 0 || legCol > 8 || legRow < 0 || legRow > 9) {
      continue;
    }

    // Kiểm tra cản chân mã: Nếu ô chân mã có quân thì 2 nước đi liên quan bị cản
    const legSq = coordToSquare(legCol, legRow);
    if (board[legSq] !== null) {
      continue;
    }

    // Xét 2 nhánh bước nhảy của chân này
    for (const step of pattern.steps) {
      const targetCol = col + step.dc;
      const targetRow = row + step.dr;

      if (targetCol >= 0 && targetCol <= 8 && targetRow >= 0 && targetRow <= 9) {
        const targetSq = coordToSquare(targetCol, targetRow);
        const pieceOnTarget = board[targetSq];
        if (pieceOnTarget === null || pieceOnTarget.color !== sideToMove) {
          moves.push({ from, to: targetSq });
        }
      }
    }
  }

  return moves;
}
