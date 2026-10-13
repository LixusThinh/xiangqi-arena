import { STARTING_FEN } from '../src/constants';
import { parseFen } from '../src/fen';
import {
  computeZobristHash,
  getPieceZobristKey,
  getSideZobristKey,
  toHashString,
} from '../src/zobrist';

describe('Zobrist Hashing', () => {
  it('computes deterministic hash for identical board states', () => {
    const s1 = parseFen(STARTING_FEN);
    const s2 = parseFen(STARTING_FEN);
    const h1 = computeZobristHash(s1.board, s1.sideToMove);
    const h2 = computeZobristHash(s2.board, s2.sideToMove);

    expect(h1).toBe(h2);
    expect(toHashString(h1)).toHaveLength(16);
  });

  it('produces different hashes when side to move changes', () => {
    const s = parseFen(STARTING_FEN);
    const hRed = computeZobristHash(s.board, 'r');
    const hBlack = computeZobristHash(s.board, 'b');

    expect(hRed).not.toBe(hBlack);
    expect(hRed ^ hBlack).toBe(getSideZobristKey());
  });

  it('updates incrementally matching full recalculation', () => {
    const s = parseFen(STARTING_FEN);
    const initialHash = computeZobristHash(s.board, s.sideToMove);

    // Make move: Red Cannon at row 7, col 1 (sq 64) moves to row 7, col 4 (sq 67)
    const from = 64;
    const to = 67;
    const movingPiece = s.board[from]!;

    let incHash = initialHash;
    incHash ^= getPieceZobristKey(movingPiece, from);
    incHash ^= getPieceZobristKey(movingPiece, to);
    incHash ^= getSideZobristKey(); // Flip side

    // Apply change manually to board
    s.board[to] = movingPiece;
    s.board[from] = null;
    s.sideToMove = 'b';

    const fullRecalcHash = computeZobristHash(s.board, s.sideToMove);
    expect(incHash).toBe(fullRecalcHash);
  });
});
