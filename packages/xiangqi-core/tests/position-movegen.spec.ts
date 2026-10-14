import { Position, coordToSquare } from '../src';

describe('Position MoveGen Integration & Flying General Detection', () => {
  it('generates correct moves for King, Advisor, Elephant, and Horse in starting position', () => {
    const pos = Position.initial();

    // Red's turn ('r')
    // Red King at e9 (sq 85 = 4, 9)
    // Only forward to e8 is possible (d9 and f9 blocked by advisors)
    const kingMoves = pos.generatePieceMoves(coordToSquare(4, 9));
    expect(kingMoves).toHaveLength(1);
    expect(kingMoves[0].to).toBe(coordToSquare(4, 8));

    // Red Advisor at d9 (sq 84 = 3, 9) -> moves to e8
    const advisorMoves = pos.generatePieceMoves(coordToSquare(3, 9));
    expect(advisorMoves).toHaveLength(1);
    expect(advisorMoves[0].to).toBe(coordToSquare(4, 8));

    // Red Elephant at c9 (sq 83 = 2, 9)
    // Eyes: to e7 (eye d8 is empty), to a7 (eye b8 is empty) -> 2 moves
    const elephantMoves = pos.generatePieceMoves(coordToSquare(2, 9));
    expect(elephantMoves).toHaveLength(2);
    const elephantTos = elephantMoves.map((m) => m.to).sort((a, b) => a - b);
    expect(elephantTos).toEqual([coordToSquare(0, 7), coordToSquare(4, 7)].sort((a, b) => a - b));

    // Red Horse at b9 (sq 82 = 1, 9)
    // Legs: vertical up (1,8) is empty! Horizontal (0,9) has Chariot, (2,9) has Elephant!
    // Vertical leg (1,8) allows jumping to a7 (0,7) and c7 (2,7) -> 2 moves
    const horseMoves = pos.generatePieceMoves(coordToSquare(1, 9));
    expect(horseMoves).toHaveLength(2);
    const horseTos = horseMoves.map((m) => m.to).sort((a, b) => a - b);
    expect(horseTos).toEqual([coordToSquare(0, 7), coordToSquare(2, 7)].sort((a, b) => a - b));
  });

  it('returns empty array when selecting empty square or opponent piece', () => {
    const pos = Position.initial();

    // Empty square (e.g. e8 = 76)
    expect(pos.generatePieceMoves(coordToSquare(4, 8))).toEqual([]);

    // Black piece when sideToMove is Red (e.g. Black Horse at b0 = sq 1)
    expect(pos.generatePieceMoves(coordToSquare(1, 0))).toEqual([]);
  });

  it('detects Flying General (hasFlyingGeneral) when Kings face each other without obstacle', () => {
    // Both Kings on e-file with nothing between them
    const fen = '4k4/9/9/9/9/9/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(fen);
    expect(pos.hasFlyingGeneral()).toBe(true);
  });

  it('returns false for hasFlyingGeneral when there is an obstacle between Kings', () => {
    // Starting FEN has pawns and cannons between Kings
    const pos = Position.initial();
    expect(pos.hasFlyingGeneral()).toBe(false);
  });

  it('returns false for hasFlyingGeneral when Kings are on different files', () => {
    // Black King at d0 (col 3), Red King at e9 (col 4)
    const fen = '3k5/9/9/9/9/9/9/9/9/4K4 r - - 0 1';
    const pos = Position.fromFen(fen);
    expect(pos.hasFlyingGeneral()).toBe(false);
  });
});
