import { Position, coordToSquare } from '../src';
import { generateElephantMoves } from '../src/movegen/elephant';

describe('Elephant Move Generation (Tượng)', () => {
  it('generates 4 diagonal 2-step moves when all eyes are unobstructed and within river boundary', () => {
    // Red Elephant at center post: c7 (col 2, row 7 = 65) - wait, standard elephant positions for Red:
    // c9 (col 2, row 9 = 83), g9 (col 6, row 9 = 87), a7 (col 0, row 7 = 63), e7 (col 4, row 7 = 67), i7 (col 8, row 7 = 71), c5 (col 2, row 5 = 47), g5 (col 6, row 5 = 51).
    // Let's place Red Elephant at e7 (col 4, row 7 -> sq 67).
    // Eyes:
    // to c9 (2,9): eye (3,8) = d8 (75)
    // to g9 (6,9): eye (5,8) = f8 (77)
    // to c5 (2,5): eye (3,6) = d6 (57)
    // to g5 (6,5): eye (5,6) = f6 (59)
    const customFen = '4k4/9/9/9/9/9/9/4B4/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 7); // e7 (67)

    const moves = generateElephantMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    const expected = [
      coordToSquare(2, 5), // c5 (47)
      coordToSquare(6, 5), // g5 (51)
      coordToSquare(2, 9), // c9 (83)
      coordToSquare(6, 9), // g9 (87)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('blocks Elephant move when eye square is blocked by a piece (friendly or enemy)', () => {
    // Red Elephant at e7 (sq 67).
    // Place obstacle at d6 (col 3, row 6 = 57) - blocking move towards c5 (2,5).
    // Place obstacle at f8 (col 5, row 8 = 77) - blocking move towards g9 (6,9).
    const customFen = '4k4/9/9/9/9/9/3p5/4B4/5P3/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 7);

    const moves = generateElephantMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // Moves towards c5 and g9 are blocked! Only c9 and g5 remain.
    const expected = [
      coordToSquare(6, 5), // g5 (51)
      coordToSquare(2, 9), // c9 (83)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('prevents Elephant from crossing the river', () => {
    // Red Elephant at river bank: c5 (col 2, row 5 = 47).
    // Upwards moves would be row 3 (across the river!). Elephant must NOT cross river.
    // Downwards moves: c5 -> e7 (4,7) or a7 (0,7).
    const customFen = '4k4/9/9/9/9/2B6/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(2, 5); // c5 (47)

    const moves = generateElephantMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // Can only move backwards to a7 and e7
    const expected = [
      coordToSquare(0, 7), // a7 (63)
      coordToSquare(4, 7), // e7 (67)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('allows Elephant to capture enemy piece and forbids moving onto friendly piece', () => {
    // Red Elephant at e7 (sq 67).
    // Enemy knight at c5 (col 2, row 5 = 47).
    // Friendly advisor at c9 (col 2, row 9 = 83).
    const customFen = '4k4/9/9/9/9/2n6/9/4B4/9/2A1K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 7);

    const moves = generateElephantMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to);

    // Can capture enemy knight at c5
    expect(toSquares).toContain(coordToSquare(2, 5));
    // Cannot land on friendly advisor at c9
    expect(toSquares).not.toContain(coordToSquare(2, 9));
  });

  it('works correctly for Black Elephant (restricted to rows 0..4, cannot cross to row 5+)', () => {
    // Black Elephant at e2 (col 4, row 2 = 22)
    const customFen = '4k4/9/4b4/9/9/9/9/9/9/4K4 b - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 2);

    const moves = generateElephantMoves(pos.board, sq, 'b');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    const expected = [
      coordToSquare(2, 0), // c0 (2)
      coordToSquare(6, 0), // g0 (6)
      coordToSquare(2, 4), // c2 -> c4 (38)
      coordToSquare(6, 4), // g2 -> g4 (42)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);

    // Black Elephant at c4 (col 2, row 4 = 38) cannot move forward across river (to row 6)
    const riverFen = '4k4/9/9/9/2b6/9/9/9/9/4K4 b - - 0 1';
    const riverPos = Position.fromFen(riverFen);
    const riverMoves = generateElephantMoves(riverPos.board, coordToSquare(2, 4), 'b');
    const riverToSquares = riverMoves.map((m) => m.to).sort((a, b) => a - b);

    // Can only move backwards to a2 (20) and e2 (22)
    const riverExpected = [coordToSquare(0, 2), coordToSquare(4, 2)].sort((a, b) => a - b);
    expect(riverToSquares).toEqual(riverExpected);
  });
});
