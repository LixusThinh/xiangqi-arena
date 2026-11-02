import * as request from 'supertest';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

describe('POST /matches/:id/report (XQA-30, FR-24, AC-30-01 … 06)', () => {
  let t: TestApp;
  let p1: { id: bigint; token: string; username: string };
  let p2: { id: bigint; token: string; username: string };
  let p3: { id: bigint; token: string; username: string };
  let matchId: bigint;

  beforeEach(async () => {
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
    const u1 = await seedUser(t.prisma, { username: 'player1' });
    const u2 = await seedUser(t.prisma, { username: 'player2' });
    const u3 = await seedUser(t.prisma, { username: 'player3' });

    const token1 = await loginAs(t.server, u1.username, u1.password);
    const token2 = await loginAs(t.server, u2.username, u2.password);
    const token3 = await loginAs(t.server, u3.username, u3.password);

    p1 = { id: u1.id, token: token1, username: u1.username };
    p2 = { id: u2.id, token: token2, username: u2.username };
    p3 = { id: u3.id, token: token3, username: u3.username };

    const room = await t.prisma.room.create({
      data: {
        roomCode: 'REP123',
        name: 'Report Test Room',
        hostId: p1.id,
        ruleProfileId: 1,
        status: 'PLAYING',
      },
    });

    const match = await t.prisma.match.create({
      data: {
        roomId: room.id as bigint,
        ruleProfileId: 1,
        redPlayerId: p1.id,
        blackPlayerId: p2.id,
        status: 'ACTIVE',
        currentFen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
      },
    });
    matchId = match.id as bigint;
  });

  afterEach(async () => {
    await t.close();
  });

  it('AC-30-01: người chơi báo cáo đối thủ thành công, lưu DB status=OPEN', async () => {
    const res = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({
        reason: 'CHEATING',
        description: 'Đối thủ sử dụng phần mềm hỗ trợ tính nước đi.',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      matchId: matchId.toString(),
      reporterId: p1.id.toString(),
      reportedUserId: p2.id.toString(),
      reason: 'CHEATING',
      description: 'Đối thủ sử dụng phần mềm hỗ trợ tính nước đi.',
      status: 'OPEN',
    });

    // Kiểm tra đã lưu DB
    const inDb = await t.prisma.report.findFirst({
      where: { matchId, reporterId: p1.id },
    });
    expect(inDb).toBeDefined();
    expect(inDb?.reportedUserId).toBe(p2.id);
    expect(inDb?.reason).toBe('CHEATING');
    expect(inDb?.status).toBe('OPEN');
  });

  it('AC-30-02: gửi lý do ngoài enum ReportReason -> 400 VALIDATION_ERROR', async () => {
    const res = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({
        reason: 'UNKNOWN_REASON',
        description: 'Một lý do không có trong danh mục.',
      })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AC-30-03: báo cáo lần 2 cho cùng một ván -> 409 REPORT_DUPLICATE', async () => {
    // Báo cáo lần 1
    await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ reason: 'SPAM' })
      .expect(201);

    // Báo cáo lần 2
    const res = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ reason: 'HARASSMENT' })
      .expect(409);

    expect(res.body.code).toBe('REPORT_DUPLICATE');
  });

  it('AC-30-04: người ngoài không chơi ván đó báo cáo -> 403 GAME_NOT_PLAYER', async () => {
    const res = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({ reason: 'OTHER', description: 'Tôi là khán giả muốn báo cáo.' })
      .expect(403);

    expect(res.body.code).toBe('GAME_NOT_PLAYER');
  });

  it('AC-30-05: mô tả chứa HTML/script được lưu nguyên văn an toàn dạng text (NFR-04)', async () => {
    const malicious = '<script>alert("hack")</script><img src="x" onerror="alert(1)">';
    const res = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p2.token}`)
      .send({
        reason: 'HARASSMENT',
        description: malicious,
      })
      .expect(201);

    expect(res.body.description).toBe(malicious);
    const inDb = await t.prisma.report.findFirst({
      where: { matchId, reporterId: p2.id },
    });
    expect(inDb?.description).toBe(malicious);
  });

  it('AC-30-06: mô tả dài quá 500 ký tự -> 400 VALIDATION_ERROR; đúng 500 ký tự -> hợp lệ', async () => {
    // 501 ký tự
    const tooLong = 'x'.repeat(501);
    const res1 = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({
        reason: 'OTHER',
        description: tooLong,
      })
      .expect(400);

    expect(res1.body.code).toBe('VALIDATION_ERROR');

    // Đúng 500 ký tự
    const exact500 = 'x'.repeat(500);
    const res2 = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({
        reason: 'OTHER',
        description: exact500,
      })
      .expect(201);

    expect(res2.body.description).toBe(exact500);
  });

  it('yêu cầu xác thực: không có token -> 401 AUTH_TOKEN_MISSING', async () => {
    const res = await request(t.server)
      .post(`/matches/${matchId}/report`)
      .send({ reason: 'SPAM' })
      .expect(401);

    expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
  });
});
