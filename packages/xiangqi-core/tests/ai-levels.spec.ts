/**
 * XQA-100 – 3 mức độ khó + benchmark tự đấu. Sub-task của story XQA-28.
 * AC1 (XQA-100): Khó thắng Dễ ≥ 70% trên 20 ván (đo bằng scripts/ai-benchmark.js; test dưới đây giữ bản rút gọn 10 ván).
 * AC2: kết quả benchmark đính kèm (docs/engine/ai-levels-benchmark.md).
 * AC1 (XQA-28): 3 mức có cấu hình độ sâu/thời gian khác nhau, mức Khó dùng Alpha-Beta.
 */
import {
  AI_LEVEL_NAMES,
  AI_LEVELS,
  chooseAiMove,
  MATE_SCORE,
  mulberry32,
  playSelfPlayGame,
  Position,
  searchBestMove,
  isAiLevel,
} from '../src';
import { fenOf, randomPositions, uci } from './support/board-helpers';

describe('XQA-100 cấu hình 3 mức độ khó', () => {
  it('có đúng 3 mức; độ sâu tăng dần và nhiễu giảm dần từ Dễ → Khó (AC1 XQA-28)', () => {
    expect(AI_LEVEL_NAMES).toEqual(['easy', 'medium', 'hard']);
    const { easy, medium, hard } = AI_LEVELS;
    expect(easy.depth).toBeLessThan(medium.depth);
    expect(medium.depth).toBeLessThan(hard.depth);
    expect(easy.noise).toBeGreaterThan(medium.noise);
    expect(medium.noise).toBeGreaterThan(hard.noise);
    expect(easy.maxTimeMs).toBeLessThanOrEqual(medium.maxTimeMs);
    expect(medium.maxTimeMs).toBeLessThanOrEqual(hard.maxTimeMs);
  });

  it('mức Khó không nhiễu, tìm kiếm Alpha-Beta thuần (tất định); trần thời gian ≤ 2 giây như AC2 của XQA-81', () => {
    expect(AI_LEVELS.hard.noise).toBe(0);
    expect(AI_LEVELS.hard.maxTimeMs).toBeLessThanOrEqual(2000);
  });

  it('isAiLevel nhận đúng 3 tên, từ chối giá trị lạ', () => {
    expect(AI_LEVEL_NAMES.every(isAiLevel)).toBe(true);
    for (const bad of ['expert', '', 'HARD', null, undefined, 3]) expect(isAiLevel(bad)).toBe(false);
  });

  it('chooseAiMove ném lỗi rõ ràng với mức không tồn tại', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => chooseAiMove(Position.initial(), 'expert' as any)).toThrow('Unknown AI level');
  });
});

describe('XQA-100 chooseAiMove', () => {
  it.each(AI_LEVEL_NAMES)('mức %s: luôn trả nước hợp lệ (8 thế cờ giữa ván ngẫu nhiên)', (level) => {
    const rng = mulberry32(11);
    for (const pos of randomPositions(8, 20, 5)) {
      const legal = new Set(pos.generateLegalMoves().map(uci));
      const { move } = chooseAiMove(pos, level, rng);
      expect(legal.has(uci(move))).toBe(true);
    }
  });

  it.each(AI_LEVEL_NAMES)('mức %s: không đổi thế cờ của người gọi', (level) => {
    const pos = Position.initial();
    const fen = pos.toFen();
    chooseAiMove(pos, level, mulberry32(3));
    expect(pos.toFen()).toBe(fen);
  });

  it.each(AI_LEVEL_NAMES)('mức %s: trả nước trong trần thời gian + sai số từ thế khởi đầu', (level) => {
    const t0 = Date.now();
    chooseAiMove(Position.initial(), level, mulberry32(3));
    expect(Date.now() - t0).toBeLessThanOrEqual(AI_LEVELS[level].maxTimeMs + 500);
  });

  it('cùng seed → cùng nước; mức Khó tất định, không phụ thuộc rng', () => {
    const pos = randomPositions(1, 16, 42)[0];
    for (const level of ['easy', 'medium'] as const) {
      expect(uci(chooseAiMove(pos, level, mulberry32(9)).move)).toBe(uci(chooseAiMove(pos, level, mulberry32(9)).move));
    }
    const hardA = chooseAiMove(pos, 'hard', mulberry32(1));
    const hardB = chooseAiMove(pos, 'hard', mulberry32(2));
    expect(uci(hardA.move)).toBe(uci(hardB.move));
    expect(hardA.score).toBe(hardB.score);
  });

  it('mức Khó = searchBestMove độ sâu 3 không nhiễu (cùng nước, cùng điểm)', () => {
    const pos = randomPositions(1, 18, 77)[0];
    const direct = searchBestMove(pos, { depth: AI_LEVELS.hard.depth });
    const viaLevel = chooseAiMove(pos, 'hard');
    expect(uci(viaLevel.move)).toBe(uci(direct.move));
    expect(viaLevel.score).toBe(direct.score);
  });

  it('mức Dễ thật sự "lơ đễnh": thế yên tĩnh (không có nước ăn), các seed khác nhau chọn nhiều nước khác nhau', () => {
    // Từ thế khởi đầu không dùng được: Pháo Đỏ ăn được Mã Đen (+400) lớn hơn nhiễu nên Dễ luôn "tham ăn" nước đó.
    const quiet = Position.fromFen(fenOf({ e0: 'k', f9: 'K', a5: 'R', i4: 'r' }));
    expect(quiet.generateLegalMoves().some((m) => quiet.board[m.to])).toBe(false);
    const easy = new Set<string | null>();
    const hard = new Set<string | null>();
    for (let seed = 1; seed <= 40; seed++) {
      easy.add(uci(chooseAiMove(quiet, 'easy', mulberry32(seed)).move));
      hard.add(uci(chooseAiMove(quiet, 'hard', mulberry32(seed)).move));
    }
    expect(easy.size).toBeGreaterThanOrEqual(5);
    expect(hard.size).toBe(1);
  });

  it('mức Dễ tham ăn: từ thế khởi đầu luôn chọn nước ăn Mã bằng Pháo (b7b0 hoặc h7h0) vì +400 lớn hơn nhiễu 150', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(['b7b0', 'h7h0']).toContain(uci(chooseAiMove(Position.initial(), 'easy', mulberry32(seed)).move));
    }
  });

  // Nhiễu làm yếu AI nhưng không được làm nó bỏ qua quân miễn phí hay nước thắng ngay.
  it.each(AI_LEVEL_NAMES)('mức %s: vẫn ăn Xe miễn phí (Xe ăn Xe theo cột) với 25 seed khác nhau', (level) => {
    const pos = Position.fromFen(fenOf({ e0: 'k', f9: 'K', a4: 'R', a1: 'r' }));
    for (let seed = 1; seed <= 25; seed++) {
      expect(uci(chooseAiMove(pos, level, mulberry32(seed)).move)).toBe('a4a1');
    }
  });

  it('nhiễu lớn cũng không che được nước chiếu bí thấy được (điểm mate lớn hơn mọi nhiễu)', () => {
    const pos = Position.fromFen(fenOf({ e0: 'k', d9: 'K', a1: 'R', i5: 'R' }));
    for (let seed = 1; seed <= 20; seed++) {
      const { move, score } = searchBestMove(pos, { depth: 2, noise: 500, rng: mulberry32(seed) });
      expect(score).toBe(MATE_SCORE - 1);
      const after = pos.clone();
      after.applyMove(move as NonNullable<typeof move>);
      expect(after.generateLegalMoves()).toHaveLength(0);
    }
  });
});

