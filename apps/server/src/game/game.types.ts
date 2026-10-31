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

/** Đề nghị hòa đang chờ đối thủ trả lời (XQA-91). */
export interface DrawOfferView {
  by: PlayerColor;
  /** Ply lúc đề nghị. */
  atPly: number;
}

/** Người chơi đang mất kết nối, ván được giữ tới `deadline` (XQA-93). */
export interface DisconnectedPlayerView {
  color: PlayerColor;
  deadline: Date;
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
  /** Đề nghị hòa đang chờ; null nếu không có hoặc ván đã kết thúc. */
  drawOffer: DrawOfferView | null;
  /** Người chơi đang mất kết nối (chỉ khi ván ACTIVE). Rỗng nếu cả hai đều đang kết nối. */
  disconnected: DisconnectedPlayerView[];
  /** Thời gian còn lại (ms) của mỗi bên, tính tại `serverTime` (XQA-141). Server là nơi duy nhất tính giờ. */
  redTimeLeftMs: number;
  blackTimeLeftMs: number;
  /** Bên có đồng hồ đang chạy (bên tới lượt của ván ACTIVE); null khi ván chưa chạy giờ / đã kết thúc. */
  clockRunning: PlayerColor | null;
  /** Số mili giây được cộng sau mỗi nước (RuleProfile.incrementSec). */
  incrementMs: number;
  /** Thời điểm server chụp đồng hồ (ISO). Client dùng để đếm lùi hiển thị, không dùng để xử hết giờ. */
  serverTime: string;
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
