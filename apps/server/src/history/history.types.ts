import { MatchEndReason, MatchResult } from '@prisma/client';
import { PlayerColor } from '../game/game.types';

/** Kết quả ván nhìn từ phía người đang xem lịch sử. */
export type HistoryOutcome = 'WIN' | 'LOSS' | 'DRAW';

export interface HistoryOpponent {
  id: string;
  username: string;
  displayName: string;
  rating: number;
}

/** Thay đổi rating của người xem sau ván; null khi ván không tính Elo hoặc chưa có bản ghi. */
export interface HistoryRatingChange {
  before: number;
  after: number;
  delta: number;
}

/** Một dòng ở trang Lịch sử (FR-17). */
export interface MatchHistoryItem {
  matchId: string;
  roomCode: string;
  ruleProfileCode: string;
  isRanked: boolean;
  yourColor: PlayerColor;
  opponent: HistoryOpponent;
  outcome: HistoryOutcome;
  result: MatchResult;
  endReason: MatchEndReason | null;
  /** Tổng số nửa nước của cả hai bên (mỗi lần một bên đi = 1). */
  plyCount: number;
  startedAt: Date | null;
  endedAt: Date | null;
  /** Thời lượng ván tính bằng giây; null nếu thiếu mốc bắt đầu/kết thúc. */
  durationSec: number | null;
}

export interface MatchHistoryPage {
  items: MatchHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface HistoryMoveView {
  ply: number;
  color: PlayerColor;
  from: string;
  to: string;
  piece: string;
  captured: string | null;
  isCheck: boolean;
  thinkTimeMs: number;
  /** FEN sau nước này, để replay (XQA-33) nhảy thẳng tới từng nước. */
  fenAfter: string;
}

/** Chi tiết một ván đã kết thúc: dòng lịch sử + danh sách nước + rating. */
export interface MatchHistoryDetail extends MatchHistoryItem {
  initialFen: string;
  finalFen: string;
  ratingChange: HistoryRatingChange | null;
  moves: HistoryMoveView[];
}
