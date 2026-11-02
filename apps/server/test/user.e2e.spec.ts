import * as request from 'supertest';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

describe('User Profile API (e2e)', () => {
  let t: TestApp;
  let aliceId: bigint;
  let bobId: bigint;
  let aliceToken: string;
  let roomSeq = 0;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function seedMatch(opts: {
    red: bigint;
    black: bigint;
    status: 'FINISHED' | 'ACTIVE';
    result?: 'RED_WIN' | 'BLACK_WIN' | 'DRAW';
  }) {
    roomSeq++;
    const room = await t.prisma.room.create({
      data: {
        roomCode: `ROOM${String(roomSeq).padStart(4, '0')}`,
        name: `Phòng ${roomSeq}`,
        hostId: opts.red,
        ruleProfileId: 1,
        status: opts.status === 'ACTIVE' ? 'PLAYING' : 'FINISHED',
      },
    });

    await t.prisma.match.create({
      data: {
        roomId: room.id,
        redPlayerId: opts.red,
        blackPlayerId: opts.black,
        ruleProfileId: 1,
        status: opts.status,
        result: opts.status === 'FINISHED' ? opts.result : null,
        endReason: opts.status === 'FINISHED' ? 'CHECKMATE' : null,
        startedAt: new Date(),
        endedAt: opts.status === 'FINISHED' ? new Date() : null,
      },
    });
  }

  beforeEach(async () => {
    roomSeq = 0;
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
    aliceId = (await seedUser(t.prisma, { username: 'alice', displayName: 'Alice Kỳ Thủ' })).id;
    bobId = (await seedUser(t.prisma, { username: 'bob', displayName: 'Bob Kỳ Vương' })).id;
    aliceToken = await loginAs(t.server, 'alice');
  });

  afterEach(async () => {
    await t.close();
  });

  describe('GET /users/:username/profile', () => {
    it('người dùng không tồn tại → 404 NOT_FOUND', async () => {
      const res = await request(t.server).get('/users/nonexistent/profile').expect(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('người dùng chưa chơi ván nào → số ván = 0, winRate = 0', async () => {
      const res = await request(t.server).get('/users/alice/profile').expect(200);
      expect(res.body).toMatchObject({
        username: 'alice',
        displayName: 'Alice Kỳ Thủ',
        rating: 1200,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      });
      expect(res.body.createdAt).toBeDefined();
    });

    it('tính toán chính xác chỉ các ván FINISHED', async () => {
      // 1. Alice (Đỏ) thắng Bob: Alice +1 win, Bob +1 loss
      await seedMatch({ red: aliceId, black: bobId, status: 'FINISHED', result: 'RED_WIN' });
      // 2. Bob (Đỏ) thắng Alice (Đen): Alice +1 loss, Bob +1 win
      await seedMatch({ red: bobId, black: aliceId, status: 'FINISHED', result: 'RED_WIN' });
      // 3. Alice (Đen) hòa Bob (Đỏ): Alice +1 draw, Bob +1 draw
      await seedMatch({ red: bobId, black: aliceId, status: 'FINISHED', result: 'DRAW' });
      // 4. Ván ACTIVE (đang chơi): KHÔNG ĐƯỢC TÍNH
      await seedMatch({ red: aliceId, black: bobId, status: 'ACTIVE' });

      // Alice: 3 ván finished, 1 thắng, 1 thua, 1 hòa → tỉ lệ thắng 33.3%
      const resAlice = await request(t.server).get('/users/alice/profile').expect(200);
      expect(resAlice.body).toMatchObject({
        username: 'alice',
        totalMatches: 3,
        wins: 1,
        losses: 1,
        draws: 1,
        winRate: 33.3,
      });

      // Bob: 3 ván finished, 1 thắng, 1 thua, 1 hòa → tỉ lệ thắng 33.3%
      const resBob = await request(t.server).get('/users/bob/profile').expect(200);
      expect(resBob.body).toMatchObject({
        username: 'bob',
        totalMatches: 3,
        wins: 1,
        losses: 1,
        draws: 1,
        winRate: 33.3,
      });
    });
  });

  describe('PATCH /me/profile', () => {
    it('chưa đăng nhập → 401', async () => {
      await request(t.server).patch('/me/profile').send({ displayName: 'New Name' }).expect(401);
    });

    it('cập nhật hợp lệ displayName, bio, avatarUrl', async () => {
      const res = await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({
          displayName: '  Alice Đại Sư  ',
          bio: 'Đam mê cờ tướng truyền thống.',
          avatarUrl: 'https://example.com/avatar.jpg',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        username: 'alice',
        displayName: 'Alice Đại Sư', // đã trim
        bio: 'Đam mê cờ tướng truyền thống.',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      // Kiểm tra lại qua GET public profile
      const publicRes = await request(t.server).get('/users/alice/profile').expect(200);
      expect(publicRes.body.displayName).toBe('Alice Đại Sư');
      expect(publicRes.body.bio).toBe('Đam mê cờ tướng truyền thống.');
      expect(publicRes.body.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('cho phép xóa bio hoặc avatarUrl bằng chuỗi rỗng', async () => {
      await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({
          bio: '',
          avatarUrl: '',
        })
        .expect(200);

      const publicRes = await request(t.server).get('/users/alice/profile').expect(200);
      expect(publicRes.body.bio).toBeNull();
      expect(publicRes.body.avatarUrl).toBeNull();
    });

    it('báo lỗi 400 VALIDATION_ERROR khi displayName rỗng sau khi trim', async () => {
      const res = await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({ displayName: '    ' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('báo lỗi 400 VALIDATION_ERROR khi displayName dài quá 80 ký tự', async () => {
      const res = await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({ displayName: 'a'.repeat(81) })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('báo lỗi 400 VALIDATION_ERROR khi bio dài quá 500 ký tự', async () => {
      const res = await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({ bio: 'b'.repeat(501) })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('báo lỗi 400 VALIDATION_ERROR khi avatarUrl không bắt đầu bằng https://', async () => {
      const res = await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({ avatarUrl: 'http://insecure.com/pic.jpg' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('báo lỗi 400 VALIDATION_ERROR khi avatarUrl dài quá 2048 ký tự', async () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(2040);
      const res = await request(t.server)
        .patch('/me/profile')
        .set(auth(aliceToken))
        .send({ avatarUrl: longUrl })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
