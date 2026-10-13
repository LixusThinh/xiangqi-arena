import {
  getSquareCoordinates,
  CELL_SIZE,
  OFFSET_X,
  OFFSET_Y,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from '../components/board-geometry';
import { FEN_PRESETS } from '../components/fen-presets';

describe('board-geometry', () => {
  it('has correct geometric constants', () => {
    expect(CELL_SIZE).toBe(80);
    expect(OFFSET_X).toBe(10);
    expect(OFFSET_Y).toBe(10);
    expect(BOARD_WIDTH).toBe(741);
    expect(BOARD_HEIGHT).toBe(821);
  });

  describe('Red perspective (orientation = "r")', () => {
    it('maps Black baseline (sq 0: a9/Black Rook) to top-left (10, 10)', () => {
      const { x, y } = getSquareCoordinates(0, 'r');
      expect(x).toBe(10);
      expect(y).toBe(10);
    });

    it('maps Black King (sq 4: e9) to (330, 10)', () => {
      const { x, y } = getSquareCoordinates(4, 'r');
      expect(x).toBe(10 + 4 * 80); // 330
      expect(y).toBe(10);
    });

    it('maps Red baseline (sq 89: i0/Red Rook) to bottom-right (650, 730)', () => {
      const { x, y } = getSquareCoordinates(89, 'r');
      expect(x).toBe(10 + 8 * 80); // 650
      expect(y).toBe(10 + 9 * 80); // 730
    });

    it('maps Red King (sq 85: e0) to (330, 730)', () => {
      const { x, y } = getSquareCoordinates(85, 'r');
      expect(x).toBe(10 + 4 * 80); // 330
      expect(y).toBe(10 + 9 * 80); // 730
    });
  });

  describe('Black perspective (orientation = "b")', () => {
    it('maps Black baseline (sq 0) to bottom-right (650, 730)', () => {
      const { x, y } = getSquareCoordinates(0, 'b');
      expect(x).toBe(650);
      expect(y).toBe(730);
    });

    it('maps Black King (sq 4) to (330, 730)', () => {
      const { x, y } = getSquareCoordinates(4, 'b');
      expect(x).toBe(330);
      expect(y).toBe(730);
    });

    it('maps Red baseline (sq 89) to top-left (10, 10)', () => {
      const { x, y } = getSquareCoordinates(89, 'b');
      expect(x).toBe(10);
      expect(y).toBe(10);
    });

    it('maps Red King (sq 85) to (330, 10)', () => {
      const { x, y } = getSquareCoordinates(85, 'b');
      expect(x).toBe(330);
      expect(y).toBe(10);
    });
  });

  describe('bounds checking', () => {
    it('throws RangeError for invalid square indices', () => {
      expect(() => getSquareCoordinates(-1)).toThrow(RangeError);
      expect(() => getSquareCoordinates(90)).toThrow(RangeError);
      expect(() => getSquareCoordinates(100)).toThrow(RangeError);
      expect(() => getSquareCoordinates(NaN)).toThrow(RangeError);
      expect(() => getSquareCoordinates(3.14)).toThrow(RangeError);
    });
  });

  describe('fen-presets', () => {
    it('contains 4 presets with required properties', () => {
      expect(FEN_PRESETS).toHaveLength(4);
      expect(FEN_PRESETS.map((p) => p.id)).toEqual([
        'initial',
        'midgame-1',
        'midgame-2',
        'endgame-1',
      ]);
      FEN_PRESETS.forEach((preset) => {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(preset.fen).toBeTruthy();
      });
    });
  });
});
