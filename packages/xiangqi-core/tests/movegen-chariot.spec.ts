import { Position, algebraicToSquare, generateChariotMoves, squareToAlgebraic } from '../src';

function destinations(fen: string, from: string): string[] {
  const pos = Position.fromFen(fen);
  return generateChariotMoves(pos.board, algebraicToSquare(from), pos.sideToMove)
    .map((m) => squareToAlgebraic(m.to))
    .sort();
}

describe('MoveGen Xe (Chariot) – XQA-45', () => {
  it('đi dọc và ngang không giới hạn số bước trên bàn trống', () => {
    // Xe đỏ e5, chỉ có 2 Tướng nằm ngoài hàng/cột của Xe
    const tos = destinations('3k5/9/9/9/9/4R4/9/9/9/5K3 r - - 0 1', 'e5');
    expect(tos).toHaveLength(17); // 9 ô cột e + 8 ô hàng 5
    expect(tos).toEqual(
      [
        'e0', 'e1', 'e2', 'e3', 'e4', 'e6', 'e7', 'e8', 'e9',
        'a5', 'b5', 'c5', 'd5', 'f5', 'g5', 'h5', 'i5',
      ].sort(),
    );
  });

  it('ăn quân đối phương đầu tiên gặp và không đi xuyên qua nó', () => {
    const tos = destinations('3k5/9/9/9/4p4/4R4/9/9/9/5K3 r - - 0 1', 'e5');
    expect(tos).toContain('e4'); // ăn Tốt đen
    expect(tos).not.toContain('e3');
    expect(tos).not.toContain('e0');
    expect(tos).toHaveLength(13);
  });

  it('bị quân mình chặn: không ăn quân mình, không đi qua', () => {
    const tos = destinations('3k5/9/9/9/4P4/4R4/9/9/9/5K3 r - - 0 1', 'e5');
    expect(tos).not.toContain('e4');
    expect(tos).not.toContain('e3');
    expect(tos).toHaveLength(12);
  });

  it('thế khai cuộc: Xe đỏ a9 chỉ tiến được a8, a7', () => {
    const pos = Position.initial();
    const tos = pos
      .generatePieceMoves(algebraicToSquare('a9'))
      .map((m) => squareToAlgebraic(m.to))
      .sort();
    expect(tos).toEqual(['a7', 'a8']);
  });

  it('Xe đen đi được qua sông sang sân Đỏ', () => {
    const tos = destinations('r2k5/9/9/9/9/9/9/9/9/5K3 b - - 0 1', 'a0');
    expect(tos).toContain('a9');
    expect(tos).toContain('a5');
    expect(tos).toContain('c0');
    expect(tos).not.toContain('d0'); // Tướng đen đứng d0
  });

  it('Position.isLegalMove từ chối Xe đi chéo hoặc nhảy qua quân', () => {
    const pos = Position.initial();
    expect(pos.isLegalMove({ from: algebraicToSquare('a9'), to: algebraicToSquare('b8') })).toBe(false);
    expect(pos.isLegalMove({ from: algebraicToSquare('a9'), to: algebraicToSquare('a5') })).toBe(false);
    expect(pos.isLegalMove({ from: algebraicToSquare('a9'), to: algebraicToSquare('a7') })).toBe(true);
  });
});
