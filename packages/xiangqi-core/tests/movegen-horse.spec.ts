import { Position, coordToSquare } from '../src';
import { generateHorseMoves } from '../src/movegen/horse';

describe('Horse Move Generation (Mã)', () => {
  it('generates 8 moves when in center of board with all legs unblocked', () => {
    // Red Horse in open field: e5 (col 4, row 5 -> sq 49)
    const customFen = '4k4/9/9/9/9/4N4/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 5); // 49

    const moves = generateHorseMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // 8 destination squares from (4, 5):
    // Vertical up (dr = -2): (3, 3) = d3, (5, 3) = f3
    // Vertical down (dr = +2): (3, 7) = d7, (5, 7) = f7
    // Horizontal left (dc = -2): (2, 4) = c4, (2, 6) = c6
    // Horizontal right (dc = +2): (6, 4) = g4, (6, 6) = g6
    const expected = [
      coordToSquare(3, 3), // d3 (30)
      coordToSquare(5, 3), // f3 (32)
      coordToSquare(2, 4), // c4 (38)
      coordToSquare(6, 4), // g4 (42)
      coordToSquare(2, 6), // c6 (56)
      coordToSquare(6, 6), // g6 (60)
      coordToSquare(3, 7), // d7 (66)
      coordToSquare(5, 7), // f7 (68)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('blocks the 2 corresponding moves when vertical or horizontal leg is blocked', () => {
    // Red Horse at e5 (4, 5).
    // Block North leg: obstacle at e4 (col 4, row 4 -> sq 40). FEN row 4: '4p4'
    // Block East leg: obstacle at f5 (col 5, row 5 -> sq 50). FEN row 5: '4Np3'
    const customFen = '4k4/9/9/9/4p4/4Np3/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 5);

    const moves = generateHorseMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // North and East moves are blocked.
    // Remaining 4 moves:
    // Left (West leg unblocked): c4 (2,4) and c6 (2,6)
    // Down (South leg unblocked): d7 (3,7) and f7 (5,7)
    const expected = [
      coordToSquare(2, 4), // c4 (38)
      coordToSquare(2, 6), // c6 (56)
      coordToSquare(3, 7), // d7 (66)
      coordToSquare(5, 7), // f7 (68)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('blocks completely when all 4 legs are blocked', () => {
    // Red Horse at e5 (4,5) surrounded by 4 obstacles at (4,4), (4,6), (3,5), (5,5)
    const fen = '4k4/9/9/9/4p4/3pNp3/4p4/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(fen);
    const sq = coordToSquare(4, 5);

    const moves = generateHorseMoves(pos.board, sq, 'r');
    expect(moves).toHaveLength(0);
  });

  it('handles edge and corner cases without throwing out-of-bounds error', () => {
    // Horse at corner: a0 (col 0, row 0 -> sq 0)
    const customFen = 'n3k4/9/9/9/9/9/9/9/9/4K4 b - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(0, 0);

    const moves = generateHorseMoves(pos.board, sq, 'b');
    const toSquares = moves.map((m) => m.to).sort((a, b) => a - b);

    // From (0,0):
    // Only down (dr=+2, dc=+1 -> row 2, col 1 = b2) and right (dr=+1, dc=+2 -> row 1, col 2 = c1)
    const expected = [
      coordToSquare(2, 1), // c1 (11)
      coordToSquare(1, 2), // b2 (19)
    ].sort((a, b) => a - b);

    expect(toSquares).toEqual(expected);
  });

  it('allows capturing enemy piece and prevents capturing friendly piece', () => {
    // Red Horse at e5 (4,5).
    // Enemy piece at d7 (3,7).
    // Friendly piece at f7 (5,7).
    const customFen = '4k4/9/9/9/9/4N4/9/3r1A3/9/4K4 r - - 0 1';
    const pos = Position.fromFen(customFen);
    const sq = coordToSquare(4, 5);

    const moves = generateHorseMoves(pos.board, sq, 'r');
    const toSquares = moves.map((m) => m.to);

    // Can capture enemy chariot at d7 (3,7)
    expect(toSquares).toContain(coordToSquare(3, 7));
    // Cannot capture friendly advisor at f7 (5,7)
    expect(toSquares).not.toContain(coordToSquare(5, 7));
  });
});
