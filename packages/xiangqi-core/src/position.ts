import { STARTING_FEN } from './constants';
import { isValidSquare } from './coordinates';
import { parseFen, toFen } from './fen';
import { Color, Move, MoveUndo, Piece, PositionState, Square } from './types';
import {
  computeZobristHash,
  getPieceZobristKey,
  getSideZobristKey,
  toHashString,
} from './zobrist';
import {
  generatePieceMoves as genPieceMoves,
  hasFlyingGeneral as checkFlyingGeneral,
} from './movegen';

export class Position implements PositionState {
  board: (Piece | null)[];
  sideToMove: Color;
  halfMoveClock: number;
  fullMoveNumber: number;
  zobristHash: bigint;

  constructor(state: PositionState, hash?: bigint) {
    this.board = [...state.board];
    this.sideToMove = state.sideToMove;
    this.halfMoveClock = state.halfMoveClock;
    this.fullMoveNumber = state.fullMoveNumber;
    this.zobristHash = hash ?? computeZobristHash(this.board, this.sideToMove);
  }

  static fromFen(fen: string = STARTING_FEN): Position {
    const state = parseFen(fen);
    return new Position(state);
  }

  static initial(): Position {
    return Position.fromFen(STARTING_FEN);
  }

  applyMove(move: Move): MoveUndo {
    const { from, to } = move;
    if (!isValidSquare(from) || !isValidSquare(to)) {
      throw new Error(`Move square out of range: from=${from}, to=${to}`);
    }
    if (from === to) {
      throw new Error(`Source and destination squares cannot be identical: ${from}`);
    }

    const movingPiece = this.board[from];
    if (!movingPiece) {
      throw new Error(`No piece at source square ${from}`);
    }

    if (movingPiece.color !== this.sideToMove) {
      throw new Error(
        `Piece at square ${from} belongs to ${movingPiece.color}, but side to move is ${this.sideToMove}`,
      );
    }

    const captured = this.board[to];
    const prevHalfMoveClock = this.halfMoveClock;
    const prevZobristHash = this.zobristHash;

    // Update board
    this.board[to] = movingPiece;
    this.board[from] = null;

    // Update halfmove clock: reset on capture or pawn move, else increment
    if (captured !== null || movingPiece.type === 'p') {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Update fullmove number after Black moves
    if (this.sideToMove === 'b') {
      this.fullMoveNumber++;
    }

    // Update Zobrist hash incrementally
    let newHash = this.zobristHash;
    newHash ^= getPieceZobristKey(movingPiece, from);
    newHash ^= getPieceZobristKey(movingPiece, to);
    if (captured !== null) {
      newHash ^= getPieceZobristKey(captured, to);
    }
    newHash ^= getSideZobristKey();
    this.zobristHash = newHash;

    // Toggle turn
    this.sideToMove = this.sideToMove === 'r' ? 'b' : 'r';

    return {
      move,
      captured,
      prevHalfMoveClock,
      prevZobristHash,
    };
  }

  undoMove(undo: MoveUndo): void {
    const { move, captured, prevHalfMoveClock, prevZobristHash } = undo;
    const { from, to } = move;

    const movingPiece = this.board[to];
    if (!movingPiece) {
      throw new Error(`Cannot undo move: destination square ${to} is empty`);
    }

    // Restore board
    this.board[from] = movingPiece;
    this.board[to] = captured;

    // Reverse turn
    this.sideToMove = this.sideToMove === 'r' ? 'b' : 'r';

    // Reverse fullmove number if Black was the one who moved
    if (this.sideToMove === 'b') {
      this.fullMoveNumber--;
    }

    // Restore counters and hash
    this.halfMoveClock = prevHalfMoveClock;
    this.zobristHash = prevZobristHash;
  }

  toFen(): string {
    return toFen(this);
  }

  toHashString(): string {
    return toHashString(this.zobristHash);
  }

  clone(): Position {
    return new Position(
      {
        board: [...this.board],
        sideToMove: this.sideToMove,
        halfMoveClock: this.halfMoveClock,
        fullMoveNumber: this.fullMoveNumber,
      },
      this.zobristHash,
    );
  }

  generatePieceMoves(sq: Square): Move[] {
    return genPieceMoves(this.board, sq, this.sideToMove);
  }

  hasFlyingGeneral(): boolean {
    return checkFlyingGeneral(this.board);
  }
}
