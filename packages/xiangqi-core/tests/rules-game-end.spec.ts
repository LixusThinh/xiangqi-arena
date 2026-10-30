/**
 * XQA-86 – Unit test thế kết thúc ván: chiếu bí, hết nước, lộ mặt tướng (FR-12, FR-13, Điều 7.1).
 * Bổ sung cho rules-check.spec.ts (XQA-49): mỗi loại quân chiếu bí, chiếu bí nhờ luật lộ mặt tướng,
 * chiếu đôi, và các thế bị chiếu nhưng CHƯA kết thúc (còn ăn quân chiếu / chặn / chạy).
 */
import { algebraicToSquare, Position } from '../src';

const status = (fen: string) => Position.fromFen(fen).getGameStatus();

describe('XQA-86 thế kết thúc ván', () => {
  describe('chiếu bí → bên bị chiếu thua (Điều 7.1a)', () => {
    it.each([
      ['Mã chiếu bí (Tướng bị Sĩ, Tốt bịt đường)', '3aka3/4p1N2/9/9/9/9/9/9/9/4K4 b - - 0 1'],
      ['Tốt chiếu bí, Xe khóa đường', '3k5/2PP5/5R3/9/9/9/9/9/9/4K4 b - - 0 1'],
      ['chiếu đôi Xe + Mã', '3aka3/6N2/9/4R4/9/4n4/9/9/9/3K5 b - - 0 1'],
      ['nhờ lộ mặt tướng: Tướng Đen không được sang cột e', '3k5/3R1R3/9/9/9/9/9/9/9/4K4 b - - 0 1'],
    ])('%s', (_name, fen) => {
      expect(status(fen)).toEqual({
        turn: 'b',
        inCheck: true,
        result: { winner: 'r', reason: 'checkmate' },
      });
      expect(Position.fromFen(fen).generateLegalMoves()).toHaveLength(0);
    });
  });

  it('hết nước khi KHÔNG bị chiếu → bên hết nước thua (Điều 7.1b), không phải hòa như cờ vua', () => {
    // Tướng Đen e0 bị 3 Sĩ vây. Sĩ e1 rời đi thì Pháo Đỏ e7 (ngòi Tốt e4) chiếu Tướng → bị ghim;
    // Sĩ d0, f0 chỉ đi được vào e1 đang có quân. Không bị chiếu nhưng hết nước.
    expect(status('3aka3/4a4/9/9/4P4/9/9/4C4/9/3K5 b - - 0 1')).toEqual({
      turn: 'b',
      inCheck: false,
      result: { winner: 'r', reason: 'no_moves' },
    });
  });

  describe('bị chiếu nhưng ván CHƯA kết thúc', () => {
    it('Tướng ăn được quân chiếu không có căn', () => {
      const pos = Position.fromFen('4k4/4R4/9/9/9/9/9/9/9/3K5 b - - 0 1');
      expect(pos.getGameStatus()).toEqual({ turn: 'b', inCheck: true, result: null });
      expect(pos.isLegalMove({ from: algebraicToSquare('e0'), to: algebraicToSquare('e1') })).toBe(true);
    });

    it('chặn được đường chiếu của Xe', () => {
      expect(status('3aka3/r3P4/9/9/9/4R4/9/9/9/3K5 b - - 0 1')).toMatchObject({ inCheck: true, result: null });
    });
  });

  describe('lộ mặt tướng (Điều 4.3a)', () => {
    it('nước làm 2 Tướng đối mặt không có quân che là bất hợp lệ', () => {
      // Xe Đen e5 che giữa 2 Tướng cột e; rời cột e là lộ mặt tướng
      const pos = Position.fromFen('4k4/9/9/9/9/4r4/9/9/9/4K4 b - - 0 1');
      expect(pos.isLegalMove({ from: algebraicToSquare('e5'), to: algebraicToSquare('a5') })).toBe(false);
      expect(pos.isLegalMove({ from: algebraicToSquare('e5'), to: algebraicToSquare('e6') })).toBe(true);
    });

    it('Tướng không được bước vào cột đối mặt Tướng địch', () => {
      const pos = Position.fromFen('3k5/9/9/9/9/9/9/9/9/4K4 b - - 0 1');
      expect(pos.isLegalMove({ from: algebraicToSquare('d0'), to: algebraicToSquare('e0') })).toBe(false);
    });
  });

  it('thế khởi đầu chưa kết thúc', () => {
    expect(Position.initial().getGameStatus()).toEqual({ turn: 'r', inCheck: false, result: null });
  });
});
