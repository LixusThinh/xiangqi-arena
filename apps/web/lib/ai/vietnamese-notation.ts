import { Position, type Move, squareToCoord } from '@xiangqi-arena/xiangqi-core';

const PIECE_NAMES: Record<string, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  b: 'Tượng',
  n: 'Mã',
  r: 'Xe',
  c: 'Pháo',
  p: 'Tốt',
};

/**
 * Tạo ký hiệu nước đi tiếng Việt chuẩn theo luật Cờ tướng Việt Nam:
 * - Đỏ: đánh số cột 1–9 từ phải sang trái của Đỏ (9 - col).
 * - Đen: đánh số cột 1–9 từ phải sang trái của Đen (col + 1).
 * - Động từ: Tấn / Thoái / Bình.
 * - Hai quân cùng loại cùng cột: dùng "Trước" / "Sau" (ví dụ: "Pháo trước bình 5", "Xe sau tấn 1").
 * - Quân đi chéo (Mã, Tượng, Sĩ): số thứ tư là cột đích.
 * - Quân đi thẳng (Xe, Pháo, Tốt, Tướng): số thứ tư khi tấn/thoái là số bước đi.
 */
export function formatVietnameseMove(positionBefore: Position, move: Move): string {
  const piece = positionBefore.board[move.from];
  if (!piece) return '';

  const { color, type } = piece;
  const isRed = color === 'r';
  const fromCoord = squareToCoord(move.from);
  const toCoord = squareToCoord(move.to);

  const pieceName = PIECE_NAMES[type] ?? type.toUpperCase();

  // Đổi tọa độ col (0..8) thành số cột theo góc nhìn của phe (1..9)
  const toSideCol = (c: number) => (isRed ? 9 - c : c + 1);
  const fromColNum = toSideCol(fromCoord.col);
  const toColNum = toSideCol(toCoord.col);

  // Tìm các quân cùng loại, cùng màu trên cùng cột xuất phát
  const sameColPieces: Array<{ sq: number; row: number }> = [];
  for (let r = 0; r < 10; r++) {
    const sq = r * 9 + fromCoord.col;
    const p = positionBefore.board[sq];
    if (p && p.color === color && p.type === type) {
      sameColPieces.push({ sq, row: r });
    }
  }

  // Xác định tiền tố định danh quân
  let pieceIdentifier = `${pieceName} ${fromColNum}`;
  if (sameColPieces.length === 2) {
    // Sắp xếp theo hướng tiến về phía đối phương
    // Đỏ tiến về row 0 -> row nhỏ hơn là "Trước"
    // Đen tiến về row 9 -> row lớn hơn là "Trước"
    sameColPieces.sort((a, b) => (isRed ? a.row - b.row : b.row - a.row));
    if (sameColPieces[0].sq === move.from) {
      pieceIdentifier = `${pieceName} trước`;
    } else {
      pieceIdentifier = `${pieceName} sau`;
    }
  }

  // Xác định động từ Tấn / Thoái / Bình
  let verb = 'bình';
  let target = '';

  const deltaRow = toCoord.row - fromCoord.row;

  if (deltaRow === 0) {
    verb = 'bình';
    target = String(toColNum);
  } else {
    // Đỏ: deltaRow < 0 là tiến (tấn), > 0 là lùi (thoái)
    // Đen: deltaRow > 0 là tiến (tấn), < 0 là lùi (thoái)
    const isAdvancing = isRed ? deltaRow < 0 : deltaRow > 0;
    verb = isAdvancing ? 'tấn' : 'thoái';

    const isDiagonal = type === 'n' || type === 'b' || type === 'a';
    if (isDiagonal) {
      target = String(toColNum);
    } else {
      target = String(Math.abs(deltaRow));
    }
  }

  return `${pieceIdentifier} ${verb} ${target}`;
}
