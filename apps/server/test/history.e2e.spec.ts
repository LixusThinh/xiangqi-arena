/**
 * XQA-97 e2e: History API (Story XQA-27, FR-17). Contract: docs/api/history.md.
 * AC: chỉ xem được lịch sử của chính mình; có phân trang; có đối thủ, kết quả, số nước, thời điểm, thời lượng.
 */
import * as request from 'supertest';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

const STARTING_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1';

describe('XQA-97 History API (e2e)', () => {
  let t: TestApp;
  let alice: bigint;
  let bob: bigint;
  let carol: bigint;
  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;
  let roomSeq = 0;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Thêm thẳng một ván đã kết thúc vào DB giả (không đi qua GameService để test nhanh, xác định). */
  async function seedFinished(opts: {
    red: bigint;
    black: bigint;
    result: 'RED_WIN' | 'BLACK_WIN' | 'DRAW';
    endReason?: string;
    startedAt?: Date;
    endedAt: Date;
    ply?: number;
    status?: 'FINISHED' | 'ACTIVE';
    ruleProfileId?: number;
  }): Promise<bigint> {
    roomSeq += 1;
    const room = await t.prisma.room.create({
      data: {
        roomCode: `HIST${String(roomSeq).padStart(4, '0')}`,
        name: `Phòng ${roomSeq}`,
        hostId: opts.red,
        ruleProfileId: opts.ruleProfileId ?? 1,
        status: opts.status === 'ACTIVE' ? 'PLAYING' : 'FINISHED',
      },
    });
    const match = await t.prisma.match.create({
      data: {
        roomId: room.id,
        redPlayerId: opts.red,
        blackPlayerId: opts.black,
        ruleProfileId: opts.ruleProfileId ?? 1,
        status: opts.status ?? 'FINISHED',
        result: opts.status === 'ACTIVE' ? null : opts.result,
        endReason: opts.status === 'ACTIVE' ? null : (opts.endReason ?? 'CHECKMATE'),
        currentPly: opts.ply ?? 0,
        currentFen: STARTING_FEN,
        startedAt: opts.startedAt ?? new Date(opts.endedAt.getTime() - 5 * 60_000),
        endedAt: opts.status === 'ACTIVE' ? null : opts.endedAt,
      },
    });
    return match.id as bigint;
  }

  beforeEach(async () => {
    roomSeq = 0;
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
    alice = (await seedUser(t.prisma, { username: 'alice', displayName: 'Alice' })).id;
    bob = (await seedUser(t.prisma, { username: 'bob', displayName: 'Bob' })).id;
    carol = (await seedUser(t.prisma, { username: 'carol', displayName: 'Carol' })).id;
    aliceToken = await loginAs(t.server, 'alice');
    bobToken = await loginAs(t.server, 'bob');
    carolToken = await loginAs(t.server, 'carol');
  });

  afterEach(async () => {
    await t.close();
  });

  describe('GET /me/matches', () => {
    it('chưa đăng nhập → 401', async () => {
      await request(t.server).get('/me/matches').expect(401);
    });

    it('chưa chơi ván nào → danh sách rỗng', async () => {
      const res = await request(t.server).get('/me/matches').set(auth(aliceToken)).expect(200);
      expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });

    it('FR-17: hiện đối thủ, kết quả theo góc nhìn người xem, số nước, thời điểm, thời lượng', async () => {
      const startedAt = new Date('2026-10-20T08:00:00.000Z');
      const endedAt = new Date('2026-10-20T08:12:30.000Z');
      await seedFinished({ red: alice, black: bob, result: 'RED_WIN', startedAt, endedAt, ply: 41 });

      const forAlice = await request(t.server).get('/me/matches').set(auth(aliceToken)).expect(200);
      expect(forAlice.body.total).toBe(1);
      expect(forAlice.body.items[0]).toEqual({
        matchId: expect.any(String),
        roomCode: 'HIST0001',
        ruleProfileCode: 'VN_STANDARD',
        isRanked: false,
        yourColor: 'RED',
        opponent: { id: bob.toString(), username: 'bob', displayName: 'Bob', rating: 1200 },
        outcome: 'WIN',
        result: 'RED_WIN',
        endReason: 'CHECKMATE',
        plyCount: 41,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSec: 750,
      });

      const forBob = await request(t.server).get('/me/matches').set(auth(bobToken)).expect(200);
      expect(forBob.body.items[0]).toMatchObject({
        yourColor: 'BLACK',
        opponent: { username: 'alice' },
        outcome: 'LOSS',
        plyCount: 41,
      });
    });

    it('hòa → outcome DRAW cho cả hai bên', async () => {
      await seedFinished({ red: alice, black: bob, result: 'DRAW', endReason: 'DRAW_AGREEMENT', endedAt: new Date() });
      const a = await request(t.server).get('/me/matches').set(auth(aliceToken)).expect(200);
      const b = await request(t.server).get('/me/matches').set(auth(bobToken)).expect(200);
      expect(a.body.items[0].outcome).toBe('DRAW');
      expect(b.body.items[0].outcome).toBe('DRAW');
    });

    it('chỉ trả ván của chính mình, bỏ ván đang chơi', async () => {
      await seedFinished({ red: alice, black: bob, result: 'RED_WIN', endedAt: new Date('2026-10-20T08:00:00Z') });
      await seedFinished({ red: bob, black: carol, result: 'BLACK_WIN', endedAt: new Date('2026-10-21T08:00:00Z') });
      await seedFinished({ red: alice, black: carol, result: 'RED_WIN', endedAt: new Date(), status: 'ACTIVE' });

      const res = await request(t.server).get('/me/matches').set(auth(aliceToken)).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items.map((i: { opponent: { username: string } }) => i.opponent.username)).toEqual(['bob']);

      const forCarol = await request(t.server).get('/me/matches').set(auth(carolToken)).expect(200);
      expect(forCarol.body.total).toBe(1);
      expect(forCarol.body.items[0]).toMatchObject({ yourColor: 'BLACK', outcome: 'WIN', opponent: { username: 'bob' } });
    });

    it('ván kết thúc gần nhất lên đầu, phân trang đúng', async () => {
      const base = new Date('2026-10-01T00:00:00Z').getTime();
      for (let day = 0; day < 5; day += 1) {
        await seedFinished({ red: alice, black: bob, result: 'RED_WIN', endedAt: new Date(base + day * 86_400_000), ply: day });
      }

      const page1 = await request(t.server).get('/me/matches?page=1&pageSize=2').set(auth(aliceToken)).expect(200);
      expect(page1.body).toMatchObject({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
      expect(page1.body.items.map((i: { plyCount: number }) => i.plyCount)).toEqual([4, 3]);

      const page3 = await request(t.server).get('/me/matches?page=3&pageSize=2').set(auth(aliceToken)).expect(200);
      expect(page3.body.items.map((i: { plyCount: number }) => i.plyCount)).toEqual([0]);

      const beyond = await request(t.server).get('/me/matches?page=9&pageSize=2').set(auth(aliceToken)).expect(200);
      expect(beyond.body).toMatchObject({ items: [], total: 5 });
    });

    it.each([
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['pageSize=0', 'pageSize'],
      ['pageSize=51', 'pageSize'],
    ])('tham số sai %s → 400 VALIDATION_ERROR', async (qs, field) => {
      const res = await request(t.server).get(`/me/matches?${qs}`).set(auth(aliceToken)).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field })]));
    });
  });

  describe('GET /me/matches/:id', () => {
    it('ván do GameService ghi: trả nước đúng thứ tự, màu theo lượt, FEN sau từng nước', async () => {
      // Chơi thật qua API để chắc dữ liệu GameService ghi khớp với History API
      const room = await request(t.server).post('/rooms').set(auth(aliceToken)).send({ hostColorPref: 'RED' }).expect(201);
      const joined = await request(t.server).post(`/rooms/${room.body.code}/join`).set(auth(bobToken)).expect(200);
      const matchId: string = joined.body.matchId;
      const play = (token: string, from: string, to: string, expectedPly: number) =>
        request(t.server).post(`/matches/${matchId}/moves`).set(auth(token)).send({ from, to, expectedPly }).expect(200);
      await play(aliceToken, 'h7', 'e7', 0); // Pháo 2 bình 5
      const second = await play(bobToken, 'h0', 'g2', 1); // Mã 8 tiến 7

      // Ván đang chơi chưa có trong lịch sử
      await request(t.server).get(`/me/matches/${matchId}`).set(auth(aliceToken)).expect(404);
      const listWhilePlaying = await request(t.server).get('/me/matches').set(auth(aliceToken)).expect(200);
      expect(listWhilePlaying.body.total).toBe(0);

      // Giả lập ván kết thúc (xin thua / kết thúc ván thuộc XQA-90, XQA-91 chưa merge)
      const match = t.prisma.rows('match').find((m) => m.id === BigInt(matchId))!;
      Object.assign(match, { status: 'FINISHED', result: 'BLACK_WIN', endReason: 'RESIGNATION', endedAt: new Date() });

      const res = await request(t.server).get(`/me/matches/${matchId}`).set(auth(aliceToken)).expect(200);
      expect(res.body).toMatchObject({
        matchId,
        yourColor: 'RED',
        outcome: 'LOSS',
        endReason: 'RESIGNATION',
        plyCount: 2,
        initialFen: STARTING_FEN,
        finalFen: second.body.fen,
        ratingChange: null,
      });
      expect(res.body.moves).toHaveLength(2);
      expect(res.body.moves[0]).toMatchObject({ ply: 1, color: 'RED', from: 'h7', to: 'e7', captured: null, isCheck: false });
      expect(res.body.moves[1]).toMatchObject({ ply: 2, color: 'BLACK', from: 'h0', to: 'g2' });
      expect(res.body.moves[1].fenAfter).toBe(second.body.fen);
      expect(res.body.moves[0].thinkTimeMs).toEqual(expect.any(Number));

      const forBob = await request(t.server).get(`/me/matches/${matchId}`).set(auth(bobToken)).expect(200);
      expect(forBob.body).toMatchObject({ yourColor: 'BLACK', outcome: 'WIN' });
    });

    it('ván có bản ghi rating → trả before/after/delta của chính người xem', async () => {
      const id = await seedFinished({ red: alice, black: bob, result: 'RED_WIN', endedAt: new Date(), ruleProfileId: 2 });
      await t.prisma.ratingHistory.create({ data: { userId: alice, matchId: id, ratingBefore: 1200, ratingAfter: 1216 } });
      await t.prisma.ratingHistory.create({ data: { userId: bob, matchId: id, ratingBefore: 1200, ratingAfter: 1184 } });

      const a = await request(t.server).get(`/me/matches/${id}`).set(auth(aliceToken)).expect(200);
      expect(a.body).toMatchObject({ isRanked: true, ratingChange: { before: 1200, after: 1216, delta: 16 } });
      const b = await request(t.server).get(`/me/matches/${id}`).set(auth(bobToken)).expect(200);
      expect(b.body.ratingChange).toEqual({ before: 1200, after: 1184, delta: -16 });
    });

    it('AC: xem ván của người khác → 404, không lộ ván có tồn tại', async () => {
      const id = await seedFinished({ red: alice, black: bob, result: 'RED_WIN', endedAt: new Date() });
      const res = await request(t.server).get(`/me/matches/${id}`).set(auth(carolToken)).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'HISTORY_NOT_FOUND' });
    });

    it.each(['999999', 'abc', '-1'])('id %s không hợp lệ hoặc không tồn tại → 404', async (id) => {
      const res = await request(t.server).get(`/me/matches/${id}`).set(auth(aliceToken)).expect(404);
      expect(res.body.code).toBe('HISTORY_NOT_FOUND');
    });

    it('chưa đăng nhập → 401', async () => {
      const id = await seedFinished({ red: alice, black: bob, result: 'RED_WIN', endedAt: new Date() });
      await request(t.server).get(`/me/matches/${id}`).expect(401);
    });
  });
});