describe('XQA-100 searchBestMove – tùy chọn noise', () => {
  it('nhiễu cực nhỏ vẫn cho đúng điểm minimax như Alpha-Beta thuần (đường cửa sổ đầy đủ không sai điểm)', () => {
    for (const pos of randomPositions(10, 18, 31)) {
      const pure = searchBestMove(pos, { depth: 2 });
      const noisy = searchBestMove(pos, { depth: 2, noise: 1e-9, rng: mulberry32(5) });
      expect(noisy.score).toBe(pure.score);
    }
  });

  it('điểm trả về là điểm thật của nước được chọn, không cộng nhiễu', () => {
    // Điểm thật luôn là số nguyên (tổng giá trị quân); nhiễu 150 với rng bất kỳ gần như chắc chắn sinh số lẻ.
    for (const pos of randomPositions(6, 20, 8)) {
      const { score } = searchBestMove(pos, { depth: 1, noise: 150, rng: mulberry32(2) });
      expect(Number.isInteger(score)).toBe(true);
    }
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('noise = %p bị từ chối', (noise) => {
    expect(() => searchBestMove(Position.initial(), { depth: 1, noise })).toThrow('noise');
  });
});

describe('XQA-100 tự đấu', () => {
  it('mulberry32: cùng seed cùng dãy, mọi giá trị trong [0, 1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('chạm trần maxPlies thì hòa; số nước AI = số nửa nước − khai cuộc', () => {
    const result = playSelfPlayGame({ red: 'easy', black: 'easy', seed: 4, maxPlies: 16, openingPlies: 4 });
    expect(result).toMatchObject({ winner: null, reason: 'max_plies', plies: 16 });
    expect(result.aiMoves.r + result.aiMoves.b).toBe(12);
  });

  it('cùng seed + cùng cấu hình → cùng ván', () => {
    const run = () => playSelfPlayGame({ red: 'hard', black: 'medium', seed: 3, maxPlies: 24 });
    const a = run();
    const b = run();
    expect([a.winner, a.reason, a.plies]).toEqual([b.winner, b.reason, b.plies]);
  });

  it('ván kết thúc có lý do hợp lệ và người thắng khớp với lý do', () => {
    const result = playSelfPlayGame({ red: 'hard', black: 'easy', seed: 2026 });
    expect(['checkmate', 'no_moves', 'repetition', 'max_plies']).toContain(result.reason);
    if (result.reason === 'checkmate' || result.reason === 'no_moves') expect(result.winner).not.toBeNull();
    if (result.reason === 'max_plies') expect(result.winner).toBeNull();
  });

  // Lưới chặn hồi quy: chạy 10 ván đầu của benchmark (cùng seed gốc 2026, chia đều màu, cùng cách ghép seed với
  // scripts/ai-benchmark.js) để ai chỉnh AI_LEVELS làm Khó mất ưu thế thì CI báo ngay.
  // Đây KHÔNG phải bằng chứng AC đủ 20 ván (jest trong CI chậm hơn nhiều so với chạy script): bằng chứng AC là
  // báo cáo docs/engine/ai-levels-benchmark.md do `pnpm --filter @xiangqi-arena/xiangqi-core ai:benchmark` sinh ra.
  it('hồi quy: Khó thắng Dễ ≥ 70% trên 10 ván tự đấu đầu của benchmark (chia đều màu, seed cố định)', () => {
    const games = 10;
    let hardWins = 0;
    for (let g = 0; g < games; g++) {
      const hardIsRed = g % 2 === 0;
      const result = playSelfPlayGame({
        red: hardIsRed ? 'hard' : 'easy',
        black: hardIsRed ? 'easy' : 'hard',
        seed: 2026 + Math.floor(g / 2),
      });
      if (result.winner === (hardIsRed ? 'r' : 'b')) hardWins++;
    }
    expect(hardWins / games).toBeGreaterThanOrEqual(0.7);
  }, 120_000);
});
