/**
 * XQA-78 – RepetitionJudge phần 1.
 * AC1: test các ca lặp đơn giản pass. AC2: API trả loại vi phạm.
 * XQA-95 – phần 2: đủ 10 điểm Điều 23 (xem block "phần 2" cuối file).
 * Căn cứ: luat_co_tuong_viet_nam.pdf – Điều 22, Điều 23 (Điểm 1–10), Điều 24, Điều 7.1g, 7.2b/c.
 * Các thế cờ dưới đây do nhóm tự dựng để kiểm từng điểm luật, KHÔNG phải hình minh họa trong tài liệu
 * (golden test theo hình Điều 24 thuộc XQA-79).
 */
import {
  algebraicToSquare,
  ChaseInfo,
  chaseCounts,
  coordToSquare,
  judgeCycle,
  Move,
  MoveRecord,
  Piece,
  pieceToChar,
  Position,
  RepetitionJudge,
} from '../src';

function mv(uci: string): Move {
  return { from: algebraicToSquare(uci.slice(0, 2)), to: algebraicToSquare(uci.slice(2, 4)) };
}

/** Dựng FEN từ danh sách quân, ví dụ { e0: 'k', d9: 'K', a1: 'R' } (hoa = Đỏ). */
function fenOf(pieces: Record<string, string>, side: 'r' | 'b' = 'r'): string {
  const board: (Piece | null)[] = Array(90).fill(null);
  for (const [sq, ch] of Object.entries(pieces)) {
    const color = ch === ch.toUpperCase() ? 'r' : 'b';
    board[algebraicToSquare(sq)] = { color, type: ch.toLowerCase() as Piece['type'] };
  }
  const rows: string[] = [];
  for (let row = 0; row < 10; row++) {
    let line = '';
    let empty = 0;
    for (let col = 0; col < 9; col++) {
      const p = board[coordToSquare(col, row)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) line += String(empty);
      empty = 0;
      line += pieceToChar(p);
    }
    if (empty) line += String(empty);
    rows.push(line);
  }
  return `${rows.join('/')} ${side} - - 0 1`;
}

function playAll(judge: RepetitionJudge, moves: string[]) {
  return moves.map((m) => judge.play(mv(m)));
}

// Thế 1 – CHIẾU MÃI: Xe Đỏ lắc a1↔a0 chiếu Tướng Đen, Tướng Đen chạy e0↔e1.
const PERPETUAL_CHECK = fenOf({ e0: 'k', d9: 'K', a1: 'R' });
const CHECK_CYCLE = ['a1a0', 'e0e1', 'a0a1', 'e1e0'];

// Thế 2 – ĐUỔI BẮT MÃI: Xe Đỏ h4↔h2 đuổi Mã Đen không căn chạy a2↔b4.
const PERPETUAL_CHASE = fenOf({ d0: 'k', e9: 'K', h4: 'R', a2: 'n' });
const CHASE_CYCLE = ['h4h2', 'a2b4', 'h2h4', 'b4a2'];

// Thế 3 – như thế 2 nhưng Mã Đen có căn thật: Xe Đen a7 giữ a2, Xe Đen b8 giữ b4.
const PROTECTED_CHASE = fenOf({ d0: 'k', e9: 'K', h4: 'R', a2: 'n', a7: 'r', b8: 'r' });

// Thế 4 – hai bên lắc quân vô hại (nước chờ), không chiếu không bắt.
const IDLE = fenOf({ e0: 'k', d9: 'K', a9: 'R', i0: 'r' });
const IDLE_CYCLE = ['a9a8', 'i0i1', 'a8a9', 'i1i0'];

