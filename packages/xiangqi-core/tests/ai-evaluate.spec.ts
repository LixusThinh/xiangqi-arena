/**
 * XQA-80 – hàm đánh giá thế cờ (giá trị quân + vị trí). Story XQA-23.
 * AC1: test đối xứng Đỏ/Đen. AC2: ghi nguồn bảng giá trị (docs/engine/ai-evaluate-search.md).
 */
import { algebraicToSquare, evaluate, Piece, pieceSquareValue, Position } from '../src';
import { colorMirror, fileMirror, randomPositions } from './support/board-helpers';

describe('XQA-80 evaluate – giá trị quân + vị trí', () => {
  it('thế khởi đầu cân bằng: 0 cho cả hai bên', () => {
    const start = Position.initial();
    expect(evaluate(start)).toBe(0);
    expect(evaluate(colorMirror(start))).toBe(0);
  });

  it('AC1 đối xứng Đỏ/Đen: đảo màu + lật bàn + đổi bên đi → điểm không đổi (40 thế cờ ngẫu nhiên)', () => {
    for (const pos of randomPositions(40, 30)) {
      expect(evaluate(colorMirror(pos))).toBe(evaluate(pos));
    }
  });

  it('đối xứng trái–phải: lật cột a↔i không đổi điểm', () => {
    for (const pos of randomPositions(20, 24, 7)) {
      expect(evaluate(fileMirror(pos))).toBe(evaluate(pos));
    }
  });

  it('quy ước negamax: cùng bàn cờ, đổi bên đi thì điểm đổi dấu', () => {
    for (const pos of randomPositions(10, 20, 11)) {
      const flipped = Position.fromFen(
        pos.toFen().replace(/ [rb] /, pos.sideToMove === 'r' ? ' b ' : ' r '),
      );
      expect(evaluate(flipped)).toBe(-evaluate(pos));
    }
  });

  it('mất Xe ≈ thua 900 điểm', () => {
    const full = Position.initial();
    const noBlackRook = Position.fromFen(full.toFen().replace('rnbakabnr/', '1nbakabnr/'));
    const diff = evaluate(noBlackRook) - evaluate(full);
    expect(diff).toBeGreaterThanOrEqual(900);
    expect(diff).toBeLessThan(950);
  });

  it('thứ tự giá trị quân: Xe > Pháo > Mã > Tượng ≥ Sĩ > Tốt chưa qua sông', () => {
    const at = (type: Piece['type'], sq: string) =>
      pieceSquareValue({ color: 'r', type }, algebraicToSquare(sq));
    expect(at('r', 'a9')).toBeGreaterThan(at('c', 'e7'));
    expect(at('c', 'a7')).toBeGreaterThan(at('n', 'e5'));
    expect(at('n', 'a9')).toBeGreaterThan(at('b', 'c9'));
    expect(at('b', 'c9')).toBeGreaterThanOrEqual(at('a', 'd9'));
    expect(at('a', 'd9')).toBeGreaterThan(at('p', 'e6'));
  });

  it('Tốt: 100 khi chưa qua sông, ≥ 200 khi đã qua sông, về 100 ở hàng đáy đối phương', () => {
    const red = (sq: string) => pieceSquareValue({ color: 'r', type: 'p' }, algebraicToSquare(sq));
    const black = (sq: string) => pieceSquareValue({ color: 'b', type: 'p' }, algebraicToSquare(sq));
    expect(red('e6')).toBe(100); // Đỏ chưa qua sông (hàng 5..9)
    expect(red('e4')).toBeGreaterThanOrEqual(200);
    expect(red('e0')).toBe(100);
    expect(black('e3')).toBe(100);
    expect(black('e5')).toBeGreaterThanOrEqual(200);
    expect(black('e9')).toBe(100);
  });
});
