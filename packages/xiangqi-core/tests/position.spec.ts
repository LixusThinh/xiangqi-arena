import {
  MoveUndo,
  Position,
  STARTING_FEN,
  algebraicToSquare,
  computeZobristHash,
} from '../src';

describe('Position Class', () => {
  it('initializes from starting FEN accurately', () => {
    const pos = Position.fromFen();
    expect(pos.toFen()).toBe(STARTING_FEN);
    expect(pos.sideToMove).toBe('r');
    expect(pos.halfMoveClock).toBe(0);
    expect(pos.fullMoveNumber).toBe(1);
    expect(pos.toHashString()).toHaveLength(16);
  });

  it('initializes via Position.initial accurately', () => {
    const pos = Position.initial();
    expect(pos.toFen()).toBe(STARTING_FEN);
    expect(pos.sideToMove).toBe('r');
  });

  it('applies a peaceful move and undos back to identical state and hash', () => {
    const pos = Position.fromFen();
    const initialFen = pos.toFen();
    const initialHash = pos.zobristHash;

    // Cannon b2 to e2: algebraic b7 = sq 64, e7 = sq 67
    const move = {
      from: algebraicToSquare('b7'), // Row 7, col 1
      to: algebraicToSquare('e7'),   // Row 7, col 4
    };

    const undoInfo = pos.applyMove(move);
    expect(pos.sideToMove).toBe('b');
    expect(pos.halfMoveClock).toBe(1);
    expect(pos.fullMoveNumber).toBe(1);
    expect(pos.zobristHash).not.toBe(initialHash);
    expect(pos.zobristHash).toBe(computeZobristHash(pos.board, pos.sideToMove));

    pos.undoMove(undoInfo);
    expect(pos.toFen()).toBe(initialFen);
    expect(pos.zobristHash).toBe(initialHash);
    expect(pos.sideToMove).toBe('r');
    expect(pos.halfMoveClock).toBe(0);
  });

  it('applies a capture move, resets halfmove, and restores captured piece on undo', () => {
    // Setup a position where Red Cannon can capture Black Horse
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2n4/9/RNBAKAB1R r - - 4 10';
    const pos = Position.fromFen(customFen);
    const initialHash = pos.zobristHash;

    // Cannon at b7 (sq 64) captures Horse at e7 (sq 67)
    const move = { from: 64, to: 67 };
    const undoInfo = pos.applyMove(move);

    expect(undoInfo.captured).toEqual({ color: 'b', type: 'n' });
    expect(pos.halfMoveClock).toBe(0); // Reset after capture
    expect(pos.board[67]?.type).toBe('c');
    expect(pos.zobristHash).toBe(computeZobristHash(pos.board, pos.sideToMove));

    pos.undoMove(undoInfo);
    expect(pos.toFen()).toBe(customFen);
    expect(pos.zobristHash).toBe(initialHash);
    expect(pos.board[67]?.type).toBe('n');
    expect(pos.board[67]?.color).toBe('b');
    expect(pos.board[64]?.type).toBe('c');
  });

  it('resets halfmove clock on pawn move even without capture', () => {
    const pos = Position.fromFen();
    // Advance pawn at c3 (Red pawn at c6: row 6, col 2 -> sq 56) to sq 47
    pos.halfMoveClock = 5;
    const move = { from: 56, to: 47 };
    const undoInfo = pos.applyMove(move);

    expect(undoInfo.captured).toBeNull();
    expect(pos.halfMoveClock).toBe(0);

    pos.undoMove(undoInfo);
    expect(pos.halfMoveClock).toBe(5);
  });

  it('supports multi-move sequence and full unroll to original state', () => {
    const pos = Position.fromFen();
    const initialFen = pos.toFen();
    const initialHash = pos.zobristHash;

    const undos: MoveUndo[] = [];
    // Move 1 (Red): Horse at b9 to c7
    undos.push(pos.applyMove({ from: 82, to: 65 }));
    expect(pos.sideToMove).toBe('b');
    expect(pos.fullMoveNumber).toBe(1);

    // Move 2 (Black): Horse at b0 to c2
    undos.push(pos.applyMove({ from: 1, to: 20 }));
    expect(pos.sideToMove).toBe('r');
    expect(pos.fullMoveNumber).toBe(2);

    // Move 3 (Red): Pawn at c6 to c5
    undos.push(pos.applyMove({ from: 56, to: 47 }));
    expect(pos.sideToMove).toBe('b');
    expect(pos.fullMoveNumber).toBe(2);

    // Unroll all
    while (undos.length > 0) {
      pos.undoMove(undos.pop()!);
    }

    expect(pos.toFen()).toBe(initialFen);
    expect(pos.zobristHash).toBe(initialHash);
    expect(pos.fullMoveNumber).toBe(1);
    expect(pos.sideToMove).toBe('r');
  });

  it('clones position without sharing board reference', () => {
    const pos = Position.fromFen();
    const cloned = pos.clone();
    expect(cloned.toFen()).toBe(pos.toFen());
    expect(cloned.zobristHash).toBe(pos.zobristHash);

    // Modifying cloned should not affect original
    cloned.applyMove({ from: 64, to: 67 });
    expect(cloned.toFen()).not.toBe(pos.toFen());
    expect(pos.board[64]?.type).toBe('c');
  });

  it('validates move parameters and throws appropriate errors', () => {
    const pos = Position.fromFen();

    // Out of bounds
    expect(() => pos.applyMove({ from: -1, to: 10 })).toThrow(/out of range/);
    expect(() => pos.applyMove({ from: 10, to: 95 })).toThrow(/out of range/);

    // Identical squares
    expect(() => pos.applyMove({ from: 64, to: 64 })).toThrow(
      /Source and destination squares cannot be identical/,
    );

    // Empty square
    expect(() => pos.applyMove({ from: 45, to: 46 })).toThrow(/No piece at source square/);

    // Wrong side to move (Black piece moved on Red turn)
    expect(() => pos.applyMove({ from: 0, to: 9 })).toThrow(/belongs to b, but side to move is r/);
  });

  it('rejects moves with identical from and to squares and leaves position intact', () => {
    const pos = Position.fromFen();
    const initialFen = pos.toFen();
    const initialHash = pos.zobristHash;

    expect(() => pos.applyMove({ from: 64, to: 64 })).toThrow(
      'Source and destination squares cannot be identical: 64',
    );
    expect(pos.toFen()).toBe(initialFen);
    expect(pos.zobristHash).toBe(initialHash);
    expect(pos.sideToMove).toBe('r');
  });

  it('throws error when undoMove destination is empty', () => {
    const pos = Position.fromFen();
    expect(() => {
      pos.undoMove({
        move: { from: 64, to: 67 },
        captured: null,
        prevHalfMoveClock: 0,
        prevZobristHash: 0n,
      });
    }).toThrow(/Cannot undo move: destination square 67 is empty/);
  });
});