describe('RepetitionJudge – theo dõi lịch sử và đếm lặp', () => {
  it('chưa tới ngưỡng thì chưa xử (result = null), đếm đúng số lần thế cờ xuất hiện', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHECK));
    const verdicts = playAll(judge, CHECK_CYCLE);
    expect(verdicts.map((v) => v.repetitionCount)).toEqual([1, 1, 1, 2]);
    expect(verdicts[3]).toMatchObject({ repeated: false, result: null, violations: [] });
  });

  it('thế cờ xuất hiện lần thứ 3 (ngưỡng mặc định = RuleProfile.repetitionThreshold) thì xử', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHECK));
    const verdicts = playAll(judge, [...CHECK_CYCLE, ...CHECK_CYCLE]);
    expect(verdicts.slice(0, 7).every((v) => v.result === null)).toBe(true);
    expect(verdicts[7]).toMatchObject({ repetitionCount: 3, threshold: 3, repeated: true });
  });

  it('ngưỡng cấu hình được (threshold = 2 → xử ngay lần lặp đầu)', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHECK), { threshold: 2 });
    const verdicts = playAll(judge, CHECK_CYCLE);
    expect(verdicts[3].repeated).toBe(true);
    expect(verdicts[3].result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('ngưỡng < 2 bị từ chối', () => {
    expect(() => new RepetitionJudge(Position.initial(), { threshold: 1 })).toThrow('threshold');
  });

  it('nước không hợp lệ bị từ chối, không làm hỏng lịch sử', () => {
    const judge = new RepetitionJudge(Position.initial());
    expect(() => judge.play(mv('a9a5'))).toThrow('Illegal move');
    expect(judge.history).toHaveLength(0);
    judge.play(mv('h7e7')); // Pháo đầu
    expect(judge.history).toHaveLength(1);
  });

  it('không lẫn với thế cờ cùng vị trí quân nhưng khác bên đi (hash có bit lượt đi)', () => {
    const judge = new RepetitionJudge(Position.fromFen(IDLE));
    // Đỏ lắc 2 nhịp, Đen lắc 1 nhịp: vị trí quân trùng nhưng lượt đi khác
    const v = playAll(judge, ['a9a8', 'i0i1', 'a8a9', 'i1i0', 'a9a8']);
    expect(v[4].repetitionCount).toBe(2); // trùng với thế sau nước 1, không phải thế ban đầu
  });
});

