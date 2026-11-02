import * as request from 'supertest';
import { AccountStatus, UserRole } from '@prisma/client';
import { createTestApp, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

describe('GET /leaderboard (XQA-40, FR-19 e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
  });

  afterEach(async () => {
    await t.close();
  });

  it('công khai: không cần đăng nhập vẫn xem được bảng xếp hạng', async () => {
    const res = await request(t.server).get('/leaderboard').expect(200);
    expect(res.body).toMatchObject({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('sắp xếp theo rating giảm dần; trùng rating thì theo username tăng dần; chỉ lấy ACTIVE + PLAYER', async () => {
    await seedUser(t.prisma, { username: 'player_mid', displayName: 'Player Mid', rating: 1300 });
    await seedUser(t.prisma, { username: 'player_top', displayName: 'Player Top', rating: 1500 });
    await seedUser(t.prisma, { username: 'player_a', displayName: 'Player A', rating: 1200 });
    await seedUser(t.prisma, { username: 'player_b', displayName: 'Player B', rating: 1200 });
    // Bị loại: ADMIN và LOCKED
    await seedUser(t.prisma, { username: 'admin_user', rating: 2000, role: UserRole.ADMIN });
    await seedUser(t.prisma, { username: 'locked_user', rating: 1900, accountStatus: AccountStatus.LOCKED });

    const res = await request(t.server).get('/leaderboard?page=1&pageSize=10').expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items).toHaveLength(4);

    expect(res.body.items[0]).toMatchObject({ rank: 1, username: 'player_top', rating: 1500, gamesPlayed: 0 });
    expect(res.body.items[1]).toMatchObject({ rank: 2, username: 'player_mid', rating: 1300, gamesPlayed: 0 });
    expect(res.body.items[2]).toMatchObject({ rank: 3, username: 'player_a', rating: 1200, gamesPlayed: 0 });
    expect(res.body.items[3]).toMatchObject({ rank: 4, username: 'player_b', rating: 1200, gamesPlayed: 0 });
  });

  it('tính đúng số ván đã chơi (chỉ tính ván FINISHED)', async () => {
    const p1 = await seedUser(t.prisma, { username: 'p1', rating: 1400 });
    const p2 = await seedUser(t.prisma, { username: 'p2', rating: 1200 });
    const p3 = await seedUser(t.prisma, { username: 'p3', rating: 1100 });

    // Tạo 2 ván FINISHED: ván 1 p1 vs p2, ván 2 p1 vs p3
    await t.prisma.match.create({
      data: {
        roomId: 1n,
        ruleProfileId: 1,
        redPlayerId: p1.id,
        blackPlayerId: p2.id,
        status: 'FINISHED',
        result: 'RED_WIN',
      },
    });
    await t.prisma.match.create({
      data: {
        roomId: 1n,
        ruleProfileId: 1,
        redPlayerId: p3.id,
        blackPlayerId: p1.id,
        status: 'FINISHED',
        result: 'DRAW',
      },
    });
    // Ván ACTIVE / ABORTED không tính vào gamesPlayed
    await t.prisma.match.create({
      data: {
        roomId: 1n,
        ruleProfileId: 1,
        redPlayerId: p2.id,
        blackPlayerId: p3.id,
        status: 'ACTIVE',
      },
    });

    const res = await request(t.server).get('/leaderboard').expect(200);
    const itemP1 = res.body.items.find((i: { username: string }) => i.username === 'p1');
    const itemP2 = res.body.items.find((i: { username: string }) => i.username === 'p2');
    const itemP3 = res.body.items.find((i: { username: string }) => i.username === 'p3');

    expect(itemP1.gamesPlayed).toBe(2);
    expect(itemP2.gamesPlayed).toBe(1);
    expect(itemP3.gamesPlayed).toBe(1);
  });

  it('phân trang đúng rank và số lượng items', async () => {
    for (let i = 1; i <= 5; i++) {
      await seedUser(t.prisma, { username: `user_${i}`, rating: 1000 + i * 10 });
    }

    const page1 = await request(t.server).get('/leaderboard?page=1&pageSize=2').expect(200);
    expect(page1.body.total).toBe(5);
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0]).toMatchObject({ rank: 1, username: 'user_5' });
    expect(page1.body.items[1]).toMatchObject({ rank: 2, username: 'user_4' });

    const page2 = await request(t.server).get('/leaderboard?page=2&pageSize=2').expect(200);
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.items[0]).toMatchObject({ rank: 3, username: 'user_3' });
    expect(page2.body.items[1]).toMatchObject({ rank: 4, username: 'user_2' });

    const page3 = await request(t.server).get('/leaderboard?page=3&pageSize=2').expect(200);
    expect(page3.body.items).toHaveLength(1);
    expect(page3.body.items[0]).toMatchObject({ rank: 5, username: 'user_1' });
  });

  it('validate query params: page < 1 hoặc pageSize > 50 → 400 VALIDATION_ERROR', async () => {
    const res1 = await request(t.server).get('/leaderboard?page=0').expect(400);
    expect(res1.body.code).toBe('VALIDATION_ERROR');

    const res2 = await request(t.server).get('/leaderboard?pageSize=51').expect(400);
    expect(res2.body.code).toBe('VALIDATION_ERROR');
  });
});
