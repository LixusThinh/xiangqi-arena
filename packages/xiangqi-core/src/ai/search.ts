import type { Position } from '../position';
import { Move } from '../types';
import { evaluate, MATE_SCORE, PIECE_VALUES } from './evaluate';

/**
 * Minimax dạng negamax + cắt tỉa Alpha-Beta (XQA-81).
 *
 * - Chỉ đi các nước trong `position.generateLegalMoves()` của xiangqi-core (AC1: không bao giờ chọn nước sai luật).
 * - Sắp xếp nước: nước ăn quân trước, ưu tiên ăn quân giá trị cao bằng quân giá trị thấp (MVV-LVA),
 *   giúp alpha-beta cắt nhiều nhánh hơn.
 * - Hết nước hợp lệ = bên tới lượt THUA (bị chiếu bí hoặc hết nước – Điều 7.1). Thua càng muộn càng tốt,
 *   thắng càng sớm càng tốt (điểm mate trừ theo độ sâu).
 * - Chưa xét lặp nước / Điều 23 trong cây tìm kiếm (RepetitionJudge chạy ở tầng GameService).
 * - Tùy chọn `quiescence` (XQA-100): ở nút lá tiếp tục xét các nước ĂN QUÂN tới khi thế cờ "yên", tránh hiệu ứng
 *   chân trời (ví dụ chấm Pháo ăn Mã là +400 mà không thấy bị Xe ăn lại). Mặc định tắt để giữ hành vi XQA-81.
 */

export interface SearchOptions {
  /** Độ sâu tìm kiếm tính theo nửa nước, ≥ 1. */
  depth: number;
  /** Dừng mở rộng nút mới khi vượt quá số ms này (trả nước tốt nhất đã tìm được). Mặc định: không giới hạn. */
  maxTimeMs?: number;
  /** Bật quiescence search ở nút lá (chỉ xét nước ăn quân, tối đa QUIESCENCE_MAX_PLY nửa nước). Mặc định: tắt. */
  quiescence?: boolean;
}

/** Giới hạn độ sâu chuỗi ăn quân trong quiescence, chặn bùng nổ thời gian ở thế nhiều quân treo. */
export const QUIESCENCE_MAX_PLY = 6;

export interface SearchResult {
  /** null khi bên tới lượt không còn nước hợp lệ (ván đã kết thúc). */
  move: Move | null;
  /** Điểm theo góc nhìn bên tới lượt. */
  score: number;
  /** Số nút đã duyệt (để đo hiệu năng). */
  nodes: number;
  /** true nếu bị dừng giữa chừng vì maxTimeMs. */
  timedOut: boolean;
}

const KING_ORDER_VALUE = 2000;

function orderValue(position: Position, move: Move): number {
  const victim = position.board[move.to];
  if (!victim) return 0;
  const attacker = position.board[move.from];
  const victimValue = victim.type === 'k' ? KING_ORDER_VALUE : PIECE_VALUES[victim.type];
  const attackerValue = !attacker || attacker.type === 'k' ? 0 : PIECE_VALUES[attacker.type];
  return 10 * victimValue - attackerValue;
}

