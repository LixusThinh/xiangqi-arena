import { TOTAL_SQUARES } from './constants';
import { Color, Piece, PieceType, Square } from './types';

class SplitMix64 {
  private state: bigint;
  constructor(seed: bigint) {
    this.state = seed;
  }
  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }
}

// 14 piece types: 7 red + 7 black
const PIECE_TYPES: PieceType[] = ['k', 'a', 'b', 'n', 'r', 'c', 'p'];

function pieceToIndex(piece: Piece): number {
  const typeIndex = PIECE_TYPES.indexOf(piece.type);
  return piece.color === 'r' ? typeIndex : 7 + typeIndex;
}

const prng = new SplitMix64(0x123456789abcdefn);

// 14 pieces * 90 squares
const PIECE_KEYS: bigint[][] = Array.from({ length: 14 }, () =>
  Array.from({ length: TOTAL_SQUARES }, () => prng.next()),
);

const SIDE_KEY: bigint = prng.next();

export function getPieceZobristKey(piece: Piece, sq: Square): bigint {
  const pIdx = pieceToIndex(piece);
  return PIECE_KEYS[pIdx][sq];
}

export function getSideZobristKey(): bigint {
  return SIDE_KEY;
}

export function computeZobristHash(board: (Piece | null)[], sideToMove: Color): bigint {
  let hash = 0n;
  for (let sq = 0; sq < TOTAL_SQUARES; sq++) {
    const piece = board[sq];
    if (piece !== null) {
      hash ^= getPieceZobristKey(piece, sq);
    }
  }
  if (sideToMove === 'b') {
    hash ^= SIDE_KEY;
  }
  return hash;
}

export function toHashString(hash: bigint): string {
  return (hash & 0xffffffffffffffffn).toString(16).padStart(16, '0');
}
