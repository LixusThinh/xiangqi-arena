import { BOARD_FILES, BOARD_RANKS, TOTAL_SQUARES } from './constants';
import { Color, Piece, PieceType, PositionState } from './types';

const VALID_PIECE_TYPES = new Set<PieceType>(['k', 'a', 'b', 'n', 'r', 'c', 'p']);

export function parsePieceChar(char: string): Piece {
  const isUpper = char === char.toUpperCase();
  const lower = char.toLowerCase() as PieceType;
  if (!VALID_PIECE_TYPES.has(lower)) {
    throw new Error(`Unrecognized piece character: '${char}'`);
  }
  return {
    color: isUpper ? 'r' : 'b',
    type: lower,
  };
}

export function pieceToChar(piece: Piece): string {
  return piece.color === 'r' ? piece.type.toUpperCase() : piece.type.toLowerCase();
}

export function parseFen(fen: string): PositionState {
  const trimmed = fen.trim();
  if (!trimmed) {
    throw new Error('FEN string cannot be empty');
  }

  const parts = trimmed.split(/\s+/);
  const [boardStr, sideStr = 'r', , , halfMoveStr = '0', fullMoveStr = '1'] = parts;

  const ranks = boardStr.split('/');
  if (ranks.length !== BOARD_RANKS) {
    throw new Error(`Expected ${BOARD_RANKS} ranks in FEN, received ${ranks.length}`);
  }

  const board: (Piece | null)[] = new Array(TOTAL_SQUARES).fill(null);

  for (let r = 0; r < BOARD_RANKS; r++) {
    const rankStr = ranks[r];
    let col = 0;
    for (const char of rankStr) {
      if (char >= '1' && char <= '9') {
        col += Number(char);
      } else {
        if (col >= BOARD_FILES) {
          throw new Error(`Rank ${r} has more than ${BOARD_FILES} columns`);
        }
        const piece = parsePieceChar(char);
        board[r * BOARD_FILES + col] = piece;
        col += 1;
      }
    }
    if (col !== BOARD_FILES) {
      throw new Error(`Rank ${r} has ${col} columns instead of ${BOARD_FILES}`);
    }
  }

  const normalizedSide = sideStr.toLowerCase();
  if (normalizedSide !== 'r' && normalizedSide !== 'b') {
    throw new Error(`Invalid side to move in FEN: '${sideStr}'`);
  }
  const sideToMove: Color = normalizedSide as Color;
  const halfMoveClock = Math.max(0, parseInt(halfMoveStr, 10) || 0);
  const fullMoveNumber = Math.max(1, parseInt(fullMoveStr, 10) || 1);

  return {
    board,
    sideToMove,
    halfMoveClock,
    fullMoveNumber,
  };
}

export function toFen(state: PositionState): string {
  const ranks: string[] = [];

  for (let r = 0; r < BOARD_RANKS; r++) {
    let rankStr = '';
    let emptyCount = 0;
    for (let c = 0; c < BOARD_FILES; c++) {
      const piece = state.board[r * BOARD_FILES + c];
      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rankStr += emptyCount.toString();
          emptyCount = 0;
        }
        rankStr += pieceToChar(piece);
      }
    }
    if (emptyCount > 0) {
      rankStr += emptyCount.toString();
    }
    ranks.push(rankStr);
  }

  return `${ranks.join('/')} ${state.sideToMove} - - ${state.halfMoveClock} ${state.fullMoveNumber}`;
}
