import { Position, algebraicToSquare, generateCannonMoves, squareToAlgebraic } from '../src';

function destinations(fen: string, from: string): string[] {
  const pos = Position.fromFen(fen);
  return generateCannonMoves(pos.board, algebraicToSquare(from), pos.sideToMove)
    .map((m) => squareToAlgebraic(m.to))
    .sort();
}

function move(from: string, to: string) {
  return { from: algebraicToSquare(from), to: algebraicToSquare(to) };
}

describe('MoveGen Pháo (Cannon) – XQA-45', () => {
  it('thế khai cuộc: Pháo đỏ b7 có 12 nước, gồm nước ăn Mã b0 qua ngòi Pháo b2', () => {
    const tos = destinations(Position.initial().toFen(), 'b7');
    expect(tos).toEqual(
      ['b6', 'b5', 'b4', 'b3', 'b0', 'b8', 'a7', 'c7', 'd7', 'e7', 'f7', 'g7'].sort(),
    );
    expect(tos).not.toContain('b1'); // ô trống sau ngòi không đi tới được
    expect(tos).not.toContain('h7'); // Pháo đỏ còn lại là ngòi, quân mình không ăn
  });

  it('AC1 – 0 ngòi: không ăn được quân đối phương đứng sát', () => {
    const fen = '3k5/9/9/9/4p4/4C4/9/9/9/5K3 r - - 0 1';
    const tos = destinations(fen, 'e5');
    expect(tos).not.toContain('e4');
    // Tốt đen e4 thành ngòi, nhưng sau ngòi toàn ô trống → không có nước nào phía trên
    expect(tos).not.toContain('e3');
    expect(tos).not.toContain('e0');
    expect(tos).toHaveLength(12);
    expect(Position.fromFen(fen).isLegalMove(move('e5', 'e4'))).toBe(false);
  });

  it('ăn đúng 1 ngòi; ngòi có thể là quân mình hoặc quân đối phương', () => {
    // Ngòi là quân đỏ e4, mục tiêu Tốt đen e3
    expect(destinations('3k5/9/9/4p4/4P4/4C4/9/9/9/5K3 r - - 0 1', 'e5')).toContain('e3');
    // Ngòi là quân đen e4, mục tiêu Mã đen e2
    expect(destinations('3k5/9/4n4/9/4p4/4C4/9/9/9/5K3 r - - 0 1', 'e5')).toContain('e2');
  });

  it('AC1 – 2 ngòi: không ăn được quân phía sau ngòi thứ 2', () => {
    // e4 Tốt đỏ (ngòi 1), e3 Tốt đen (bị ăn nếu xét 1 ngòi), e2 Mã đen (cần 2 ngòi)
    const fen = '3k5/9/4n4/4p4/4P4/4C4/9/9/9/5K3 r - - 0 1';
    const tos = destinations(fen, 'e5');
    expect(tos).toContain('e3');
    expect(tos).not.toContain('e2');
    expect(Position.fromFen(fen).isLegalMove(move('e5', 'e2'))).toBe(false);
  });

  it('sau ngòi gặp quân mình thì không ăn', () => {
    const tos = destinations('3k5/9/9/4P4/4P4/4C4/9/9/9/5K3 r - - 0 1', 'e5');
    expect(tos).not.toContain('e3');
    expect(tos).not.toContain('e4');
  });

  it('đi thường bị chặn bởi quân bất kỳ trên đường', () => {
    const pos = Position.fromFen('rnbakabnr/9/1c5c1/1p7/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1');
    expect(pos.isLegalMove(move('b2', 'b4'))).toBe(false); // Tốt đen b3 chặn
    expect(pos.isLegalMove(move('b2', 'b7'))).toBe(true); // ăn Pháo đỏ qua ngòi b3
  });

  it('Pháo không đi chéo', () => {
    expect(Position.initial().isLegalMove(move('b7', 'c6'))).toBe(false);
  });
});
