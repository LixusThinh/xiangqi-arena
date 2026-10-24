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
 * - Chưa xét lặp nước / Điều 23 trong cây tìm kiếm (để XQA-100 / RepetitionJudge).
 */

export interface SearchOptions {
  /** Độ sâu tìm kiếm tính theo nửa nước, ≥ 1. */
  depth: number;
  /** Dừng mở rộng nút mới khi vượt quá số ms này (trả nước tốt nhất đã tìm được). Mặc định: không giới hạn. */
  maxTimeMs?: number;
}

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

export function searchBestMove(position: Position, options: SearchOptions): SearchResult {
  const depth = options.depth;
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error(`Search depth must be an integer >= 1; received ${depth}`);
  }
  const deadline = options.maxTimeMs === undefined ? Infinity : Date.now() + options.maxTimeMs;
  const pos = position.clone(); // tìm kiếm trên bản sao, không làm đổi thế cờ của người gọi
  let nodes = 0;

  const negamax = (remaining: number, ply: number, alpha: number, beta: number): number => {
    nodes++;
    if ((nodes & 1023) === 0 && Date.now() > deadline) throw new SearchTimeout();

    // Nút lá: chỉ đánh giá, không sinh nước (sinh nước hợp lệ là phần tốn nhất). Hệ quả: thế hết nước
    // đúng ở nút lá được chấm theo vật chất; mọi thế hết nước ở độ sâu nhỏ hơn đều được nhận ra.
    if (remaining === 0) return evaluate(pos);
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
  return { move: bestMove, score: bestScore === -Infinity ? 0 : bestScore, nodes, timedOut };
}
