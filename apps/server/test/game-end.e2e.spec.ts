/**
 * XQA-90 + XQA-91 e2e: kết thúc ván + lưu kết quả, xin thua / xin hòa.
 * FR-13, FR-14, FR-15, BR-05. Story XQA-24.
 */
import * as request from 'supertest';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

describe('XQA-90/91 kết thúc ván, xin thua, xin hòa (e2e)', () => {
  let t: TestApp;
  let red: string;
  let black: string;
  let outsider: string;
  let matchId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const post = (token: string, path: string, body: object = {}) =>
    request(t.server).post(`/matches/${matchId}/${path}`).set(auth(token)).send(body);
  const move = (token: string, from: string, to: string, expectedPly: number) =>
    post(token, 'moves', { from, to, expectedPly });
  const matchRow = () => t.prisma.rows('match')[0];
  const offers = () => t.prisma.rows('drawOffer');

  beforeEach(async () => {
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
    await seedUser(t.prisma, { username: 'redp' });
    await seedUser(t.prisma, { username: 'blackp' });
    await seedUser(t.prisma, { username: 'other' });
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    outsider = await loginAs(t.server, 'other');
    const room = await request(t.server).post('/rooms').set(auth(red)).send({ hostColorPref: 'RED' }).expect(201);
    const joined = await request(t.server).post(`/rooms/${room.body.code}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
  });

  afterEach(async () => {
    await t.close();
  });

  describe('xin thua (FR-14)', () => {
    it('Đỏ xin thua → FINISHED, Đen thắng, lý do RESIGNATION, lưu DB, phòng FINISHED', async () => {
      const res = await post(red, 'resign').expect(200);
      expect(res.body).toMatchObject({
        status: 'FINISHED',
        result: 'BLACK_WIN',
        endReason: 'RESIGNATION',
        turn: null,
        drawOffer: null,
      });
      expect(res.body.endedAt).toEqual(expect.any(String));
      expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', endReason: 'RESIGNATION' });
      expect(matchRow().endedAt).toBeInstanceOf(Date);
      expect(t.prisma.rows('room')[0].status).toBe('FINISHED');
    });

    it('Đen xin thua (không phải lượt mình vẫn được) → Đỏ thắng', async () => {
      const res = await post(black, 'resign').expect(200);
      expect(res.body).toMatchObject({ result: 'RED_WIN', endReason: 'RESIGNATION' });
    });

    it('xin thua lần 2 / sau khi ván kết thúc → 409 GAME_NOT_ACTIVE, kết quả cũ giữ nguyên', async () => {
      await post(red, 'resign').expect(200);
      const again = await post(black, 'resign').expect(409);
      expect(again.body.code).toBe('GAME_NOT_ACTIVE');
      expect(matchRow().result).toBe('BLACK_WIN');
    });

    it('đi quân sau khi đã xin thua → 409 GAME_NOT_ACTIVE', async () => {
      await post(red, 'resign').expect(200);
      const res = await move(black, 'h0', 'g2', 0).expect(409);
      expect(res.body.code).toBe('GAME_NOT_ACTIVE');
    });

    it('người ngoài ván xin thua → 403 GAME_NOT_PLAYER, ván không đổi', async () => {
      const res = await post(outsider, 'resign').expect(403);
      expect(res.body.code).toBe('GAME_NOT_PLAYER');
      expect(matchRow().status).toBe('ACTIVE');
    });

    it('ván không tồn tại → 404 GAME_NOT_FOUND', async () => {
      const res = await request(t.server).post('/matches/999/resign').set(auth(red)).expect(404);
      expect(res.body.code).toBe('GAME_NOT_FOUND');
    });

    it('không đăng nhập → 401', async () => {
      await request(t.server).post(`/matches/${matchId}/resign`).expect(401);
    });

    it('AC XQA-90: client gửi kèm result/endReason/winner → bị bỏ qua, server tự tính', async () => {
      const res = await post(red, 'resign', { result: 'RED_WIN', endReason: 'CHECKMATE', winner: 'RED' }).expect(200);
      expect(res.body).toMatchObject({ result: 'BLACK_WIN', endReason: 'RESIGNATION' });
      expect(matchRow().result).toBe('BLACK_WIN');
    });
  });

  describe('xin hòa (FR-15)', () => {
    it('đề nghị hòa → state có drawOffer, lưu DrawOffer PENDING', async () => {
      const res = await post(red, 'draw-offer').expect(200);
      expect(res.body).toMatchObject({ status: 'ACTIVE', drawOffer: { by: 'RED', atPly: 0 } });
      const seenByBlack = await request(t.server).get(`/matches/${matchId}`).set(auth(black)).expect(200);
      expect(seenByBlack.body.drawOffer).toEqual({ by: 'RED', atPly: 0 });
      expect(offers()).toHaveLength(1);
      expect(offers()[0]).toMatchObject({ status: 'PENDING', atPly: 0 });
    });

    it('AC1: đối thủ đồng ý → FINISHED, DRAW, DRAW_AGREEMENT; offer ACCEPTED', async () => {
      await post(red, 'draw-offer').expect(200);
      const res = await post(black, 'draw-accept').expect(200);
      expect(res.body).toMatchObject({
        status: 'FINISHED',
        result: 'DRAW',
        endReason: 'DRAW_AGREEMENT',
        drawOffer: null,
        turn: null,
      });
      expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'DRAW', endReason: 'DRAW_AGREEMENT' });
      expect(offers()[0].status).toBe('ACCEPTED');
      expect(t.prisma.rows('room')[0].status).toBe('FINISHED');
    });

    it('đối thủ từ chối → ván tiếp tục, offer DECLINED, đi tiếp bình thường', async () => {
      await post(red, 'draw-offer').expect(200);
      const res = await post(black, 'draw-reject').expect(200);
      expect(res.body).toMatchObject({ status: 'ACTIVE', result: null, drawOffer: null });
      expect(offers()[0].status).toBe('DECLINED');
      await move(red, 'h7', 'e7', 0).expect(200);
    });

    it('người đề nghị tự đồng ý / tự từ chối → 409 GAME_DRAW_OFFER_OWN', async () => {
      await post(red, 'draw-offer').expect(200);
      expect((await post(red, 'draw-accept').expect(409)).body.code).toBe('GAME_DRAW_OFFER_OWN');
      expect((await post(red, 'draw-reject').expect(409)).body.code).toBe('GAME_DRAW_OFFER_OWN');
      expect(matchRow().status).toBe('ACTIVE');
    });

    it('đồng ý khi không có đề nghị → 409 GAME_NO_DRAW_OFFER', async () => {
      const res = await post(black, 'draw-accept').expect(409);
      expect(res.body.code).toBe('GAME_NO_DRAW_OFFER');
      expect(matchRow().status).toBe('ACTIVE');
    });

    it('đề nghị khi đã có đề nghị chờ (của mình hoặc đối thủ) → 409 GAME_DRAW_OFFER_PENDING', async () => {
      await post(red, 'draw-offer').expect(200);
      expect((await post(red, 'draw-offer').expect(409)).body.code).toBe('GAME_DRAW_OFFER_PENDING');
      expect((await post(black, 'draw-offer').expect(409)).body.code).toBe('GAME_DRAW_OFFER_PENDING');
      expect(offers()).toHaveLength(1);
    });

    it('BR-DRAW-01: bị từ chối thì phải đi thêm 1 nước mới đề nghị lại được', async () => {
      await post(red, 'draw-offer').expect(200);
      await post(black, 'draw-reject').expect(200);
      expect((await post(red, 'draw-offer').expect(409)).body.code).toBe('GAME_DRAW_OFFER_TOO_SOON');
      await move(red, 'h7', 'e7', 0).expect(200);
      await post(red, 'draw-offer').expect(200);
    });

    it('BR-DRAW-02: đối thủ đi quân thay vì trả lời → đề nghị hết hạn (EXPIRED)', async () => {
      await move(red, 'h7', 'e7', 0).expect(200);
      await post(red, 'draw-offer').expect(200);
      const res = await move(black, 'h0', 'g2', 1).expect(200);
      expect(res.body.drawOffer).toBeNull();
      expect(offers()[0].status).toBe('EXPIRED');
      // Hết hạn rồi thì không còn gì để đồng ý
      expect((await post(black, 'draw-accept').expect(409)).body.code).toBe('GAME_NO_DRAW_OFFER');
      expect(matchRow().status).toBe('ACTIVE');
    });

    it('người đề nghị tự đi quân → đề nghị vẫn còn chờ', async () => {
      await post(red, 'draw-offer').expect(200);
      const res = await move(red, 'h7', 'e7', 0).expect(200);
      expect(res.body.drawOffer).toEqual({ by: 'RED', atPly: 0 });
      expect(offers()[0].status).toBe('PENDING');
    });

    it('xin thua khi đang có đề nghị hòa → offer EXPIRED, kết quả RESIGNATION', async () => {
      await post(red, 'draw-offer').expect(200);
      const res = await post(black, 'resign').expect(200);
      expect(res.body).toMatchObject({ result: 'RED_WIN', endReason: 'RESIGNATION', drawOffer: null });
      expect(offers()[0].status).toBe('EXPIRED');
    });

    it('người ngoài ván đề nghị / đồng ý hòa → 403 GAME_NOT_PLAYER', async () => {
      await post(red, 'draw-offer').expect(200);
      expect((await post(outsider, 'draw-offer').expect(403)).body.code).toBe('GAME_NOT_PLAYER');
      expect((await post(outsider, 'draw-accept').expect(403)).body.code).toBe('GAME_NOT_PLAYER');
      expect(matchRow().status).toBe('ACTIVE');
    });

    it('đề nghị hòa sau khi ván kết thúc → 409 GAME_NOT_ACTIVE', async () => {
      await post(red, 'resign').expect(200);
      expect((await post(black, 'draw-offer').expect(409)).body.code).toBe('GAME_NOT_ACTIVE');
    });
  });

  describe('lưu kết quả các đường kết thúc khác (XQA-90 AC2)', () => {
    // Chiếu bí / hết nước đã có test ở game.e2e (XQA-74). Ở đây kiểm tra đường kết thúc bằng nước đi
    // cũng chốt phòng và dọn đề nghị hòa giống xin thua / hòa.
    it('lặp nước → DRAW REPETITION lưu DB, đề nghị hòa đang chờ chuyển EXPIRED', async () => {
      const cycle: Array<[string, string, string]> = [
        [red, 'h9', 'g7'],
        [black, 'h0', 'g2'],
        [red, 'g7', 'h9'],
        [black, 'g2', 'h0'],
      ];
      let ply = 0;
      for (let round = 0; round < 2; round++) {
        for (const [token, from, to] of cycle) {
          if (round === 1 && ply === 7) await post(black, 'draw-offer').expect(200);
          await move(token, from, to, ply).expect(200);
          ply++;
        }
      }
      expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'DRAW', endReason: 'REPETITION' });
      expect(t.prisma.rows('room')[0].status).toBe('FINISHED');
      expect(offers()[0].status).toBe('EXPIRED');
    });

    it('ván kết thúc xuất hiện trong lịch sử của cả hai người chơi với đúng kết quả', async () => {
      await post(red, 'resign').expect(200);
      const redHistory = await request(t.server).get('/me/matches').set(auth(red)).expect(200);
      const blackHistory = await request(t.server).get('/me/matches').set(auth(black)).expect(200);
      expect(JSON.stringify(redHistory.body)).toContain('RESIGNATION');
      expect(JSON.stringify(blackHistory.body)).toContain('RESIGNATION');
    });
  });
});