describe('RepetitionJudge – nhận diện nước chiếu / nước đuổi bắt (Điều 22)', () => {
  it('nước chiếu được đánh dấu kind = check', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHECK));
    judge.play(mv('a1a0'));
    judge.play(mv('e0e1'));
    const [check, escape] = judge.history;
    expect(check).toMatchObject({ side: 'r', isCheck: true, kind: 'check' });
    expect(escape).toMatchObject({ side: 'b', isCheck: false, kind: 'idle' });
  });

  it('nước tạo mối dọa bắt MỚI được đánh dấu chase, kèm quân đuổi / quân bị đuổi', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHASE));
    judge.play(mv('h4h2'));
    const [rec] = judge.history;
    expect(rec.kind).toBe('chase');
    expect(rec.chases).toEqual([
      expect.objectContaining<Partial<ChaseInfo>>({
        chaserType: 'r',
        targetType: 'n',
        targetSquare: algebraicToSquare('a2'),
        targetProtected: false,
        targetIsUncrossedPawn: false,
      }),
    ]);
  });

  it('dọa bắt đã có từ trước nước đi thì không tính là đuổi bắt mới', () => {
    // Xe Đỏ ở a4 đã dọa Mã a2 theo cột; đi a4→a3 vẫn dọa đúng quân đó → không phải "dọa bắt mới"
    const judge = new RepetitionJudge(Position.fromFen(fenOf({ d0: 'k', e9: 'K', a4: 'R', a2: 'n' })));
    judge.play(mv('a4a3'));
    expect(judge.history[0]).toMatchObject({ kind: 'idle', chases: [] });
  });

  it('quân bị đuổi có căn thật được đánh dấu targetProtected = true', () => {
    const judge = new RepetitionJudge(Position.fromFen(PROTECTED_CHASE));
    judge.play(mv('h4h2'));
    expect(judge.history[0].chases[0].targetProtected).toBe(true);
  });

  // Mã Đen e2 "giữ" c3. Tướng Đen e0, cột e chỉ có Mã e2 che. Xe Đỏ a4→c4 dọa Mã c3.
  it('căn giả: Mã giữ bị ghim (ăn lại sẽ lộ mặt tướng) → targetProtected = false', () => {
    const fen = fenOf({ e0: 'k', e9: 'K', e2: 'n', c3: 'n', a4: 'R' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    judge.play(mv('a4c4'));
    const onHorse = judge.history[0].chases.find((c) => c.targetSquare === algebraicToSquare('c3'));
    expect(onHorse).toBeDefined();
    expect(onHorse?.targetProtected).toBe(false);
  });

  it('cùng thế đó nhưng Tướng Đỏ ở d9 (Mã e2 không bị ghim) → căn thật, targetProtected = true', () => {
    const fen = fenOf({ e0: 'k', d9: 'K', e2: 'n', c3: 'n', a4: 'R' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    judge.play(mv('a4c4'));
    const onHorse = judge.history[0].chases.find((c) => c.targetSquare === algebraicToSquare('c3'));
    expect(onHorse?.targetProtected).toBe(true);
  });
});

describe('RepetitionJudge – xử theo Điều 23 (bàn cờ thật)', () => {
  it('Điểm 1: Đỏ chiếu mãi → Đỏ thua, API trả loại vi phạm perpetual_check', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHECK));
    const verdict = playAll(judge, [...CHECK_CYCLE, ...CHECK_CYCLE]).at(-1);
    expect(verdict?.violations).toEqual([
      { side: 'r', type: 'perpetual_check', rule: 'Điều 23 – Điểm 1' },
    ]);
    expect(verdict?.result).toEqual({
      kind: 'loss',
      loser: 'r',
      winner: 'b',
      rule: 'Điều 23 – Điểm 1',
    });
  });

  it('Điểm 3: một quân đuổi bắt mãi một quân không căn → bên đuổi thua (perpetual_chase)', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHASE));
    const verdict = playAll(judge, [...CHASE_CYCLE, ...CHASE_CYCLE]).at(-1);
    expect(verdict?.violations).toEqual([
      expect.objectContaining({
        side: 'r',
        type: 'perpetual_chase',
        rule: 'Điều 23 – Điểm 3',
        chase: expect.objectContaining({ chaserType: 'r', targetType: 'n' }),
      }),
    ]);
    expect(verdict?.result).toMatchObject({ kind: 'loss', loser: 'r', winner: 'b' });
  });

  it('Điểm 6: đuổi bắt mãi quân có căn thật → không phạm luật, lặp thì xử hòa', () => {
    const judge = new RepetitionJudge(Position.fromFen(PROTECTED_CHASE));
    const verdict = playAll(judge, [...CHASE_CYCLE, ...CHASE_CYCLE]).at(-1);
    expect(verdict?.violations).toEqual([]);
    expect(verdict?.result).toMatchObject({ kind: 'draw' });
  });

  it('Điều 24.2: hai bên đi nước chờ lặp lại, không ai phạm luật → hòa', () => {
    const judge = new RepetitionJudge(Position.fromFen(IDLE));
    const verdict = playAll(judge, [...IDLE_CYCLE, ...IDLE_CYCLE]).at(-1);
    expect(verdict?.result).toEqual({
      kind: 'draw',
      rule: 'Điều 24.2 / Điều 7.2b – hai bên không phạm luật, không đổi nước đi',
    });
  });

  it('một bên đổi nước đi sang thế cờ mới → đếm lặp bắt đầu lại từ 1', () => {
    const judge = new RepetitionJudge(Position.fromFen(PERPETUAL_CHASE));
    playAll(judge, CHASE_CYCLE); // lặp 1 lần
    const v = judge.play(mv('h4h2')); // dọa lại
    expect(v.repetitionCount).toBe(2);
    judge.play(mv('a2c1')); // Mã chạy chỗ khác
    const fresh = judge.play(mv('h2c2')); // Xe đi tiếp, thế cờ mới
    expect(fresh.repetitionCount).toBe(1);
  });
});

/* ---------- judgeCycle với bản ghi tổng hợp: các điểm luật khó dựng thế cờ ---------- */

