import type { Position } from '../position';
import { searchBestMove, SearchResult } from './search';

/**
 * 3 mức độ khó khi chơi với máy (XQA-100, story XQA-28).
 *
 * Cả 3 mức dùng cùng một bộ tìm kiếm Minimax + Alpha-Beta (search.ts); khác nhau ở 3 núm vặn:
 * - `depth`    : nhìn trước bao nhiêu nửa nước. Núm chính, quyết định sức mạnh.
 * - `maxTimeMs`: trần thời gian cho một nước, hết giờ trả nước tốt nhất đã tìm (chặn máy yếu bị treo).
 * - `noise`    : nhiễu cộng vào điểm từng nước ở gốc (đơn vị: Tốt chưa qua sông = 100). Mức thấp cố ý "lơ đễnh":
 *                bỏ lỡ nước hơn vài chục điểm, nhưng vẫn ăn được quân miễn phí và không tự dâng quân lớn.
 *
 * Giá trị dưới đây là cấu hình khởi điểm do nhóm chọn, đã kiểm bằng benchmark tự đấu (docs/engine/ai-levels.md);
 * KHÔNG có nguồn ngoài. Muốn đổi độ khó thì sửa ở đây rồi chạy lại benchmark.
 */
export type AiLevel = 'easy' | 'medium' | 'hard';

export interface AiLevelConfig {
  /** Độ sâu tìm kiếm tính theo nửa nước. */
  readonly depth: number;
  /** Trần thời gian cho một nước (ms). */
  readonly maxTimeMs: number;
  /** Nhiễu ở gốc, xem SearchOptions.noise. 0 = không nhiễu. */
  readonly noise: number;
}

export const AI_LEVELS: Readonly<Record<AiLevel, AiLevelConfig>> = {
  easy: { depth: 1, maxTimeMs: 300, noise: 150 },
  medium: { depth: 2, maxTimeMs: 1000, noise: 40 },
  hard: { depth: 3, maxTimeMs: 2000, noise: 0 },
};

export const AI_LEVEL_NAMES: readonly AiLevel[] = ['easy', 'medium', 'hard'];

export function isAiLevel(value: unknown): value is AiLevel {
  return typeof value === 'string' && (AI_LEVEL_NAMES as readonly string[]).includes(value);
}

/**
 * Chọn nước đi cho máy ở mức `level`. Không đổi `position`. `rng` (tùy chọn) là nguồn ngẫu nhiên cho nhiễu;
 * truyền hàm có seed để lặp lại được kết quả, mặc định Math.random.
 */
export function chooseAiMove(
  position: Position,
  level: AiLevel,
  rng?: () => number,
): SearchResult {
  const config = AI_LEVELS[level];
  if (!config) {
    throw new Error(`Unknown AI level "${String(level)}"; expected one of ${AI_LEVEL_NAMES.join(', ')}`);
  }
  return searchBestMove(position, {
    depth: config.depth,
    maxTimeMs: config.maxTimeMs,
    noise: config.noise,
    rng,
  });
}
