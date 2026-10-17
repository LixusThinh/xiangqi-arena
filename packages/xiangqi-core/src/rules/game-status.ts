import { Side } from '../types';

/**
 * Lý do kết thúc ván mà engine tự xác định được (Sprint 1):
 * - 'checkmate': bên tới lượt đang bị chiếu và không còn nước hợp lệ (Điều 7.1a, 7.1c).
 * - 'no_moves' : bên tới lượt KHÔNG bị chiếu nhưng không còn nước hợp lệ nào (Điều 7.1b) → bị xử thua.
 * Xin thua, hòa, hết giờ, Điều 23 do tầng GameService / RepetitionJudge bổ sung ở sprint sau.
 */
export type EndReason = 'checkmate' | 'no_moves';

export interface GameResult {
  winner: Side;
  reason: EndReason;
}

/** Hợp đồng dữ liệu trạng thái ván cho FE (XQA-216). */
export interface GameStatus {
  /** Tới lượt bên nào đi. */
  turn: Side;
  /** Bên đang tới lượt có đang bị chiếu không. */
  inCheck: boolean;
  /** null = ván chưa kết thúc. */
  result: GameResult | null;
}