function rec(
  side: 'r' | 'b',
  kind: MoveRecord['kind'],
  chases: Partial<ChaseInfo>[] = [],
): MoveRecord {
  return {
    ply: 0,
    side,
    move: { from: 0, to: 1 },
    piece: { color: side, type: 'r' },
    pieceId: 1,
    isCapture: false,
    isCheck: kind === 'check',
    chases: chases.map((c) => ({
      chaserId: 1,
      chaserType: 'r',
      targetId: 2,
      targetType: 'n',
      targetSquare: 10,
      targetIsUncrossedPawn: false,
      targetProtected: false,
      targetImmobile: false,
      isExchangeOffer: false,
      discovered: false,
      ...c,
    })),
    kind,
    hashAfter: '0000000000000000',
  };
}

describe('judgeCycle – các điểm của Điều 23', () => {
  const idle = (side: 'r' | 'b') => rec(side, 'idle');

  it('Điểm 2: một chiếu một bắt, hai bên không đổi nước → hòa', () => {
    const { result } = judgeCycle([rec('r', 'check'), idle('b'), rec('r', 'chase', [{}]), idle('b')]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('Điểm 3 ngoại lệ: đuổi bắt mãi Tốt chưa qua sông → được phép (hòa)', () => {
    const pawn = { targetType: 'p' as const, targetIsUncrossedPawn: true };
    const { violations, result } = judgeCycle([rec('r', 'chase', [pawn]), idle('b'), rec('r', 'chase', [pawn]), idle('b')]);
    expect(violations).toEqual([]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('Điểm 3: đuổi bắt mãi Tốt ĐÃ qua sông vẫn phạm luật', () => {
    const pawn = { targetType: 'p' as const, targetIsUncrossedPawn: false };
    const { result } = judgeCycle([rec('r', 'chase', [pawn]), idle('b'), rec('r', 'chase', [pawn]), idle('b')]);
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it.each([['k'], ['p']] as const)('Điểm 9: quân %s (Tướng/Tốt) bắt mãi → hòa', (chaserType) => {
    const c = { chaserType };
    const { violations, result } = judgeCycle([rec('b', 'chase', [c]), idle('r'), rec('b', 'chase', [c]), idle('r')]);
    expect(violations).toEqual([]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it.each([['n'], ['c']] as const)(
    'Điểm 6 câu 2: quân %s (Mã/Pháo) đuổi bắt mãi Xe có căn thật → vẫn thua',
    (chaserType) => {
      const c = { chaserType, targetType: 'r' as const, targetProtected: true };
      const { violations, result } = judgeCycle([rec('b', 'chase', [c]), idle('r'), rec('b', 'chase', [c]), idle('r')]);
      expect(violations[0]).toMatchObject({ side: 'b', type: 'perpetual_chase', rule: 'Điều 23 – Điểm 6 (Mã/Pháo bắt Xe)' });
      expect(result).toMatchObject({ kind: 'loss', loser: 'b', winner: 'r' });
    },
  );

  it('Điểm 6: Xe đuổi bắt mãi Xe có căn thật → hòa (ngoại lệ chỉ áp cho Mã/Pháo)', () => {
    const c = { chaserType: 'r' as const, targetType: 'r' as const, targetProtected: true };
    const { result } = judgeCycle([rec('b', 'chase', [c]), idle('r'), rec('b', 'chase', [c]), idle('r')]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('Điều 7.2c: hai bên cùng chiếu mãi / cùng bắt mãi → hòa', () => {
    const both = judgeCycle([rec('r', 'chase', [{}]), rec('b', 'chase', [{ chaserId: 5, targetId: 6 }])]);
    expect(both.violations.map((v) => v.side)).toEqual(['r', 'b']);
    expect(both.result).toMatchObject({ kind: 'draw', rule: 'Điều 7.2c – hai bên cùng phạm một điều luật cấm' });
  });

  it('Điểm 4 câu 1: một quân lần lượt đuổi bắt mãi 2 quân → hòa', () => {
    const { violations, result } = judgeCycle([
      rec('r', 'chase', [{ targetId: 2 }]),
      idle('b'),
      rec('r', 'chase', [{ targetId: 3 }]),
      idle('b'),
    ]);
    expect(violations).toEqual([]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('một bên chiếu mãi, bên kia bắt mãi → undetermined, chờ BR-REP-01 (luật không nói rõ)', () => {
    const { violations, result } = judgeCycle([rec('r', 'check'), rec('b', 'chase', [{}])]);
    expect(violations.map((v) => v.type)).toEqual(['perpetual_check', 'perpetual_chase']);
    expect(result).toMatchObject({ kind: 'undetermined' });
    expect(result.kind === 'undetermined' && result.reason).toContain('BR-REP-01');
  });
});

/* ---------------------------------- XQA-95: phần 2 ---------------------------------- */

describe('XQA-95 judgeCycle – các điểm phần 2', () => {
  const idle = (side: 'r' | 'b') => rec(side, 'idle');
  const chaseBy = (side: 'r' | 'b', ...cs: Partial<ChaseInfo>[]) => rec(side, 'chase', cs);

  it('Điểm 3 câu 2 (24.29, 24.16): hai quân thay nhau bắt mãi MỘT quân → thua, ghi đủ quân đuổi', () => {
    const { violations, result } = judgeCycle([
      chaseBy('r', { chaserId: 1, chaserType: 'r', targetId: 9 }),
      idle('b'),
      chaseBy('r', { chaserId: 7, chaserType: 'c', targetId: 9 }),
      idle('b'),
    ]);
    expect(violations[0]).toMatchObject({
      side: 'r',
      type: 'perpetual_chase',
      rule: 'Điều 23 – Điểm 3 câu 2 (nhiều quân bắt mãi một quân)',
      chaserIds: [1, 7],
    });
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('Điểm 4 câu 2 (24.28 hình 80): hai quân luân phiên bắt HAI quân → hòa', () => {
    const { violations, result } = judgeCycle([
      chaseBy('r', { chaserId: 1, targetId: 9 }),
      idle('b'),
      chaseBy('r', { chaserId: 7, targetId: 8 }),
      idle('b'),
    ]);
    expect(violations).toEqual([]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('Điểm 3 câu 2 + căn thật (24.31): nhiều quân bắt một quân có căn thật → hòa', () => {
    const { result } = judgeCycle([
      chaseBy('r', { chaserId: 1, targetId: 9, targetProtected: true }),
      idle('b'),
      chaseBy('r', { chaserId: 7, targetId: 9, targetProtected: true }),
      idle('b'),
    ]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('24.11 hình 24–25: hai Pháo bắt mãi Xe có căn → vẫn thua', () => {
    const rook = { targetId: 9, targetType: 'r' as const, targetProtected: true, chaserType: 'c' as const };
    const { result } = judgeCycle([
      chaseBy('r', { ...rook, chaserId: 1 }),
      idle('b'),
      chaseBy('r', { ...rook, chaserId: 7 }),
      idle('b'),
    ]);
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('Điểm 5 (24.17): hai bắt một bắt lại → bên hai bắt thua, bên bắt lại không phạm', () => {
    const { violations, result } = judgeCycle([
      chaseBy('r', { chaserId: 1, targetId: 9 }),
      chaseBy('b', { chaserId: 9, targetId: 1 }),
      chaseBy('r', { chaserId: 1, targetId: 9 }),
      idle('b'),
    ]);
    expect(violations.map((v) => v.side)).toEqual(['r']);
    expect(result).toMatchObject({ kind: 'loss', loser: 'r', rule: 'Điều 23 – Điểm 3' });
  });

  it('24.13 hình 31 / 24.23: một nước bắt quân có căn, một nước bắt quân không căn → không phạm (hòa)', () => {
    const { violations, result } = judgeCycle([
      chaseBy('r', { targetId: 9, targetProtected: true }),
      idle('b'),
      chaseBy('r', { targetId: 9, targetProtected: false }),
      idle('b'),
    ]);
    expect(violations).toEqual([]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('Điểm 7 câu 1 (24.15): quân có căn thật nhưng không đi được → vẫn bắt mãi, thua', () => {
    const pinned = { targetId: 9, targetProtected: true, targetImmobile: true };
    const { violations, result } = judgeCycle([chaseBy('r', pinned), idle('b'), chaseBy('r', pinned), idle('b')]);
    expect(violations[0].rule).toBe('Điều 23 – Điểm 7 (quân có căn nhưng không đi được)');
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('Điểm 7 câu 2 (24.20 hình 55): Mã đuổi mãi Mã bị cản (không ăn lại được) → thua', () => {
    const horse = { chaserType: 'n' as const, targetType: 'n' as const, isExchangeOffer: false };
    const { result } = judgeCycle([chaseBy('r', horse), idle('b'), chaseBy('r', horse), idle('b')]);
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('Điểm 10 / 24.20 / 24.36: đòi đổi mãi quân cùng loại (hai bên ăn được nhau) → hòa', () => {
    const swap = { chaserType: 'r' as const, targetType: 'r' as const, isExchangeOffer: true };
    const { violations, result } = judgeCycle([chaseBy('r', swap), idle('b'), chaseBy('r', swap), idle('b')]);
    expect(violations).toEqual([]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('Điểm 8 (24.32): một nước bắt thật + một nước vừa bắt vừa đòi đổi → vẫn bắt mãi, thua', () => {
    const { result } = judgeCycle([
      chaseBy('r', { targetId: 9, chaserType: 'r', targetType: 'r', isExchangeOffer: true }),
      idle('b'),
      chaseBy('r', { targetId: 9, chaserType: 'r', targetType: 'r', isExchangeOffer: false }),
      idle('b'),
    ]);
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('Điểm 9 câu 2 (24.25): Tốt phối hợp với MỘT Xe bắt mãi một quân → hòa', () => {
    const { result } = judgeCycle([
      chaseBy('r', { chaserId: 1, chaserType: 'p', targetId: 9 }),
      idle('b'),
      chaseBy('r', { chaserId: 7, chaserType: 'r', targetId: 9 }),
      idle('b'),
    ]);
    expect(result).toMatchObject({ kind: 'draw' });
  });

  it('24.26 hình 71–73: Tướng phối hợp với HAI Mã bắt mãi một quân → thua', () => {
    const { result } = judgeCycle([
      chaseBy('r', { chaserId: 1, chaserType: 'k', targetId: 9 }, { chaserId: 5, chaserType: 'n', targetId: 9 }),
      idle('b'),
      chaseBy('r', { chaserId: 1, chaserType: 'k', targetId: 9 }, { chaserId: 6, chaserType: 'n', targetId: 9 }),
      idle('b'),
    ]);
    expect(result).toMatchObject({ kind: 'loss', loser: 'r' });
  });

  it('Điểm 2: một chiếu một bắt (dù bắt cùng một quân) → hòa', () => {
    const { result } = judgeCycle([rec('r', 'check'), idle('b'), chaseBy('r', { targetId: 9 }), idle('b')]);
    expect(result).toMatchObject({ kind: 'draw' });
  });
});

describe('XQA-95 RepetitionJudge – bàn cờ thật', () => {
  it('24.13 hình 31: Xe bắt Mã khi có căn, khi không căn → không phạm luật, hòa', () => {
    // Như thế ĐUỔI BẮT MÃI nhưng chỉ ô a2 có Xe Đen a7 giữ; ô b4 không ai giữ
    const fen = fenOf({ d0: 'k', e9: 'K', h4: 'R', a2: 'n', a7: 'r' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    const verdicts = playAll(judge, [...CHASE_CYCLE, ...CHASE_CYCLE]);
    expect(judge.history[0].chases[0]).toMatchObject({ targetProtected: true });
    expect(judge.history[2].chases[0]).toMatchObject({ targetProtected: false });
    expect(verdicts.at(-1)?.result).toMatchObject({ kind: 'draw' });
  });

  it('Điểm 7: Mã Đen có Tượng giữ (căn thật) nhưng bị ghim lộ mặt tướng → targetImmobile, dọa bắt vẫn được tính', () => {
    // Cột e: Tướng Đỏ e9 … Mã Đen e2 … Tướng Đen e0 → Mã e2 không được rời cột. Tượng Đen c0 giữ e2.
    const fen = fenOf({ e0: 'k', c0: 'b', e2: 'n', i0: 'r', e9: 'K', h4: 'R' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    judge.play(mv('h4h2'));
    const onHorse = judge.history[0].chases.find((c) => c.targetSquare === algebraicToSquare('e2'));
    expect(onHorse).toMatchObject({ targetProtected: true, targetImmobile: true });
    expect(onHorse && chaseCounts(onHorse)).toBe(true);
  });

  it('đối chứng Điểm 7: cùng thế nhưng Tướng Đỏ d9 (Mã không bị ghim) → căn thật, không tính là nước bắt', () => {
    const fen = fenOf({ e0: 'k', c0: 'b', e2: 'n', i0: 'r', d9: 'K', h4: 'R' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    judge.play(mv('h4h2'));
    const onHorse = judge.history[0].chases.find((c) => c.targetSquare === algebraicToSquare('e2'));
    expect(onHorse).toMatchObject({ targetProtected: true, targetImmobile: false });
    expect(onHorse && chaseCounts(onHorse)).toBe(false);
  });

  it('Xe đổi Xe (24.20): Xe Đen ăn lại được Xe Đỏ → isExchangeOffer, đuổi mãi chỉ là đòi đổi → hòa', () => {
    const fen = fenOf({ e0: 'k', d9: 'K', h4: 'R', a2: 'r' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    const verdicts = playAll(judge, [...['h4h2', 'a2a4', 'h2h4', 'a4a2'], ...['h4h2', 'a2a4', 'h2h4', 'a4a2']]);
    expect(judge.history[0].chases[0]).toMatchObject({ chaserType: 'r', targetType: 'r', isExchangeOffer: true });
    expect(judge.history[2].chases[0]).toMatchObject({ isExchangeOffer: true });
    expect(verdicts.at(-1)?.violations).toEqual([]);
    expect(verdicts.at(-1)?.result).toMatchObject({ kind: 'draw' });
  });

  it('Mã đuổi Mã bị cản chân (Điểm 7 câu 2): Mã Đen không ăn lại được → isExchangeOffer = false', () => {
    // Mã Đỏ g5→e4 dọa Mã Đen d2 (chân e3 trống). Mã Đen d2 muốn ăn e4 phải qua chân d3 – bị Tốt Đen d3 cản.
    const blocked = new RepetitionJudge(Position.fromFen(fenOf({ e0: 'k', d9: 'K', g5: 'N', d2: 'n', d3: 'p' })));
    blocked.play(mv('g5e4'));
    const free = new RepetitionJudge(Position.fromFen(fenOf({ e0: 'k', d9: 'K', g5: 'N', d2: 'n' })));
    free.play(mv('g5e4'));
    const pick = (j: RepetitionJudge) => j.history[0].chases.find((c) => c.targetSquare === algebraicToSquare('d2'));
    expect(pick(blocked)).toMatchObject({ chaserType: 'n', targetType: 'n', isExchangeOffer: false });
    expect(pick(free)).toMatchObject({ isExchangeOffer: true });
  });

  it('mở đường (24.21): Tốt Đỏ về lại làm ngòi → Pháo Đỏ đứng yên được tính là quân đuổi (discovered)', () => {
    // Pháo Đỏ a9, Mã Đen a2. Tốt Đỏ (đã qua sông) b4 → a4 thành ngòi duy nhất giữa a9 và a2.
    const fen = fenOf({ e0: 'k', d9: 'K', a9: 'C', b4: 'P', a2: 'n' });
    const judge = new RepetitionJudge(Position.fromFen(fen));
    judge.play(mv('b4a4'));
    expect(judge.history[0].kind).toBe('chase');
    expect(judge.history[0].chases).toContainEqual(
      expect.objectContaining<Partial<ChaseInfo>>({
        chaserType: 'c',
        targetType: 'n',
        targetSquare: algebraicToSquare('a2'),
        discovered: true,
      }),
    );
  });

  it('thế cờ ván thường: lặp Mã 2 bên (giống e2e server) vẫn là hòa, không sinh dọa bắt giả', () => {
    const judge = new RepetitionJudge(Position.initial());
    const cycle = ['h9g7', 'h0g2', 'g7h9', 'g2h0'];
    const verdicts = playAll(judge, [...cycle, ...cycle]);
    expect(verdicts.at(-1)?.result).toMatchObject({ kind: 'draw' });
  });
});
