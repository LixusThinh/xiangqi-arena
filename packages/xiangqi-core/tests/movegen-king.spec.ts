import { Position, coordToSquare } from '../src';
import { generateKingMoves } from '../src/movegen/king';

describe('King Move Generation (Tướng)', () => {
  it('generates 4 orthogonal moves within the palace when in center', () => {
    // Red King at center of Palace: e8 (col 4, row 8 -> sq 76)
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/9/9/4K4/RNBA1ABNR r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 8); // e8

    const moves = generateKingMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // Can move to e9 (col 4, row 9 = 85), e7 (col 4, row 7 = 67), d8 (col 3, row 8 = 75), f8 (col 5, row 8 = 77)
    const expected = [
      coordToSquare(4, 7), // e7 (67)
      coordToSquare(3, 8), // d8 (75)
      coordToSquare(5, 8), // f8 (77)
      coordToSquare(4, 9), // e9 (85)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('restricts King to palace boundaries (corners have only 2 moves)', () => {
    // Red King at bottom-left corner of palace: d9 (col 3, row 9 = 84)
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/9/9/9/3K5 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(3, 9); // 84

    const moves = generateKingMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // Can only move up to d8 (75) or right to e9 (85)
    const expected = [coordToSquare(3, 8), coordToSquare(4, 9)].sort((a, b) => a - b);
    expect(toSquares).toEqual(expected);
  });

  it('does not allow King to move into squares occupied by friendly pieces', () => {
    // Initial starting FEN: Red King at e9 (sq 85), advisors at d9 (sq 84) and f9 (sq 86)
    const pos = Position.initial();
    const kingSq = coordToSquare(4, 9); // e9 (85)

    const moves = generateKingMoves(pos.board, kingSq, 'r');
    // Only forward to e8 (76) is valid because d9 and f9 have friendly advisors
    expect(moves).toHaveLength(1);
    expect(moves[0].to).toBe(coordToSquare(4, 8)); // e8
  });

  it('allows King to capture enemy piece inside the palace', () => {
    // Enemy knight at e8 (sq 76)
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/9/9/4n4/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const kingSq = coordToSquare(4, 9); // e9

    const moves = generateKingMoves(pos.board, kingSq, 'r');
    const captureMove = moves.find((m) => m.to === coordToSquare(4, 8));
    expect(captureMove).toBeDefined();
  });

  it('allows Flying General (bay tướng ăn tướng đối phương) when unobstructed on same file', () => {
    // Red King at e9 (col 4, row 9 = 85), Black King at e0 (col 4, row 0 = 4), file 4 is completely empty between them
    const customFen = '4k4/9/9/9/9/9/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const kingSq = coordToSquare(4, 9); // 85

    const moves = generateKingMoves(pos.board, kingSq, 'r');
    // Normal moves: e8 (76), d9 (84), f9 (86) + Flying General move: e0 (4)
    const toSquares = moves.map((m) => m.to);
    expect(toSquares).toContain(coordToSquare(4, 0)); // e0
  });

  it('blocks Flying General when there is an obstacle piece between Kings', () => {
    // Obstacle at e5 (col 4, row 5 = 49)
    const customFen = '4k4/9/9/9/9/4P4/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const kingSq = coordToSquare(4, 9);

    const moves = generateKingMoves(pos.board, kingSq, 'r');
    const toSquares = moves.map((m) => m.to);
    expect(toSquares).not.toContain(coordToSquare(4, 0));
  });

  it('works correctly for Black King in Black palace (rows 0..2, cols 3..5)', () => {
    const customFen = '3k5/9/9/9/9/9/9/9/9/4K4 b - - 0 1'; // Black King at d0 (col 3, row 0 = 3)
    const pos = Position.fromFen(customFen);
    const kingSq = coordToSquare(3, 0);

    const moves = generateKingMoves(pos.board, kingSq, 'b');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // Can only move down to d1 (col 3, row 1 = 12) or right to e0 (col 4, row 0 = 4)
    const expected = [coordToSquare(4, 0), coordToSquare(3, 1)].sort((a, b) => a - b);
    expect(toSquares).toEqual(expected);
  });
});
