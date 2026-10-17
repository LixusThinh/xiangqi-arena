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
import { isInCheck, opponentOf } from './rules/check';
import { GameStatus } from './rules/game-status';

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

  /**
   * Nước đi có hợp lệ theo luật không: đúng cách đi của quân (pseudo-legal) VÀ sau khi đi
   * Tướng phe mình không bị chiếu, không lộ mặt tướng (Điều 4.3a, 6.2).
   */
  isLegalMove(move: Move): boolean {
    const { from, to } = move;
    if (!isValidSquare(from) || !isValidSquare(to) || from === to) {
      return false;
    }

    const piece = this.board[from];
    if (!piece || piece.color !== this.sideToMove) {
      return false;
    }

    return this.generatePieceMoves(from).some((m) => m.to === to);
  }

  /**
   * Nước đi HỢP LỆ của quân tại ô `sq` (đã lọc nước tự chiếu / lộ mặt tướng).
   * Đây là danh sách FE dùng để highlight. Từ XQA-49 hàm này không còn trả nước pseudo-legal.
   */
  generatePieceMoves(sq: Square): Move[] {
    return this.filterLegal(this.generatePseudoLegalPieceMoves(sq));
  }

  /** Nước đi vật lý của quân tại `sq`, CHƯA xét chiếu (dùng nội bộ, test, AI). */
  generatePseudoLegalPieceMoves(sq: Square): Move[] {
    return genPieceMoves(this.board, sq, this.sideToMove);
  }

  /** Toàn bộ nước đi vật lý của bên tới lượt, CHƯA xét chiếu. */
  generatePseudoLegalMoves(): Move[] {
    const moves: Move[] = [];
    for (let sq = 0; sq < this.board.length; sq++) {
      const p = this.board[sq];
      if (p && p.color === this.sideToMove) {
        moves.push(...genPieceMoves(this.board, sq, this.sideToMove));
      }
    }
    return moves;
  }

  /** Toàn bộ nước đi hợp lệ của bên tới lượt. Không bao giờ chứa nước tự chiếu / lộ mặt tướng. */
  generateLegalMoves(): Move[] {
    return this.filterLegal(this.generatePseudoLegalMoves());
  }

  /** Tướng phe `color` (mặc định: bên tới lượt) có đang bị chiếu không. */
  isCheck(color: Color = this.sideToMove): boolean {
    return isInCheck(this.board, color);
  }

  /**
   * Trạng thái ván sau nước vừa đi (hợp đồng XQA-216).
   * Hết nước hợp lệ → bên tới lượt thua: 'checkmate' nếu đang bị chiếu, 'no_moves' nếu không (Điều 7.1b).
   */
  getGameStatus(): GameStatus {
    const turn = this.sideToMove;
    const inCheck = this.isCheck(turn);
    const hasMove = this.generateLegalMoves().length > 0;
    return {
      turn,
      inCheck,
      result: hasMove
        ? null
        : { winner: opponentOf(turn), reason: inCheck ? 'checkmate' : 'no_moves' },
    };
  }

  hasFlyingGeneral(): boolean {
    return checkFlyingGeneral(this.board);
  }

  private filterLegal(moves: Move[]): Move[] {
    const mover = this.sideToMove;
    const legal: Move[] = [];
    for (const move of moves) {
      const undo = this.applyMove(move);
      // Sau khi đi: Tướng phe vừa đi không được bị chiếu. isInCheck đã tính cả trường hợp
      // hai Tướng đối mặt không có quân che (Tướng đối phương "bắt" được theo cột).
      if (!isInCheck(this.board, mover)) {
        legal.push(move);
      }
      this.undoMove(undo);
    }
    return legal;
  }
}
