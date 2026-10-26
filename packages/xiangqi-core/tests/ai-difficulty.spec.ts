/**
 * XQA-100 – AI 3 mức độ khó + benchmark tự đấu. Story XQA-28.
 * AC1 (XQA-28): 3 mức có cấu hình độ sâu / thời gian khác nhau, mức Khó dùng Alpha-Beta.
 * AC2 (XQA-28): mức Khó thắng mức Dễ ≥ 70% trên 20 ván tự đấu → `pnpm --filter @xiangqi-arena/xiangqi-core bench:ai`
 *   (scripts/ai-benchmark.js, thoát mã lỗi nếu dưới ngưỡng). Kết quả: docs/engine/ai-difficulty-benchmark.md.
 *   Không chạy tự đấu trong Jest vì ts-jest chậm hơn node ~8 lần (4 ván ≈ 45 s).
 */
import {
  AI_LEVEL_ORDER,
  AI_LEVELS,
  AiLevel,
  chooseAiMove,
  createRng,
  evaluate,
  isAiLevel,
  Position,
  scoreRootMoves,
  searchBestMove,
} from '../src';
import { fenOf, randomPositions, uci } from './support/board-helpers';

describe('XQA-100 AI_LEVELS – cấu hình 3 mức', () => {
  it('AC1: độ sâu tăng dần, nhiễu giảm dần, thời gian tăng dần theo Dễ → Trung bình → Khó', () => {
    const [easy, medium, hard] = AI_LEVEL_ORDER.map((l) => AI_LEVELS[l]);
    expect(easy.depth).toBeLessThan(medium.depth);
    expect(medium.depth).toBeLessThan(hard.depth);
    expect(easy.noise).toBeGreaterThan(medium.noise);
    expect(medium.noise).toBeGreaterThan(hard.noise);
    expect(easy.maxTimeMs).toBeLessThan(medium.maxTimeMs);
    expect(medium.maxTimeMs).toBeLessThan(hard.maxTimeMs);
    expect(AI_LEVEL_ORDER.map((l) => AI_LEVELS[l].label)).toEqual(['Dễ', 'Trung bình', 'Khó']);
  });

  it('cấu hình không sửa được lúc chạy', () => {
    expect(Object.isFrozen(AI_LEVELS)).toBe(true);
    expect(Object.isFrozen(AI_LEVELS.HARD)).toBe(true);
  });

  it('isAiLevel chỉ nhận EASY | MEDIUM | HARD', () => {
    expect(AI_LEVEL_ORDER.every(isAiLevel)).toBe(true);
    expect(isAiLevel('easy')).toBe(false);
    expect(isAiLevel('INSANE')).toBe(false);
    expect(isAiLevel(3)).toBe(false);
    expect(() => chooseAiMove(Position.initial(), 'INSANE' as AiLevel)).toThrow('Unknown AI level');
  });
});