/** Nước đi theo thứ tự nên thử: ăn quân giá trị cao bằng quân giá trị thấp trước. Ổn định với nước không ăn. */
export function orderMoves(position: Position, moves: Move[]): Move[] {
  return moves
    .map((move, index) => ({ move, index, score: orderValue(position, move) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.move);
}

class SearchTimeout extends Error {}

function checkDepth(depth: number): void {
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error(`Search depth must be an integer >= 1; received ${depth}`);
  }
}

/** Negamax + Alpha-Beta trên `pos` (bị áp/hoàn nước tại chỗ). Đếm nút vào `stats`, ném SearchTimeout khi quá hạn. */
function createNegamax(pos: Position, deadline: number, stats: { nodes: number }, quiescence = false) {
  /**
   * Quiescence: điểm "đứng yên" (stand-pat) = evaluate; bên tới lượt có thể chọn không ăn. Chỉ thử nước ăn quân
   * pseudo-legal rồi loại nước để Tướng mình bị chiếu (rẻ hơn generateLegalMoves vì chỉ kiểm nước ăn).
   * Không nhận ra chiếu bí trong quiescence: thế hết nước được chấm theo vật chất như nút lá cũ.
   */
  const qsearch = (qply: number, alpha: number, beta: number): number => {
    stats.nodes++;
    if ((stats.nodes & 1023) === 0 && Date.now() > deadline) throw new SearchTimeout();
    const standPat = evaluate(pos);
    if (qply >= QUIESCENCE_MAX_PLY || standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    const mover = pos.sideToMove;
    const captures = pos.generatePseudoLegalMoves().filter((m) => pos.board[m.to] !== null);
    for (const move of orderMoves(pos, captures)) {
      const undo = pos.applyMove(move);
      if (pos.isCheck(mover)) {
        pos.undoMove(undo); // nước tự chiếu / lộ mặt tướng: không hợp lệ
        continue;
      }
      const score = -qsearch(qply + 1, -beta, -alpha);
      pos.undoMove(undo);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const negamax = (remaining: number, ply: number, alpha: number, beta: number): number => {
    stats.nodes++;
    if ((stats.nodes & 1023) === 0 && Date.now() > deadline) throw new SearchTimeout();

    // Nút lá: không quiescence thì chỉ đánh giá, không sinh nước (sinh nước hợp lệ là phần tốn nhất). Hệ quả: thế
    // hết nước đúng ở nút lá được chấm theo vật chất; mọi thế hết nước ở độ sâu nhỏ hơn đều được nhận ra.
    if (remaining === 0) return quiescence ? qsearch(0, alpha, beta) : evaluate(pos);
    const moves = pos.generateLegalMoves();
    if (moves.length === 0) return -MATE_SCORE + ply;

    let best = -Infinity;
    for (const move of orderMoves(pos, moves)) {
      const undo = pos.applyMove(move);
      const score = -negamax(remaining - 1, ply + 1, -beta, -alpha);
      pos.undoMove(undo);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break; // cắt tỉa beta
    }
    return best;
  };
  return negamax;
}

export interface ScoredMove {
  move: Move;
  /** Điểm chính xác của nước này theo góc nhìn bên tới lượt ở gốc. */
  score: number;
}

export interface RootScores {
  /** Theo thứ tự đã duyệt (MVV-LVA). Rỗng khi bên tới lượt hết nước hợp lệ. */
  moves: ScoredMove[];
  nodes: number;
  /** true nếu quá maxTimeMs: chỉ các nước đã chấm xong nằm trong `moves` (luôn có ít nhất 1 nước nếu còn nước). */
  timedOut: boolean;
}

/**
 * Chấm điểm CHÍNH XÁC từng nước ở gốc (mỗi nước tìm với cửa sổ đầy đủ, alpha-beta chỉ dùng bên dưới).
 * Chậm hơn searchBestMove vì không cắt tỉa ở gốc; dùng cho mức Dễ / Trung bình cần so điểm các nước (XQA-100).
 */
export function scoreRootMoves(position: Position, options: SearchOptions): RootScores {
  checkDepth(options.depth);
  const pos = position.clone();
  const stats = { nodes: 1 };
  const rootMoves = orderMoves(pos, pos.generateLegalMoves());
  if (rootMoves.length === 0) return { moves: [], nodes: 1, timedOut: false };
  // Nước đầu luôn được chấm trọn (không áp hạn giờ) để luôn có ít nhất 1 nước trả về
  const deadline = options.maxTimeMs === undefined ? Infinity : Date.now() + options.maxTimeMs;
  const scored: ScoredMove[] = [];
  let timedOut = false;
  for (const [i, move] of rootMoves.entries()) {
    const negamax = createNegamax(pos, i === 0 ? Infinity : deadline, stats, options.quiescence);
    const undo = pos.applyMove(move);
    try {
      scored.push({ move, score: -negamax(options.depth - 1, 1, -Infinity, Infinity) });
    } catch (error) {
      if (!(error instanceof SearchTimeout)) throw error;
      timedOut = true; // pos đang dở dang ở nút sâu; là bản sao nên bỏ luôn
      break;
    }
    pos.undoMove(undo);
  }
  return { moves: scored, nodes: stats.nodes, timedOut };
}

export function searchBestMove(position: Position, options: SearchOptions): SearchResult {
  const depth = options.depth;
  checkDepth(depth);
  const deadline = options.maxTimeMs === undefined ? Infinity : Date.now() + options.maxTimeMs;
  const pos = position.clone(); // tìm kiếm trên bản sao, không làm đổi thế cờ của người gọi
  const stats = { nodes: 0 };
  const negamax = createNegamax(pos, deadline, stats, options.quiescence);

  const rootMoves = orderMoves(pos, pos.generateLegalMoves());
  if (rootMoves.length === 0) {
    return { move: null, score: -MATE_SCORE, nodes: 1, timedOut: false };
  }

  let bestMove = rootMoves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  let timedOut = false;
  try {
    for (const move of rootMoves) {
      const undo = pos.applyMove(move);
      const score = -negamax(depth - 1, 1, -beta, -alpha);
      pos.undoMove(undo);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) alpha = score;
    }
  } catch (error) {
    if (!(error instanceof SearchTimeout)) throw error;
    timedOut = true;
  }
  return { move: bestMove, score: bestScore === -Infinity ? 0 : bestScore, nodes: stats.nodes, timedOut };
}
