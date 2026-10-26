import type { Position } from '../position';
import { Move } from '../types';
import { scoreRootMoves, searchBestMove } from './search';

/**
 * 3 mức độ khó khi chơi với máy (XQA-100, Story XQA-28, Epic XQA-7).
 *
 * Cùng một engine (Minimax + Alpha-Beta, XQA-81). Mức khác nhau ở 2 núm:
 * - `depth`: số nửa nước nhìn trước.
 * - `noise`: biên độ nhiễu (điểm, cùng thang với evaluate: Xe = 900). Mỗi nước ở gốc được cộng một số ngẫu nhiên
 *   đều trong [-noise, +noise] rồi chọn nước có tổng cao nhất. Nhiễu làm máy "nhìn nhầm" các nước chênh nhau ít
 *   (vị trí, đổi quân nhỏ) nhưng không bỏ được chênh lệch lớn hơn 2 × noise.
 *   Dễ: noise 150 → vẫn không bỏ nước ăn Xe miễn phí (900 > 300), nhưng có thể bỏ ăn Tốt, Sĩ, Tượng.
 *
 * Mức Khó không nhiễu và dùng searchBestMove (Alpha-Beta cắt tỉa cả ở gốc) → AC1 của XQA-28.
 * Mọi mức chỉ chọn trong generateLegalMoves() → không bao giờ đi nước sai luật.
 */
export type AiLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface AiLevelConfig {
  /** Tên hiển thị cho FE (XQA-101). */
  label: string;
  depth: number;
  noise: number;
  /** Giới hạn thời gian tìm kiếm mỗi nước (ms). */
  maxTimeMs: number;
}

export const AI_LEVELS: Readonly<Record<AiLevel, Readonly<AiLevelConfig>>> = Object.freeze({
  EASY: Object.freeze({ label: 'Dễ', depth: 1, noise: 150, maxTimeMs: 500 }),
  MEDIUM: Object.freeze({ label: 'Trung bình', depth: 2, noise: 40, maxTimeMs: 1000 }),
  HARD: Object.freeze({ label: 'Khó', depth: 3, noise: 0, maxTimeMs: 2000 }),
});

export const AI_LEVEL_ORDER: readonly AiLevel[] = ['EASY', 'MEDIUM', 'HARD'];

export function isAiLevel(value: unknown): value is AiLevel {
  return typeof value === 'string' && (AI_LEVEL_ORDER as readonly string[]).includes(value);
}

/** Bộ sinh số ngẫu nhiên [0, 1) có seed (mulberry32) để test và benchmark tái lập được. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChooseMoveOptions {
  /** Nguồn ngẫu nhiên [0, 1). Mặc định Math.random. Truyền createRng(seed) để kết quả tái lập được. */
  rng?: () => number;
  /** Ghi đè maxTimeMs của mức (ví dụ khi chạy trong Web Worker trên máy yếu). */
  maxTimeMs?: number;
}

export interface AiMoveResult {
  /** null khi bên tới lượt hết nước hợp lệ (ván đã kết thúc). */
  move: Move | null;
  level: AiLevel;
  /** Điểm engine (chưa cộng nhiễu) của nước được chọn, theo góc nhìn bên tới lượt. */
  score: number;
  nodes: number;
  timedOut: boolean;
}

/** Chọn nước cho máy theo mức độ khó. Không làm đổi thế cờ của người gọi. */
export function chooseAiMove(position: Position, level: AiLevel, options: ChooseMoveOptions = {}): AiMoveResult {
  if (!isAiLevel(level)) throw new Error(`Unknown AI level: ${String(level)}`);
  const config = AI_LEVELS[level];
  const maxTimeMs = options.maxTimeMs ?? config.maxTimeMs;

  if (config.noise === 0) {
    const r = searchBestMove(position, { depth: config.depth, maxTimeMs, quiescence: true });
    return { move: r.move, level, score: r.score, nodes: r.nodes, timedOut: r.timedOut };
  }

  const rng = options.rng ?? Math.random;
  const scored = scoreRootMoves(position, { depth: config.depth, maxTimeMs, quiescence: true });
  if (scored.moves.length === 0) {
    return { move: null, level, score: 0, nodes: scored.nodes, timedOut: scored.timedOut };
  }
  let best = scored.moves[0];
  let bestNoisy = -Infinity;
  for (const candidate of scored.moves) {
    const noisy = candidate.score + (rng() * 2 - 1) * config.noise;
    if (noisy > bestNoisy) {
      bestNoisy = noisy;
      best = candidate;
    }
  }
  return { move: best.move, level, score: best.score, nodes: scored.nodes, timedOut: scored.timedOut };
}
