/**
 * XQA-81 – Minimax + Alpha-Beta. Story XQA-23.
 * AC1: chỉ trả nước trong legalMoves. AC2: độ sâu 3 trả nước trong ≤ 2 giây.
 * XQA-23 AC2: ở độ sâu 3, AI không bỏ qua nước ăn Xe miễn phí trong bộ thế cờ kiểm tra.
 */
import { evaluate, MATE_SCORE, Move, orderMoves, Position, searchBestMove } from '../src';
import { fenOf, randomPositions, uci } from './support/board-helpers';

describe('XQA-81 searchBestMove – Minimax + Alpha-Beta', () => {
  it('AC1: nước trả về luôn nằm trong generateLegalMoves (30 thế cờ ngẫu nhiên, độ sâu 2)', () => {
    for (const pos of randomPositions(30, 26, 99)) {
      const legal = new Set(pos.generateLegalMoves().map(uci));
      const { move } = searchBestMove(pos, { depth: 2 });
      expect(legal.has(uci(move))).toBe(true);
    }
  });

  it('không đổi thế cờ của người gọi', () => {
    const pos = Position.initial();
    const fen = pos.toFen();
    searchBestMove(pos, { depth: 2 });
    expect(pos.toFen()).toBe(fen);
  });

  it('AC2: độ sâu 3 từ thế khởi đầu trả nước trong ≤ 2 giây', () => {
    const t0 = Date.now();
    const result = searchBestMove(Position.initial(), { depth: 3 });
    const elapsed = Date.now() - t0;
    expect(result.move).not.toBeNull();
    expect(result.timedOut).toBe(false);
    expect(elapsed).toBeLessThanOrEqual(2000);
  });

  it('AC2: độ sâu 3 ở 5 thế giữa ván cũng ≤ 2 giây mỗi thế', () => {
    for (const pos of randomPositions(5, 20, 5)) {
      const t0 = Date.now();
      searchBestMove(pos, { depth: 3 });
      expect(Date.now() - t0).toBeLessThanOrEqual(2000);
    }
  });

  // Bộ thế cờ kiểm tra "ăn Xe miễn phí" (XQA-23 AC2): Xe bị ăn không có quân nào bảo vệ.
  it.each([
    ['Xe ăn Xe theo cột', fenOf({ e0: 'k', f9: 'K', a4: 'R', a1: 'r' }), 'a4a1'],
    ['Mã ăn Xe', fenOf({ e0: 'k', f9: 'K', c4: 'N', d2: 'r', a9: 'R' }), 'c4d2'],
    ['Pháo ăn Xe qua ngòi', fenOf({ e0: 'k', f9: 'K', a7: 'C', a4: 'p', a2: 'r' }), 'a7a2'],
    ['Đen ăn Xe Đỏ (bên Đen đi)', fenOf({ d0: 'k', e9: 'K', h3: 'r', h8: 'R', c9: 'N' }, 'b'), 'h3h8'],
  ])('XQA-23 AC2 – %s: độ sâu 3 chọn nước ăn Xe miễn phí', (_name, fen, expected) => {
    const { move, score } = searchBestMove(Position.fromFen(fen), { depth: 3 });
    expect(uci(move)).toBe(expected);
    // điểm sau tìm kiếm hơn điểm hiện tại ít nhất ~1 Xe (900, trừ sai số thưởng vị trí)
    expect(score - evaluate(Position.fromFen(fen))).toBeGreaterThanOrEqual(800);
  });

  it('XQA-23 AC2 – có nước chiếu thêm nhịp: AI có thể chiếu trước nhưng vẫn ăn được Xe (điểm ≥ 1 Xe)', () => {
    // Xe Đỏ i9 chiếu i0 ép Tướng lên e1, sau đó Pháo vẫn ăn Xe a2: hai đường đều hơn 1 Xe
    const fen = fenOf({ e0: 'k', f9: 'K', a7: 'C', a4: 'p', a2: 'r', i9: 'R' });
    const { move, score } = searchBestMove(Position.fromFen(fen), { depth: 3 });
    expect(['a7a2', 'i9i0']).toContain(uci(move));
    expect(score - evaluate(Position.fromFen(fen))).toBeGreaterThanOrEqual(800);
  });

  it('tránh mất quân: không lấy Xe ăn Tốt có Xe đối phương bảo vệ', () => {
    // Xe Đỏ a5 ăn được Tốt Đen a3, nhưng Xe Đen a0 ăn lại ngay (mất Xe 900 lấy Tốt 100)
    const fen = fenOf({ e0: 'k', f9: 'K', a5: 'R', a3: 'p', a0: 'r', i5: 'P' });
    const { move } = searchBestMove(Position.fromFen(fen), { depth: 3 });
    expect(uci(move)).not.toBe('a5a3');
  });

  it('tìm ra nước thắng ngay: sau nước của AI, bên kia hết nước (chiếu bí hoặc hết nước – Điều 7.1)', () => {
    // Xe a1 khóa hàng 1, Xe i5 xuống i0 chiếu bí; Xe a1→f1 cũng khóa hết đường Tướng (hết nước = thua)
    const pos = Position.fromFen(fenOf({ e0: 'k', d9: 'K', a1: 'R', i5: 'R' }));
    const { move, score } = searchBestMove(pos, { depth: 2 });
    expect(score).toBe(MATE_SCORE - 1);
    pos.applyMove(move as Move);
    expect(pos.generateLegalMoves()).toHaveLength(0);
  });

  it('bên tới lượt hết nước hợp lệ → move = null', () => {
    const mated = Position.fromFen(fenOf({ e0: 'k', d9: 'K', a1: 'R', i0: 'R' }, 'b'));
    expect(mated.generateLegalMoves()).toHaveLength(0);
    expect(searchBestMove(mated, { depth: 3 })).toMatchObject({ move: null, score: -MATE_SCORE });
  });

  it('maxTimeMs: dừng sớm, vẫn trả một nước hợp lệ và báo timedOut', () => {
    const pos = Position.initial();
    const t0 = Date.now();
    const result = searchBestMove(pos, { depth: 8, maxTimeMs: 50 });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(result.timedOut).toBe(true);
    expect(pos.generateLegalMoves().map(uci)).toContain(uci(result.move));
  });

  it('độ sâu không hợp lệ bị từ chối', () => {
    expect(() => searchBestMove(Position.initial(), { depth: 0 })).toThrow('depth');
  });

  it('orderMoves: nước ăn quân giá trị cao xếp trước', () => {
    const pos = Position.fromFen(fenOf({ e0: 'k', f9: 'K', a4: 'R', a1: 'r', b4: 'p' }));
    const ordered = orderMoves(pos, pos.generateLegalMoves()).map(uci);
    expect(ordered[0]).toBe('a4a1'); // ăn Xe trước ăn Tốt
    expect(ordered.indexOf('a4b4')).toBeLessThan(ordered.indexOf('a4a5'));
  });
});
