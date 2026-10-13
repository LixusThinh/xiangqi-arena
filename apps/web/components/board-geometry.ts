export const CELL_SIZE = 80;
export const OFFSET_X = 10;
export const OFFSET_Y = 10;
export const BOARD_WIDTH = 741;
export const BOARD_HEIGHT = 821;

export function getSquareCoordinates(
  sq: number,
  orientation: 'r' | 'b' = 'r',
): { x: number; y: number } {
  const col = sq % 9;
  const row = Math.floor(sq / 9);

  const displayCol = orientation === 'r' ? col : 8 - col;
  const displayRow = orientation === 'r' ? row : 9 - row;

  return {
    x: OFFSET_X + displayCol * CELL_SIZE,
    y: OFFSET_Y + displayRow * CELL_SIZE,
  };
}
