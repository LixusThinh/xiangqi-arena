import { Position, coordToSquare } from '../src';
import { generateAdvisorMoves } from '../src/movegen/advisor';

describe('Advisor Move Generation (Sĩ)', () => {
  it('generates 4 diagonal moves when Advisor is at center of Palace (e8 for Red)', () => {
    // Red Advisor at center of Palace: e8 (col 4, row 8 -> sq 76), surrounded by empty squares
    const customFen = '4k4/9/9/9/9/9/9/9/4A4/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 8); // e8 (76)

    const moves = generateAdvisorMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    const expected = [
      coordToSquare(3, 7), // d7 (66)
      coordToSquare(5, 7), // f7 (68)
      coordToSquare(3, 9), // d9 (84)
      coordToSquare(5, 9), // f9 (86)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('restricts Advisor at palace corner (d9) to exactly 1 move towards center (e8)', () => {
    // Empty board except Red Advisor at d9 (col 3, row 9 = 84)
    const customFen = '4k4/9/9/9/9/9/9/9/9/3A5 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(3, 9); // 84

    const moves = generateAdvisorMoves(pos.board, sq, 'r');
    expect(moves).toHaveLength(1);
    expect(moves[0].to).toBe(coordToSquare(4, 8)); // e8 (76)
  });

  it('blocks Advisor from moving into squares occupied by friendly pieces', () => {
    // Friendly Pawn at e8 (76), Red Advisor at d9 (84)
    const customFen = '4k4/9/9/9/9/9/9/9/4P4/3A5 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(3, 9); // d9 (84)

    const moves = generateAdvisorMoves(pos.board, sq, 'r');
    expect(moves).toHaveLength(0);
  });

  it('allows Advisor to capture enemy piece on destination square', () => {
    // Enemy knight at e8 (sq 76), Red Advisor at d9 (sq 84)
    const customFen = '4k4/9/9/9/9/9/9/9/4n4/3A5 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(3, 9);

    const moves = generateAdvisorMoves(pos.board, sq, 'r');
    expect(moves).toHaveLength(1);
    expect(moves[0].to).toBe(coordToSquare(4, 8));
  });

  it('works correctly for Black Advisor (e1 center has 4 moves, d0 corner has 1 move)', () => {
    // Black Advisor at e1 (col 4, row 1 = 13), Black King at e0 (col 4, row 0 = 4)
    const customFen = '4k4/4a4/9/9/9/9/9/9/9/4K4 b - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 1);

    const moves = generateAdvisorMoves(pos.board, sq, 'b');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    const expected = [
      coordToSquare(3, 0), // d0 (3)
      coordToSquare(5, 0), // f0 (5)
      coordToSquare(3, 2), // d2 (21)
      coordToSquare(5, 2), // f2 (23)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);

    // From d0 (3), only to e1 (13)
    const cornerFen = '3a5/9/9/9/9/9/9/9/9/4K4 b - - 0 1';
    const cornerPos = Position.fromFen(cornerFen);
    const cornerMoves = generateAdvisorMoves(cornerPos.board, coordToSquare(3, 0), 'b');
    expect(cornerMoves).toHaveLength(1);
    expect(cornerMoves[0].to).toBe(coordToSquare(4, 1));
  });
});