describe('XQA-100 chooseAiMove', () => {
  it.each(AI_LEVEL_ORDER)('%s: nước trả về luôn hợp lệ (10 thế cờ ngẫu nhiên)', (level) => {
    const rng = createRng(7);
    for (const pos of randomPositions(10, 24, 31)) {
      const legal = new Set(pos.generateLegalMoves().map(uci));
      const { move, level: used } = chooseAiMove(pos, level, { rng });
      expect(used).toBe(level);
      expect(legal.has(uci(move))).toBe(true);
    }
  });

  it.each(AI_LEVEL_ORDER)('%s: không đổi thế cờ của người gọi', (level) => {
    const pos = randomPositions(1, 16, 3)[0];
    const fen = pos.toFen();
    chooseAiMove(pos, level, { rng: createRng(1) });
    expect(pos.toFen()).toBe(fen);
  });

  it('AC1: mức Khó cho đúng nước của Alpha-Beta (searchBestMove + quiescence) ở độ sâu cấu hình', () => {
    for (const pos of randomPositions(5, 20, 11)) {
      const hard = chooseAiMove(pos, 'HARD');
      const ab = searchBestMove(pos, { depth: AI_LEVELS.HARD.depth, quiescence: true });
      expect(uci(hard.move)).toBe(uci(ab.move));
      expect(hard.score).toBe(ab.score);
    }
  });

  it('cùng seed → cùng nước (tái lập được để test/benchmark)', () => {
    const pos = Position.initial();
    const a = AI_LEVEL_ORDER.map((l) => uci(chooseAiMove(pos, l, { rng: createRng(42) }).move));
    const b = AI_LEVEL_ORDER.map((l) => uci(chooseAiMove(pos, l, { rng: createRng(42) }).move));
    expect(a).toEqual(b);
  });

  it('mức Dễ có biến hóa: 20 seed khác nhau cho ít nhất 4 nước khai cuộc khác nhau', () => {
    const pos = Position.initial();
    const moves = new Set(Array.from({ length: 20 }, (_, i) => uci(chooseAiMove(pos, 'EASY', { rng: createRng(i) }).move)));
    expect(moves.size).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ['Xe ăn Xe theo cột', fenOf({ e0: 'k', f9: 'K', a4: 'R', a1: 'r' }), 'a4a1'],
    ['Mã ăn Xe', fenOf({ e0: 'k', f9: 'K', c4: 'N', d2: 'r', a9: 'R' }), 'c4d2'],
    ['Pháo ăn Xe qua ngòi', fenOf({ e0: 'k', f9: 'K', a7: 'C', a4: 'p', a2: 'r' }), 'a7a2'],
    ['Đen ăn Xe Đỏ', fenOf({ d0: 'k', e9: 'K', h3: 'r', h8: 'R', c9: 'N' }, 'b'), 'h3h8'],
  ])('mọi mức (kể cả Dễ, nhiễu 150 < 900/2) không bỏ nước ăn Xe miễn phí – %s', (_name, fen, capture) => {
    const pos = Position.fromFen(fen);
    const before = evaluate(pos);
    for (const level of AI_LEVEL_ORDER) {
      for (let seed = 0; seed < 10; seed++) {
        const { move, score } = chooseAiMove(pos, level, { rng: createRng(seed) });
        // Nước chọn phải hơn ≥ ~1 Xe theo chính tìm kiếm của mức đó. Ở độ sâu ≥ 2 có thể là nước chiếu trước rồi
        // mới ăn Xe (cùng điểm), như ca "chiếu thêm nhịp" của XQA-81.
        expect(score - before).toBeGreaterThanOrEqual(800);
        if (AI_LEVELS[level].depth === 1) expect(uci(move)).toBe(capture);
      }
    }
  });

  it('bên tới lượt hết nước → move = null ở mọi mức', () => {
    const mated = Position.fromFen(fenOf({ e0: 'k', d9: 'K', a1: 'R', i0: 'R' }, 'b'));
    for (const level of AI_LEVEL_ORDER) expect(chooseAiMove(mated, level).move).toBeNull();
  });

  it('maxTimeMs ghi đè: vẫn trả nước hợp lệ khi giới hạn cực ngắn', () => {
    const pos = Position.initial();
    const legal = pos.generateLegalMoves().map(uci);
    for (const level of AI_LEVEL_ORDER) {
      const { move } = chooseAiMove(pos, level, { maxTimeMs: 1, rng: createRng(5) });
      expect(legal).toContain(uci(move));
    }
  });
});

describe('XQA-100 scoreRootMoves', () => {
  it('chấm đủ mọi nước hợp lệ, điểm cao nhất bằng điểm Alpha-Beta cùng độ sâu', () => {
    for (const pos of randomPositions(8, 18, 21)) {
      const { moves, timedOut } = scoreRootMoves(pos, { depth: 2 });
      expect(timedOut).toBe(false);
      expect(moves.map((m) => uci(m.move)).sort()).toEqual(pos.generateLegalMoves().map(uci).sort());
      expect(Math.max(...moves.map((m) => m.score))).toBe(searchBestMove(pos, { depth: 2 }).score);
    }
  });

  it('quiescence tránh hiệu ứng chân trời: thế khởi đầu, độ sâu 2, nước tốt nhất không phải Pháo ăn Mã', () => {
    // Không quiescence: mọi nước "êm" bị chấm ~−400 vì nút lá thấy Pháo đối phương ăn Mã mà không thấy ăn lại
    const plain = scoreRootMoves(Position.initial(), { depth: 2 }).moves;
    const quiet = scoreRootMoves(Position.initial(), { depth: 2, quiescence: true }).moves;
    const best = (ms: typeof plain) => ms.reduce((a, b) => (b.score > a.score ? b : a));
    expect(['b7b0', 'h7h0']).toContain(uci(best(plain).move));
    expect(['b7b0', 'h7h0']).not.toContain(uci(best(quiet).move));
    expect(Math.abs(best(quiet).score)).toBeLessThan(100);
  });

  it('độ sâu 1: điểm mỗi nước = −evaluate(thế cờ sau nước đó)', () => {
    const pos = randomPositions(1, 14, 8)[0];
    for (const { move, score } of scoreRootMoves(pos, { depth: 1 }).moves) {
      const next = pos.clone();
      next.applyMove(move);
      expect(score).toBe(-evaluate(next));
    }
  });

  it('quá giờ: vẫn trả ít nhất 1 nước và báo timedOut', () => {
    const r = scoreRootMoves(Position.initial(), { depth: 4, maxTimeMs: 1 });
    expect(r.moves.length).toBeGreaterThanOrEqual(1);
    expect(r.timedOut).toBe(true);
  });
});
