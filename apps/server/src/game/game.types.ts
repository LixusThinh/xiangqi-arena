import { MatchEndReason, MatchResult, MatchStatus } from '@prisma/client';

export type PlayerColor = 'RED' | 'BLACK';

export interface GamePlayer {
  id: string;
  username: string;
  displayName: string;
  rating: number;
}

export interface GameMoveView {
  ply: number;
  /** Ô theo ký hiệu a0..i9 (hàng 0 = hàng đáy bên Đen), giống xiangqi-core. */
  from: string;
  to: string;
  piece: string;
  captured: string | null;
  isCheck: boolean;
}

/** Trạng thái ván gửi cho FE (REST và socket dùng chung). */
export interface GameStateView {
  matchId: string;
  roomCode: string;
  status: MatchStatus;
  fen: string;
  ply: number;
  /** Bên tới lượt; null khi ván đã kết thúc. */
  turn: PlayerColor | null;
  inCheck: boolean;
  result: MatchResult | null;
  endReason: MatchEndReason | null;
  /** Căn cứ luật khi ván kết thúc do lặp nước (Điều 23), null nếu không phải. */
  endRule: string | null;
  red: GamePlayer;
  black: GamePlayer;
  /** Màu của người đang xem; null nếu không phải người chơi. */
  yourColor: PlayerColor | null;
  lastMove: GameMoveView | null;
  moves: GameMoveView[];
  redTimeLeftMs: number;
  blackTimeLeftMs: number;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface MoveInput {
  from: string;
  to: string;
  /**
   * Số nửa nước client đang thấy (state.ply). Server từ chối nếu lệch → chống gửi trùng
   * và chống đi trên thế cờ cũ.
   */
  expectedPly: number;
}
