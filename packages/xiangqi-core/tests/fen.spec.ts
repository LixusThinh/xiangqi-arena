import { STARTING_FEN } from '../src/constants';
import { parseFen, parsePieceChar, pieceToChar, toFen } from '../src/fen';

describe('FEN Parser and Serializer', () => {
  it('round-trips the starting FEN accurately', () => {
    const parsed = parseFen(STARTING_FEN);
    expect(parsed.sideToMove).toBe('r');
    expect(parsed.halfMoveClock).toBe(0);
    expect(parsed.fullMoveNumber).toBe(1);
    expect(toFen(parsed)).toBe(STARTING_FEN);
  });

  it('parses midgame position and round-trips correctly', () => {
    const midgameFen = 'r1bakab1r/9/1cn2cn2/p1p1p1p1p/9/2P6/P3P1P1P/1C2C4/9/RNBAKABNR b - - 5 12';
    const parsed = parseFen(midgameFen);
    expect(parsed.sideToMove).toBe('b');
    expect(parsed.halfMoveClock).toBe(5);
    expect(parsed.fullMoveNumber).toBe(12);
    expect(toFen(parsed)).toBe(midgameFen);
  });

  it('throws descriptive error on invalid rank count', () => {
    expect(() => parseFen('rnbakabnr/9/1c5c1 r - - 0 1')).toThrow('Expected 10 ranks');
  });

  it('throws descriptive error on invalid column count', () => {
    expect(() => parseFen('rnbakabnr8/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1')).toThrow('Rank 0 has');
  });

  it('throws descriptive error on unrecognized piece char', () => {
    expect(() => parseFen('xnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1')).toThrow('Unrecognized piece');
  });

  it('throws descriptive error on invalid side to move', () => {
    expect(() =>
      parseFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR x - - 0 1'),
    ).toThrow("Invalid side to move in FEN: 'x'");
  });

  it('throws descriptive error on empty FEN string', () => {
    expect(() => parseFen('')).toThrow();
  });

  it('handles piece character conversions correctly', () => {
    expect(parsePieceChar('R')).toEqual({ color: 'r', type: 'r' });
    expect(parsePieceChar('c')).toEqual({ color: 'b', type: 'c' });
    expect(pieceToChar({ color: 'r', type: 'k' })).toBe('K');
    expect(pieceToChar({ color: 'b', type: 'k' })).toBe('k');
    expect(() => parsePieceChar('z')).toThrow('Unrecognized piece character');
  });
});
