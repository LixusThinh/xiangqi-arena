/**
 * XQA-74 e2e: GameService server-authoritative (validate nước, lượt, state).
 * FR-09, FR-11, FR-13, BR-02, BR-03, NFR-06.
 */
import * as request from 'supertest';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

describe('XQA-74 GameService (e2e)', () => {
  let t: TestApp;
  let red: string;
  let black: string;
  let outsider: string;
  let matchId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const move = (token: string, from: string, to: string, expectedPly: number) =>
    request(t.server)
      .post(`/matches/${matchId}/moves`)
      .set(auth(token))
      .send({ from, to, expectedPly });

  beforeEach(async () => {
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
    await seedUser(t.prisma, { username: 'redp' });
    await seedUser(t.prisma, { username: 'blackp' });
    await seedUser(t.prisma, { username: 'other' });
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    outsider = await loginAs(t.server, 'other');
    // Chủ phòng chọn Đỏ để test xác định màu
    const room = await request(t.server).post('/rooms').set(auth(red)).send({ hostColorPref: 'RED' }).expect(201);
    const joined = await request(t.server).post(`/rooms/${room.body.code}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
  });

  afterEach(async () => {
    await t.close();
  });

  it('mở ván lần đầu: Match WAITING → ACTIVE, thế khởi đầu, Đỏ đi trước, đúng màu người xem', async () => {
    const res = await request(t.server).get(`/matches/${matchId}`).set(auth(black)).expect(200);
    expect(res.body).toMatchObject({
      status: 'ACTIVE',
      ply: 0,
      turn: 'RED',
      inCheck: false,
      yourColor: 'BLACK',
      fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
      red: { username: 'redp' },
      black: { username: 'blackp' },
      moves: [],
    });
    expect(res.body.startedAt).toEqual(expect.any(String));
  });

  it('tìm ván theo mã phòng (FE chỉ biết mã phòng)', async () => {
    const [room] = t.prisma.rows('room');
    const res = await request(t.server).get(`/rooms/${room.roomCode}/match`).set(auth(red)).expect(200);
    expect(res.body.matchId).toBe(matchId);
  });

  it('nước hợp lệ đúng lượt → lưu nước, đổi lượt, cả 2 bên thấy cùng thế cờ', async () => {
    const res = await move(red, 'h7', 'e7', 0).expect(200); // Pháo 2 bình 5
    expect(res.body).toMatchObject({ ply: 1, turn: 'BLACK', lastMove: { ply: 1, from: 'h7', to: 'e7', piece: 'C' } });
    const seenByBlack = await request(t.server).get(`/matches/${matchId}`).set(auth(black)).expect(200);
    expect(seenByBlack.body.fen).toBe(res.body.fen);
    expect(seenByBlack.body.moves).toHaveLength(1);
    expect(t.prisma.rows('move')[0]).toMatchObject({ ply: 1, fromSq: 'h7', toSq: 'e7', pieceCode: 'C' });
  });

  it('FR-11: đi khi chưa tới lượt → 409 GAME_NOT_YOUR_TURN, thế cờ không đổi', async () => {
    const res = await move(black, 'h0', 'g2', 0).expect(409);
    expect(res.body.code).toBe('GAME_NOT_YOUR_TURN');
    expect(t.prisma.rows('move')).toHaveLength(0);
  });

  it('BR-02: Đỏ đi quân Đen trong lượt mình → 400 GAME_ILLEGAL_MOVE', async () => {
    const res = await move(red, 'h0', 'g2', 0).expect(400);
    expect(res.body.code).toBe('GAME_ILLEGAL_MOVE');
  });

  it.each([
    ['Xe đi chéo', 'a9', 'b8'],
    ['Mã bị cản chân… đi 3 ô', 'b9', 'b6'],
    ['ô trống', 'e5', 'e4'],
  ])('FR-09/BR-03: nước sai luật (%s) → 400 GAME_ILLEGAL_MOVE', async (_n, from, to) => {
    const res = await move(red, from, to, 0).expect(400);
    expect(res.body.code).toBe('GAME_ILLEGAL_MOVE');
    const state = await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    expect(state.body.ply).toBe(0);
  });

  it('gửi trùng / thế cờ cũ (expectedPly lệch) → 409 GAME_STALE_STATE', async () => {
    await move(red, 'h7', 'e7', 0).expect(200);
    const dup = await move(red, 'h7', 'e7', 0).expect(409);
    expect(dup.body.code).toBe('GAME_STALE_STATE');
    expect(t.prisma.rows('move')).toHaveLength(1);
  });

  it('NFR-06: 2 request đi cùng lúc trên cùng thế cờ → chỉ 1 nước được ghi', async () => {
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    const results = await Promise.all([move(red, 'h7', 'e7', 0), move(red, 'b7', 'e7', 0)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(t.prisma.rows('move')).toHaveLength(1);
  });

  it('người ngoài ván không đi được → 403 GAME_NOT_PLAYER', async () => {
    const res = await move(outsider, 'h7', 'e7', 0).expect(403);
    expect(res.body.code).toBe('GAME_NOT_PLAYER');
  });

  it('dữ liệu sai định dạng → 400 VALIDATION_ERROR; ván không tồn tại → 404', async () => {
    await request(t.server)
      .post(`/matches/${matchId}/moves`)
      .set(auth(red))
      .send({ from: 'z9', to: 'e7', expectedPly: 0 })
      .expect(400);
    const res = await request(t.server).get('/matches/999999').set(auth(red)).expect(404);
    expect(res.body.code).toBe('GAME_NOT_FOUND');
  });

  it('FR-13 + Điều 24.2: hai bên lặp nước chờ 3 lần → hòa REPETITION, phòng FINISHED, không đi tiếp được', async () => {
    const cycle: [string, string, string][] = [
      ['red', 'h9', 'g7'],
      ['black', 'h0', 'g2'],
      ['red', 'g7', 'h9'],
      ['black', 'g2', 'h0'],
    ];
    let ply = 0;
    let last: request.Response | undefined;
    for (let round = 0; round < 2; round++) {
      for (const [who, from, to] of cycle) {
        last = await move(who === 'red' ? red : black, from, to, ply).expect(200);
        ply++;
      }
    }
    expect(last?.body).toMatchObject({
      status: 'FINISHED',
      result: 'DRAW',
      endReason: 'REPETITION',
      turn: null,
      endRule: expect.stringContaining('Điều 24.2'),
    });
    expect(t.prisma.rows('room')[0].status).toBe('FINISHED');

    const after = await move(red, 'h9', 'g7', ply).expect(409);
    expect(after.body.code).toBe('GAME_NOT_ACTIVE');
  });
});
