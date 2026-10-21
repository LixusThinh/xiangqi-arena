/**
 * XQA-69 e2e: Room REST (tạo, danh sách, vào, rời; public/private).
 * AC1: phòng đủ 2 người chuyển PLAYING. AC2: phòng private không có trong danh sách. AC3: có e2e test.
 */
import * as request from 'supertest';
import { RoomService } from '../src/room/room.service';
import {
  createTestApp,
  loginAs,
  seedRuleProfiles,
  seedUser,
  TestApp,
} from './support/test-app';

describe('XQA-69 Room REST (e2e)', () => {
  let t: TestApp;
  let host: string;
  let guest: string;
  let third: string;

  beforeEach(async () => {
    t = await createTestApp();
    await seedRuleProfiles(t.prisma);
    await seedUser(t.prisma, { username: 'host1', displayName: 'Chủ Phòng' });
    await seedUser(t.prisma, { username: 'guest1', displayName: 'Khách' });
    await seedUser(t.prisma, { username: 'third1', displayName: 'Người Thứ Ba' });
    host = await loginAs(t.server, 'host1');
    guest = await loginAs(t.server, 'guest1');
    third = await loginAs(t.server, 'third1');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await t.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createRoom(token: string, body: object = {}) {
    const res = await request(t.server).post('/rooms').set(auth(token)).send(body).expect(201);
    return res.body as {
      code: string;
      status: string;
      visibility: string;
      members: { username: string; color: string | null; isHost: boolean }[];
      matchId: string | null;
      name: string;
    };
  }

  describe('POST /rooms', () => {
    it('tạo phòng mặc định: WAITING, PUBLIC, RANDOM, VN_STANDARD, chủ phòng là thành viên', async () => {
      const room = await createRoom(host);
      expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(room).toMatchObject({
        name: 'Phòng của Chủ Phòng',
        status: 'WAITING',
        visibility: 'PUBLIC',
        hostColorPref: 'RANDOM',
        ruleProfile: { code: 'VN_STANDARD', baseTimeSec: 600, incrementSec: 0, isRanked: false },
        host: { username: 'host1', displayName: 'Chủ Phòng' },
        playerCount: 1,
        matchId: null,
      });
      expect(room.members).toEqual([
        expect.objectContaining({ username: 'host1', isHost: true, color: null }),
      ]);
    });

    it('tạo phòng với tùy chọn PRIVATE, BLACK, ONLINE_RAPID, tên tự đặt', async () => {
      const room = await createRoom(host, {
        name: '  Phòng luyện tập  ',
        visibility: 'PRIVATE',
        hostColorPref: 'BLACK',
        ruleProfileCode: 'ONLINE_RAPID',
      });
      expect(room).toMatchObject({
        name: 'Phòng luyện tập',
        visibility: 'PRIVATE',
        hostColorPref: 'BLACK',
        ruleProfile: { code: 'ONLINE_RAPID' },
      });
    });

    it.each([
      ['visibility sai', { visibility: 'SECRET' }, 'visibility'],
      ['hostColorPref sai', { hostColorPref: 'GREEN' }, 'hostColorPref'],
      ['tên 81 ký tự', { name: 'x'.repeat(81) }, 'name'],
      ['tên toàn khoảng trắng', { name: '   ' }, 'name'],
      ['ruleProfileCode không tồn tại', { ruleProfileCode: 'BLITZ_1' }, 'ruleProfileCode'],
    ])('%s → 400 VALIDATION_ERROR', async (_name, body, field) => {
      const res = await request(t.server).post('/rooms').set(auth(host)).send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('đang ở một phòng chưa xong thì không tạo phòng khác → 409 ROOM_USER_BUSY', async () => {
      await createRoom(host);
      const res = await request(t.server).post('/rooms').set(auth(host)).send({}).expect(409);
      expect(res.body.code).toBe('ROOM_USER_BUSY');
    });

    it('chưa đăng nhập → 401', async () => {
      await request(t.server).post('/rooms').send({}).expect(401);
      await request(t.server).get('/rooms').expect(401);
    });
  });

  describe('GET /rooms (Sảnh)', () => {
    it('AC2: chỉ liệt kê phòng PUBLIC đang WAITING; phòng PRIVATE không có trong danh sách', async () => {
      const pub = await createRoom(host, { visibility: 'PUBLIC' });
      const priv = await createRoom(guest, { visibility: 'PRIVATE' });

      const res = await request(t.server).get('/rooms').set(auth(third)).expect(200);
      const codes = (res.body as { code: string }[]).map((r) => r.code);
      expect(codes).toContain(pub.code);
      expect(codes).not.toContain(priv.code);
    });

    it('phòng đã đủ người hoặc đã hủy biến mất khỏi danh sách', async () => {
      const full = await createRoom(host);
      await request(t.server).post(`/rooms/${full.code}/join`).set(auth(guest)).expect(200);
      const cancelled = await createRoom(third);
      await request(t.server).post(`/rooms/${cancelled.code}/leave`).set(auth(third)).expect(204);

      const res = await request(t.server).get('/rooms').set(auth(third)).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /rooms/:code/join', () => {
    it('AC1: người thứ 2 vào → PLAYING, chia màu theo lựa chọn chủ phòng, tạo Match', async () => {
      const room = await createRoom(host, { hostColorPref: 'BLACK' });
      const res = await request(t.server)
        .post(`/rooms/${room.code}/join`)
        .set(auth(guest))
        .expect(200);

      expect(res.body.status).toBe('PLAYING');
      expect(res.body.playerCount).toBe(2);
      expect(res.body.matchId).toMatch(/^\d+$/);
      const colors = Object.fromEntries(
        (res.body.members as { username: string; color: string }[]).map((m) => [m.username, m.color]),
      );
      expect(colors).toEqual({ host1: 'BLACK', guest1: 'RED' });

      const [match] = t.prisma.rows('match');
      expect(match).toMatchObject({ status: 'WAITING', redTimeLeftMs: 600000n, blackTimeLeftMs: 600000n });

      // chủ phòng nhìn thấy cùng trạng thái (màn Phòng chờ – XQA-71 – dựa vào đây để vào ván)
      const seenByHost = await request(t.server).get(`/rooms/${room.code}`).set(auth(host)).expect(200);
      expect(seenByHost.body.status).toBe('PLAYING');
      expect(seenByHost.body.matchId).toBe(res.body.matchId);
    });

    it('RANDOM chia màu ngẫu nhiên nhưng mỗi bên đúng 1 màu', async () => {
      jest.spyOn(RoomService.prototype as unknown as { randomColor: () => string }, 'randomColor').mockReturnValue('RED');
      const room = await createRoom(host, { hostColorPref: 'RANDOM' });
      const res = await request(t.server).post(`/rooms/${room.code}/join`).set(auth(guest)).expect(200);
      const colors = (res.body.members as { username: string; color: string }[]).map((m) => [m.username, m.color]);
      expect(Object.fromEntries(colors)).toEqual({ host1: 'RED', guest1: 'BLACK' });
    });

    it('phòng PRIVATE vẫn vào được bằng mã (link mời), mã không phân biệt hoa/thường', async () => {
      const room = await createRoom(host, { visibility: 'PRIVATE' });
      const res = await request(t.server)
        .post(`/rooms/${room.code.toLowerCase()}/join`)
        .set(auth(guest))
        .expect(200);
      expect(res.body.status).toBe('PLAYING');
    });

    it('phòng đã đủ 2 người → người thứ 3 nhận 409 ROOM_FULL', async () => {
      const room = await createRoom(host);
      await request(t.server).post(`/rooms/${room.code}/join`).set(auth(guest)).expect(200);
      const res = await request(t.server).post(`/rooms/${room.code}/join`).set(auth(third)).expect(409);
      expect(res.body.code).toBe('ROOM_FULL');
    });

    it('vào lại phòng mình đang ở → 200, không tạo thêm thành viên', async () => {
      const room = await createRoom(host);
      await request(t.server).post(`/rooms/${room.code}/join`).set(auth(host)).expect(200);
      expect(t.prisma.rows('roomMember')).toHaveLength(1);
      expect(t.prisma.rows('room')[0].status).toBe('WAITING');
    });

    it('phòng đã hủy → 409 ROOM_CLOSED', async () => {
      const room = await createRoom(host);
      await request(t.server).post(`/rooms/${room.code}/leave`).set(auth(host)).expect(204);
      const res = await request(t.server).post(`/rooms/${room.code}/join`).set(auth(guest)).expect(409);
      expect(res.body.code).toBe('ROOM_CLOSED');
    });

    it.each([['ZZZZZZZZ'], ['abc'], ['current-x']])(
      'mã %s không tồn tại → 404 ROOM_NOT_FOUND',
      async (code) => {
        const res = await request(t.server).post(`/rooms/${code}/join`).set(auth(guest)).expect(404);
        expect(res.body.code).toBe('ROOM_NOT_FOUND');
      },
    );

    it('đang chờ ở phòng mình thì không vào phòng người khác → 409 ROOM_USER_BUSY', async () => {
      const mine = await createRoom(guest);
      const other = await createRoom(host);
      const res = await request(t.server).post(`/rooms/${other.code}/join`).set(auth(guest)).expect(409);
      expect(res.body.code).toBe('ROOM_USER_BUSY');
      expect(res.body.message).toContain(mine.code);
    });
  });

  describe('POST /rooms/:code/leave', () => {
    it('chủ phòng rời khi đang chờ → 204, phòng CANCELLED, được tạo phòng mới', async () => {
      const room = await createRoom(host);
      await request(t.server).post(`/rooms/${room.code}/leave`).set(auth(host)).expect(204);
      const res = await request(t.server).get(`/rooms/${room.code}`).set(auth(host)).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      await createRoom(host);
    });

    it('ván đã bắt đầu → 409 ROOM_ALREADY_STARTED', async () => {
      const room = await createRoom(host);
      await request(t.server).post(`/rooms/${room.code}/join`).set(auth(guest)).expect(200);
      for (const token of [host, guest]) {
        const res = await request(t.server).post(`/rooms/${room.code}/leave`).set(auth(token)).expect(409);
        expect(res.body.code).toBe('ROOM_ALREADY_STARTED');
      }
    });

    it('không phải thành viên → 403 ROOM_NOT_MEMBER', async () => {
      const room = await createRoom(host);
      const res = await request(t.server).post(`/rooms/${room.code}/leave`).set(auth(guest)).expect(403);
      expect(res.body.code).toBe('ROOM_NOT_MEMBER');
    });
  });

  describe('GET /rooms/current', () => {
    it('trả phòng đang ở, hoặc null nếu không ở phòng nào', async () => {
      const none = await request(t.server).get('/rooms/current').set(auth(host)).expect(200);
      expect(none.body).toEqual({ room: null });

      const room = await createRoom(host);
      const res = await request(t.server).get('/rooms/current').set(auth(host)).expect(200);
      expect(res.body.room.code).toBe(room.code);
    });
  });
});
