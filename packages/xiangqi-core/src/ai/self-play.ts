import { Position } from '../position';
import { DEFAULT_REPETITION_THRESHOLD, RepetitionJudge } from '../rules/repetition';
import type { Color, Move } from '../types';
import { AiLevel, chooseAiMove } from './levels';

/**
 * Tự đấu AI với AI để đo độ khó (XQA-100). Chạy được từ script `scripts/ai-benchmark.js` và test.
 *
 * Kết thúc ván theo cùng thứ tự với GameService: hết nước hợp lệ (chiếu bí / hết nước – Điều 7.1) trước,
 * rồi phán quyết RepetitionJudge (Điều 23). Hai điều thêm CHỈ dành cho benchmark, KHÔNG phải luật cờ:
 * - khai cuộc ngẫu nhiên vài nước đầu để các ván không giống nhau,
 * - trần `maxPlies`, chạm trần thì tính hòa (tránh ván lê thê vô hạn khi cả hai bên đều không phạm lặp nước).
 */

/** PRNG nhỏ có seed (mulberry32): cùng seed cho cùng dãy số, đủ tốt cho benchmark, không dùng cho bảo mật. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SelfPlayEnd = 'checkmate' | 'no_moves' | 'repetition' | 'max_plies';

export interface SelfPlayOptions {
  /** Mức độ của bên Đỏ (đi trước). */
  red: AiLevel;
  /** Mức độ của bên Đen. */
  black: AiLevel;
  /** Seed cho khai cuộc ngẫu nhiên và nhiễu của AI. Cùng seed + cùng cấu hình → cùng ván. */
  seed: number;
  /** Số nửa nước khai cuộc đi ngẫu nhiên (cả hai bên). Mặc định 4. */
  openingPlies?: number;
  /** Trần số nửa nước; chạm trần = hòa. Mặc định 240. */
  maxPlies?: number;
  /** Ngưỡng lặp thế cờ của RepetitionJudge. Mặc định như RuleProfile trong seed (3). */
  repetitionThreshold?: number;
}

export interface SelfPlayResult {
  /** null = hòa. */
  winner: Color | null;
  reason: SelfPlayEnd;
  plies: number;
  /** Số nước AI đã tính (không tính khai cuộc ngẫu nhiên) và tổng thời gian nghĩ, theo từng bên. */
  aiMoves: Record<Color, number>;
  thinkMs: Record<Color, number>;
  /** Số lần AI bị cắt giờ (maxTimeMs) giữa chừng, theo từng bên. */
  timeouts: Record<Color, number>;
}

export function playSelfPlayGame(options: SelfPlayOptions): SelfPlayResult {
  const openingPlies = options.openingPlies ?? 4;
  const maxPlies = options.maxPlies ?? 240;
  const levels: Record<Color, AiLevel> = { r: options.red, b: options.black };
  const position = Position.initial();
  const judge = new RepetitionJudge(position, {
    threshold: options.repetitionThreshold ?? DEFAULT_REPETITION_THRESHOLD,
  });
  const openingRng = mulberry32(options.seed);
  const aiRng = mulberry32((options.seed ^ 0x9e3779b9) >>> 0);
  const stats = {
    aiMoves: { r: 0, b: 0 } as Record<Color, number>,
    thinkMs: { r: 0, b: 0 } as Record<Color, number>,
    timeouts: { r: 0, b: 0 } as Record<Color, number>,
  };

  for (let plies = 0; ; ) {
    if (plies >= maxPlies) return { winner: null, reason: 'max_plies', plies, ...stats };

    const side = position.sideToMove;
    let move: Move;
    if (plies < openingPlies) {
      const legal = position.generateLegalMoves();
      move = legal[Math.floor(openingRng() * legal.length)];
    } else {
      const startedAt = Date.now();
      const found = chooseAiMove(position, levels[side], aiRng);
      stats.thinkMs[side] += Date.now() - startedAt;
      stats.aiMoves[side]++;
      if (found.timedOut) stats.timeouts[side]++;
      move = found.move as Move;
    }

    const verdict = judge.play(move);
    position.applyMove(move);
    plies++;

    const status = position.getGameStatus();
    if (status.result) {
      return { winner: status.result.winner, reason: status.result.reason, plies, ...stats };
    }
    const repetition = verdict.result;
    if (repetition && repetition.kind !== 'undetermined') {
      return {
        winner: repetition.kind === 'loss' ? repetition.winner : null,
        reason: 'repetition',
        plies,
        ...stats,
      };
    }
  }
}
