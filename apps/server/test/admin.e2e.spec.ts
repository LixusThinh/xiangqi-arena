import * as request from 'supertest';
import { AccountStatus, ReportReason, ReportStatus, UserRole } from '@prisma/client';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

describe('Admin API (XQA-31 + XQA-35, FR-25 … 29, AC-31-* & AC-35-*)', () => {
  let t: TestApp;
  let admin: { id: bigint; token: string; username: string };
  let admin2: { id: bigint; token: string; username: string };
  let player: { id: bigint; token: string; username: string };
  let player2: { id: bigint; token: string; username: string };

  beforeEach(async () => {
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);

    const uAdmin = await seedUser(t.prisma, { username: 'admin1', role: UserRole.ADMIN });
    const uAdmin2 = await seedUser(t.prisma, { username: 'admin2', role: UserRole.ADMIN });
    const uPlayer = await seedUser(t.prisma, { username: 'player1', role: UserRole.PLAYER });
    const uPlayer2 = await seedUser(t.prisma, { username: 'player2', role: UserRole.PLAYER });

    const adminToken = await loginAs(t.server, uAdmin.username, uAdmin.password);
    const admin2Token = await loginAs(t.server, uAdmin2.username, uAdmin2.password);
    const playerToken = await loginAs(t.server, uPlayer.username, uPlayer.password);
    const player2Token = await loginAs(t.server, uPlayer2.username, uPlayer2.password);

    admin = { id: uAdmin.id, token: adminToken, username: uAdmin.username };
    admin2 = { id: uAdmin2.id, token: admin2Token, username: uAdmin2.username };
    player = { id: uPlayer.id, token: playerToken, username: uPlayer.username };
    player2 = { id: uPlayer2.id, token: player2Token, username: uPlayer2.username };
  });

  afterEach(async () => {
    await t.close();
  });

  describe('Phân quyền truy cập (AC-31-01, AC-31-02)', () => {
    it('chưa đăng nhập -> 401 AUTH_TOKEN_MISSING cho mọi endpoint /admin/*', async () => {
      await request(t.server).get('/admin/dashboard').expect(401);
      await request(t.server).get('/admin/users').expect(401);
      await request(t.server).get('/admin/matches').expect(401);
      await request(t.server).get('/admin/reports').expect(401);
      await request(t.server).patch(`/admin/users/${player.id}/status`).send({ status: 'LOCKED' }).expect(401);
    });

    it('role PLAYER gọi bất kỳ endpoint /admin/* -> 403 FORBIDDEN, không đổi dữ liệu', async () => {
      await request(t.server)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(403);

      await request(t.server)
        .get('/admin/users')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(403);

      await request(t.server)
        .get('/admin/matches')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(403);

      await request(t.server)
        .get('/admin/reports')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(403);

      await request(t.server)
        .patch(`/admin/users/${player2.id}/status`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ status: 'LOCKED' })
        .expect(403);

      // Đảm bảo dữ liệu không bị thay đổi
      const user = await t.prisma.user.findUnique({ where: { id: player2.id } });
      expect(user?.accountStatus).toBe(AccountStatus.ACTIVE);
    });
  });

  describe('Quản lý người dùng (AC-31-03, 04, 05, 06, 07)', () => {
    it('AC-31-03: tìm kiếm user theo username / email / displayName', async () => {
      const res = await request(t.server)
        .get('/admin/users?q=layer1')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0]).toMatchObject({
        id: player.id.toString(),
        username: 'player1',
        role: 'PLAYER',
        accountStatus: 'ACTIVE',
      });
    });

    it('AC-31-04 & AC-31-05: khóa user thì thu hồi auth_sessions, mở khóa thì hoạt động lại', async () => {
      // Khóa player
      const resLock = await request(t.server)
        .patch(`/admin/users/${player.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'LOCKED' })
        .expect(200);

      expect(resLock.body.accountStatus).toBe('LOCKED');

      // Kiểm tra phiên đăng nhập đã bị thu hồi
      const sessions = await t.prisma.authSession.findMany({
        where: { userId: player.id },
      });
      expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);

      // Dùng token cũ gọi API -> bị từ chối
      await request(t.server)
        .get('/me/matches')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(401);

      // Đăng nhập lại khi đang LOCKED -> 403 ACCOUNT_LOCKED
      await request(t.server)
        .post('/auth/login')
        .send({ identifier: 'player1', password: 'Player-dev-2026!' })
        .expect(403);

      // Mở khóa player
      const resUnlock = await request(t.server)
        .patch(`/admin/users/${player.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(resUnlock.body.accountStatus).toBe('ACTIVE');

      // Đăng nhập lại thành công
      await request(t.server)
        .post('/auth/login')
        .send({ identifier: 'player1', password: 'Player-dev-2026!' })
        .expect(200);
    });

    it('AC-31-06: chặn tự khóa chính mình và chặn khóa admin khác', async () => {
      // Tự khóa chính mình
      const resSelf = await request(t.server)
        .patch(`/admin/users/${admin.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'LOCKED' })
        .expect(400);

      expect(resSelf.body.code).toBe('VALIDATION_ERROR');

      // Khóa admin khác
      const resOther = await request(t.server)
        .patch(`/admin/users/${admin2.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'LOCKED' })
        .expect(400);

      expect(resOther.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Xem ván đấu và danh sách nước (AC-35-01)', () => {
    it('lấy danh sách ván và xem chi tiết kèm nước đi', async () => {
      const match = await t.prisma.match.create({
        data: {
          roomId: 1n,
          ruleProfileId: 1,
          redPlayerId: player.id,
          blackPlayerId: player2.id,
          status: 'FINISHED',
          result: 'RED_WIN',
          endReason: 'CHECKMATE',
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });

      await t.prisma.move.create({
        data: {
          matchId: match.id as bigint,
          ply: 1,
          playerId: player.id,
          pieceCode: 'C',
          fromSq: 'h7',
          toSq: 'e7',
          fenAfter: 'test-fen',
          positionHash: 'hash123456789012',
        },
      });

      const matchId = match.id as bigint;

      // Danh sách ván
      const resList = await request(t.server)
        .get('/admin/matches?status=FINISHED')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(resList.body.total).toBe(1);
      expect(resList.body.items[0]).toMatchObject({
        id: matchId.toString(),
        status: 'FINISHED',
        result: 'RED_WIN',
        endReason: 'CHECKMATE',
      });

      // Chi tiết ván
      const resDetail = await request(t.server)
        .get(`/admin/matches/${matchId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(resDetail.body.id).toBe(matchId.toString());
      expect(resDetail.body.moves).toHaveLength(1);
      expect(resDetail.body.moves[0]).toMatchObject({
        ply: 1,
        from: 'h7',
        to: 'e7',
        piece: 'C',
      });
    });
  });

  describe('Xử lý báo cáo người chơi (AC-35-02)', () => {
    it('chuyển trạng thái OPEN -> PROCESSING -> CLOSED, chặn đi lùi', async () => {
      const report = await t.prisma.report.create({
        data: {
          matchId: 1n,
          reporterId: player.id,
          reportedUserId: player2.id,
          reason: ReportReason.CHEATING,
          description: 'Nghi vấn dùng tool',
          status: ReportStatus.OPEN,
        },
      });

      // OPEN -> PROCESSING
      const resProc = await request(t.server)
        .patch(`/admin/reports/${report.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'PROCESSING' })
        .expect(200);

      expect(resProc.body.status).toBe('PROCESSING');
      expect(resProc.body.handledBy.id).toBe(admin.id.toString());
      expect(resProc.body.handledAt).toBeDefined();

      // Đi lùi: PROCESSING -> OPEN -> 400 VALIDATION_ERROR
      const resBack = await request(t.server)
        .patch(`/admin/reports/${report.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'OPEN' })
        .expect(400);

      expect(resBack.body.code).toBe('VALIDATION_ERROR');

      // PROCESSING -> CLOSED
      const resClosed = await request(t.server)
        .patch(`/admin/reports/${report.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'CLOSED' })
        .expect(200);

      expect(resClosed.body.status).toBe('CLOSED');

      // Đi lùi: CLOSED -> PROCESSING -> 400 VALIDATION_ERROR
      const resClosedBack = await request(t.server)
        .patch(`/admin/reports/${report.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'PROCESSING' })
        .expect(400);

      expect(resClosedBack.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Dashboard tổng quan (AC-35-03)', () => {
    it('số liệu dashboard khớp dữ liệu thực tế', async () => {
      await t.prisma.report.create({
        data: {
          matchId: 1n,
          reporterId: player.id,
          reportedUserId: player2.id,
          reason: ReportReason.SPAM,
          status: ReportStatus.OPEN,
        },
      });

      const res = await request(t.server)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        totalUsers: 4, // 2 admin + 2 player
        totalMatches: 0,
        todayMatches: 0,
        openReports: 1,
        onlineUsers: 0,
      });
    });
  });
});
