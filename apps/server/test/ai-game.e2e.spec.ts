import * as request from 'supertest';
import { createTestApp, loginAs, seedUser, TestApp } from './support/test-app';

describe('AiGame API (e2e)', () => {
  let t: TestApp;
  let alice: bigint;
  let aliceToken: string;
  let bobToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    t = await createTestApp();
    const u1 = await seedUser(t.prisma, { username: 'alice' });
    alice = u1.id;
    await seedUser(t.prisma, { username: 'bob' });
    aliceToken = await loginAs(t.server, 'alice');
    bobToken = await loginAs(t.server, 'bob');
  });

  afterAll(async () => {
    await t.close();
  });

  it('tạo ván mới thành công và lấy chi tiết', async () => {
    const createRes = await request(t.server)
      .post('/ai-games')
      .set(auth(aliceToken))
      .send({ level: 'MEDIUM', playerColor: 'r' })
      .expect(201);

    expect(createRes.body).toMatchObject({
      userId: alice.toString(),
      level: 'MEDIUM',
      playerColor: 'r',
      plyCount: 0,
      status: 'IN_PROGRESS',
      result: null,
    });
    expect(createRes.body.moves).toEqual([]);

    const getRes = await request(t.server)
      .get(`/ai-games/${createRes.body.id}`)
      .set(auth(aliceToken))
      .expect(200);

    expect(getRes.body.id).toBe(createRes.body.id);
  });

  it('lấy danh sách ván IN_PROGRESS, sắp xếp mới nhất trước', async () => {
    const listRes = await request(t.server)
      .get('/ai-games?status=IN_PROGRESS')
      .set(auth(aliceToken))
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body[0]).toHaveProperty('id');
    expect(listRes.body[0]).toHaveProperty('plyCount');
    expect(listRes.body[0]).toHaveProperty('updatedAt');
  });

  it('lưu nước đi hợp lệ tính đúng currentFen và plyCount', async () => {
    const createRes = await request(t.server)
      .post('/ai-games')
      .set(auth(aliceToken))
      .send({ level: 'EASY', playerColor: 'r' })
      .expect(201);

    const gameId = createRes.body.id;

    // Đỏ pháo 2 bình 5: b7 -> e7
    // Đen mã 8 tiến 7: b0 -> c2
    const validMoves = [
      { from: 'b7', to: 'e7' },
      { from: 'b0', to: 'c2' },
    ];

    const putRes = await request(t.server)
      .put(`/ai-games/${gameId}`)
      .set(auth(aliceToken))
      .send({ moves: validMoves })
      .expect(200);

    expect(putRes.body.plyCount).toBe(2);
    expect(putRes.body.moves).toEqual(validMoves);
    expect(putRes.body.currentFen).not.toBe(createRes.body.initialFen);
  });

  it('lưu nước đi sai luật bị 400 VALIDATION_ERROR kèm số thứ tự nước sai', async () => {
    const createRes = await request(t.server)
      .post('/ai-games')
      .set(auth(aliceToken))
      .send({ level: 'EASY', playerColor: 'r' })
      .expect(201);

    const gameId = createRes.body.id;

    // Nước 1: b7 -> e7 (hợp lệ)
    // Nước 2: a0 -> a4 (xe đen nhảy không hợp lệ vì vướng tốt)
    const illegalMoves = [
      { from: 'b7', to: 'e7' },
      { from: 'a0', to: 'a4' },
    ];

    const res = await request(t.server)
      .put(`/ai-games/${gameId}`)
      .set(auth(aliceToken))
      .send({ moves: illegalMoves })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain('2');
  });

  it('không cho xem hoặc sửa ván của người khác (trả 404)', async () => {
    const createRes = await request(t.server)
      .post('/ai-games')
      .set(auth(aliceToken))
      .send({ level: 'HARD', playerColor: 'b' })
      .expect(201);

    const gameId = createRes.body.id;

    // Bob xem ván của Alice -> 404
    await request(t.server)
      .get(`/ai-games/${gameId}`)
      .set(auth(bobToken))
      .expect(404);

    // Bob sửa ván của Alice -> 404
    await request(t.server)
      .put(`/ai-games/${gameId}`)
      .set(auth(bobToken))
      .send({ moves: [] })
      .expect(404);
  });

  it('giới hạn tối đa 10 ván IN_PROGRESS, tạo ván thứ 11 trả 409 AI_GAME_LIMIT', async () => {
    // Tạo user riêng cho test này
    await seedUser(t.prisma, { username: 'charlie' });
    const charlieToken = await loginAs(t.server, 'charlie');

    for (let i = 0; i < 10; i++) {
      await request(t.server)
        .post('/ai-games')
        .set(auth(charlieToken))
        .send({ level: 'EASY', playerColor: 'r' })
        .expect(201);
    }

    const res = await request(t.server)
      .post('/ai-games')
      .set(auth(charlieToken))
      .send({ level: 'EASY', playerColor: 'r' })
      .expect(409);

    expect(res.body.code).toBe('AI_GAME_LIMIT');
  });

  it('xoá ván thành công trả 204', async () => {
    const createRes = await request(t.server)
      .post('/ai-games')
      .set(auth(aliceToken))
      .send({ level: 'MEDIUM', playerColor: 'r' })
      .expect(201);

    const gameId = createRes.body.id;

    await request(t.server)
      .delete(`/ai-games/${gameId}`)
      .set(auth(aliceToken))
      .expect(204);

    await request(t.server)
      .get(`/ai-games/${gameId}`)
      .set(auth(aliceToken))
      .expect(404);
  });

  it('lưu ván đã FINISHED trả 409 AI_GAME_FINISHED', async () => {
    const createRes = await request(t.server)
      .post('/ai-games')
      .set(auth(aliceToken))
      .send({ level: 'MEDIUM', playerColor: 'r' })
      .expect(201);

    const gameId = createRes.body.id;

    // Đánh dấu FINISHED
    await request(t.server)
      .put(`/ai-games/${gameId}`)
      .set(auth(aliceToken))
      .send({
        moves: [{ from: 'b7', to: 'e7' }],
        status: 'FINISHED',
        result: 'WIN:checkmate',
      })
      .expect(200);

    // Cố lưu tiếp -> 409
    const res = await request(t.server)
      .put(`/ai-games/${gameId}`)
      .set(auth(aliceToken))
      .send({
        moves: [{ from: 'b7', to: 'e7' }],
      })
      .expect(409);

    expect(res.body.code).toBe('AI_GAME_FINISHED');
  });
});
