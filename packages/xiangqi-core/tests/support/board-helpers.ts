/** Tiện ích dựng thế cờ cho test AI (XQA-80/81). */
import {
  algebraicToSquare,
  coordToSquare,
  Move,
  Piece,
  pieceToChar,
  Position,
  squareToAlgebraic,
} from '../../src';

/** Dựng FEN từ danh sách quân, ví dụ { e0: 'k', d9: 'K', a1: 'R' } (hoa = Đỏ). */
export function fenOf(pieces: Record<string, string>, side: 'r' | 'b' = 'r'): string {
  const board: (Piece | null)[] = Array(90).fill(null);
  for (const [sq, ch] of Object.entries(pieces)) {
    const color = ch === ch.toUpperCase() ? 'r' : 'b';
    board[algebraicToSquare(sq)] = { color, type: ch.toLowerCase() as Piece['type'] };
  }
  return `${boardToFenRows(board)} ${side} - - 0 1`;
}

export function boardToFenRows(board: (Piece | null)[]): string {
  const rows: string[] = [];
  for (let row = 0; row < 10; row++) {
    let line = '';
    let empty = 0;
    for (let col = 0; col < 9; col++) {
      const p = board[coordToSquare(col, row)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) line += String(empty);
      empty = 0;
      line += pieceToChar(p);
    }
    if (empty) line += String(empty);
    rows.push(line);
  }
  return rows.join('/');
}

/** Đảo màu + lật bàn theo chiều dọc + đổi bên đi: thế cờ "soi gương" của bên kia. */
export function colorMirror(pos: Position): Position {
  const board: (Piece | null)[] = Array(90).fill(null);
  pos.board.forEach((p, sq) => {
    if (!p) return;
    const col = sq % 9;
    const row = Math.floor(sq / 9);
    board[coordToSquare(col, 9 - row)] = { color: p.color === 'r' ? 'b' : 'r', type: p.type };
  });
  return Position.fromFen(`${boardToFenRows(board)} ${pos.sideToMove === 'r' ? 'b' : 'r'} - - 0 1`);
}

/** Lật trái–phải (cột a ↔ i). */
export function fileMirror(pos: Position): Position {
  const board: (Piece | null)[] = Array(90).fill(null);
  pos.board.forEach((p, sq) => {
    if (!p) return;
    board[coordToSquare(8 - (sq % 9), Math.floor(sq / 9))] = p;
  });
  return Position.fromFen(`${boardToFenRows(board)} ${pos.sideToMove} - - 0 1`);
}

/** PRNG có seed để test lặp lại được. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sinh thế cờ giữa ván bằng cách đi ngẫu nhiên các nước hợp lệ từ thế khởi đầu. */
export function randomPositions(count: number, plies: number, seed = 2026): Position[] {
  const rand = mulberry32(seed);
  const out: Position[] = [];
  while (out.length < count) {
    const pos = Position.initial();
    for (let i = 0; i < plies; i++) {
      const moves = pos.generateLegalMoves();
      if (moves.length === 0) break;
      pos.applyMove(moves[Math.floor(rand() * moves.length)]);
    }
    if (pos.generateLegalMoves().length > 0) out.push(pos);
  }
  return out;
}

export const uci = (m: Move | null): string | null =>
  m ? `${squareToAlgebraic(m.from)}${squareToAlgebraic(m.to)}` : null;
