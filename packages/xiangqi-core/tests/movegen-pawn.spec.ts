import {
  Position,
  algebraicToSquare,
  generatePawnMoves,
  hasCrossedRiver,
  squareToAlgebraic,
} from '../src';

function destinations(fen: string, from: string): string[] {
  const pos = Position.fromFen(fen);
  return generatePawnMoves(pos.board, algebraicToSquare(from), pos.sideToMove)
    .map((m) => squareToAlgebraic(m.to))
    .sort();
}

function move(from: string, to: string) {
  return { from: algebraicToSquare(from), to: algebraicToSquare(to) };
}

describe('MoveGen Tốt (Pawn) – XQA-45', () => {
  it('xác định qua sông theo phía từng bên', () => {
    expect(hasCrossedRiver('r', 5)).toBe(false); // bờ sông bên Đỏ
    expect(hasCrossedRiver('r', 4)).toBe(true);
    expect(hasCrossedRiver('b', 4)).toBe(false); // bờ sông bên Đen
    expect(hasCrossedRiver('b', 5)).toBe(true);
  });

  it('Tốt đỏ chưa qua sông chỉ tiến 1 ô', () => {
    expect(destinations(Position.initial().toFen(), 'e6')).toEqual(['e5']);
    // Hàng 5 vẫn là sân Đỏ: chưa được đi ngang
    expect(destinations('3k5/9/9/9/9/4P4/9/9/9/5K3 r - - 0 1', 'e5')).toEqual(['e4']);
  });

  it('AC2 – Tốt chưa qua sông đi ngang bị từ chối, đi lùi bị từ chối', () => {
    const pos = Position.initial();
    expect(pos.isLegalMove(move('e6', 'd6'))).toBe(false);
    expect(pos.isLegalMove(move('e6', 'e7'))).toBe(false);
    expect(pos.isLegalMove(move('e6', 'e5'))).toBe(true);
  });

  it('Tốt đỏ đã qua sông: tiến hoặc ngang, không lùi', () => {
    const tos = destinations('3k5/9/9/9/4P4/9/9/9/9/5K3 r - - 0 1', 'e4');
    expect(tos).toEqual(['d4', 'e3', 'f4']);
    expect(tos).not.toContain('e5');
  });

  it('Tốt ở hàng đáy đối phương chỉ còn đi ngang', () => {
    expect(destinations('4P4/5k3/9/9/9/9/9/9/9/3K5 r - - 0 1', 'e0')).toEqual(['d0', 'f0']);
  });

  it('Tốt ăn quân đối phương theo hướng đi, không ăn quân mình', () => {
    const tos = destinations('3k5/9/9/9/3PPp3/9/9/9/9/5K3 r - - 0 1', 'e4');
    expect(tos).toEqual(['e3', 'f4']);
  });

  it('Tốt đen đi xuống: chưa qua sông chỉ tiến, qua sông thì tiến/ngang', () => {
    const start = Position.initial().toFen().replace(' r ', ' b ');
    expect(destinations(start, 'e3')).toEqual(['e4']);
    const tos = destinations('3k5/9/9/9/9/4p4/9/9/9/5K3 b - - 0 1', 'e5');
    expect(tos).toEqual(['d5', 'e6', 'f5']);
    expect(tos).not.toContain('e4');
  });
});
