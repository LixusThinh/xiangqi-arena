import { BOARD_FILES, BOARD_RANKS, TOTAL_SQUARES } from './constants';
import { Square } from './types';

export function isValidSquare(sq: number): sq is Square {
  return Number.isInteger(sq) && sq >= 0 && sq < TOTAL_SQUARES;
}

export function squareToCoord(sq: Square): { col: number; row: number } {
  if (!isValidSquare(sq)) {
    throw new Error(`Invalid square: ${sq}`);
  }
  return {
    col: sq % BOARD_FILES,
    row: Math.floor(sq / BOARD_FILES),
  };
}

export function coordToSquare(col: number, row: number): Square {
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    col < 0 ||
    col >= BOARD_FILES ||
    row < 0 ||
    row >= BOARD_RANKS
  ) {
    throw new Error(`Invalid coordinates: col=${col}, row=${row}`);
  }
  return row * BOARD_FILES + col;
}

export function squareToAlgebraic(sq: Square): string {
  const { col, row } = squareToCoord(sq);
  const fileChar = String.fromCharCode('a'.charCodeAt(0) + col);
  return `${fileChar}${row}`;
}

const ALGEBRAIC_REGEX = /^[a-i][0-9]$/;

export function algebraicToSquare(alg: string): Square {
  if (!alg || !ALGEBRAIC_REGEX.test(alg)) {
    throw new Error(`Invalid algebraic coordinate: ${alg}`);
  }
  const col = alg.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = Number(alg[1]);
  return coordToSquare(col, row);
}
