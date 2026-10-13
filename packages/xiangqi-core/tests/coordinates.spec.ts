import {
  coordToSquare,
  squareToCoord,
  squareToAlgebraic,
  algebraicToSquare,
  isValidSquare,
} from '../src/coordinates';

describe('Coordinates Helper', () => {
  it('converts square to coord and back accurately', () => {
    expect(squareToCoord(0)).toEqual({ col: 0, row: 0 });
    expect(squareToCoord(8)).toEqual({ col: 8, row: 0 });
    expect(squareToCoord(89)).toEqual({ col: 8, row: 9 });

    expect(coordToSquare(0, 0)).toBe(0);
    expect(coordToSquare(8, 0)).toBe(8);
    expect(coordToSquare(8, 9)).toBe(89);
  });

  it('converts algebraic notation accurately', () => {
    expect(squareToAlgebraic(0)).toBe('a0');
    expect(squareToAlgebraic(8)).toBe('i0');
    expect(squareToAlgebraic(89)).toBe('i9');

    expect(algebraicToSquare('a0')).toBe(0);
    expect(algebraicToSquare('i0')).toBe(8);
    expect(algebraicToSquare('i9')).toBe(89);
  });

  it('validates square range 0..89', () => {
    expect(isValidSquare(0)).toBe(true);
    expect(isValidSquare(89)).toBe(true);
    expect(isValidSquare(-1)).toBe(false);
    expect(isValidSquare(90)).toBe(false);
    expect(isValidSquare(1.5)).toBe(false);
  });

  it('throws on invalid squares and coords', () => {
    expect(() => squareToCoord(-1)).toThrow('Invalid square: -1');
    expect(() => squareToCoord(90)).toThrow('Invalid square: 90');
    expect(() => coordToSquare(-1, 0)).toThrow();
    expect(() => coordToSquare(9, 0)).toThrow();
    expect(() => coordToSquare(0, -1)).toThrow();
    expect(() => coordToSquare(0, 10)).toThrow();
    // Non-integers & NaN
    expect(() => coordToSquare(1.5, 0)).toThrow('Invalid coordinates');
    expect(() => coordToSquare(0, 2.5)).toThrow('Invalid coordinates');
    expect(() => coordToSquare(NaN, 0)).toThrow('Invalid coordinates');
    expect(() => coordToSquare(0, NaN)).toThrow('Invalid coordinates');
    // Algebraic formats
    expect(() => algebraicToSquare('')).toThrow();
    expect(() => algebraicToSquare('a')).toThrow();
    expect(() => algebraicToSquare('a10')).toThrow();
    expect(() => algebraicToSquare('a?')).toThrow();
    expect(() => algebraicToSquare('j5')).toThrow();
    expect(() => algebraicToSquare('1a')).toThrow();
  });
});
