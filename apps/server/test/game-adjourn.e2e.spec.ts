import { AddressInfo } from 'node:net';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

interface Ack<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface StateBody {
  matchId: string;
  status: string;
  result: string | null;
  endReason: string | null;
  disconnected: Array<{ color: string; deadline: string }>;
  redTimeLeftMs: number;
  blackTimeLeftMs: number;
  clockRunning: string | null;
  adjournedAt?: string | null;
}

const GRACE_SEC = 2;

describe('Hoãn ván online và chơi tiếp (e2e)', () => {
  let t: TestApp;
  let url: string;
  let red: string;
  let black: string;
  let other: string;
  let adminToken: string;
  let matchId: string;
  let roomCode: string;
  const sockets: Socket[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function connect(token: string): Socket {
    const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    return socket;
  }

  function connected(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
  }

  function emit<T = StateBody>(socket: Socket, event: string, payload: unknown): Promise<Ack<T>> {
    return socket.timeout(3000).emitWithAck(event, payload) as Promise<Ack<T>>;
  }

  function next<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  async function joinedPlayer(token: string): Promise<Socket> {
    const socket = connect(token);
    await connected(socket);
    const ack = await emit(socket, 'game:join', { matchId });
    expect(ack.ok).toBe(true);
    return socket;
  }

  const matchRow = () => t.prisma.rows('match')[0];

  beforeEach(async () => {
    t = await createTestApp();
    await t.app.listen(0);
    const { port } = t.server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    await seedRuleProfiles(t.prisma);
    for (const profile of t.prisma.rows('ruleProfile')) profile.reconnectGraceSec = GRACE_SEC;
    await seedUser(t.prisma, { username: 'redp' });
    await seedUser(t.prisma, { username: 'blackp' });
    await seedUser(t.prisma, { username: 'otherp' });
    await seedUser(t.prisma, { username: 'adminp', role: 'ADMIN' });
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    other = await loginAs(t.server, 'otherp');
    adminToken = await loginAs(t.server, 'adminp');
    const room = await request(t.server).post('/rooms').set(auth(red)).send({ hostColorPref: 'RED' }).expect(201);
    roomCode = room.body.code;
    const joined = await request(t.server).post(`/rooms/${roomCode}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await t.close();
  });

  it('hoãn hợp lệ: Đen rớt mạng → Đỏ gửi game:adjourn → thành công, status=ADJOURNED, đồng hồ đứng', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);

    // Đi 1 nước để trừ chút giờ
    await emit(r, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: 0 });

    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    const updatePromise = next<StateBody>(r, 'game:update');
    const ack = await emit<StateBody>(r, 'game:adjourn', { matchId });
    expect(ack.ok).toBe(true);
    expect(ack.data).toMatchObject({
      matchId,
      status: 'ADJOURNED',
      clockRunning: null,
      result: null,
      endReason: null,
    });
    expect(ack.data?.adjournedAt).toBeTruthy();

    const update = await updatePromise;
    expect(update.status).toBe('ADJOURNED');
    expect(update.clockRunning).toBeNull();

    expect(matchRow()).toMatchObject({ status: 'ADJOURNED', result: null, endReason: null });
    expect(matchRow().adjournedAt).not.toBeNull();
  });

  it('sai điều kiện hoãn: đối thủ chưa rớt mạng → OPPONENT_CONNECTED', async () => {
    const r = await joinedPlayer(red);
    await joinedPlayer(black);

    const ack = await emit(r, 'game:adjourn', { matchId });
    expect(ack.ok).toBe(false);
    expect(ack.error?.code).toBe('OPPONENT_CONNECTED');
  });

  it('sai điều kiện hoãn: người ngoài gửi game:adjourn → GAME_NOT_JOINED / GAME_NOT_PLAYER', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    const outSocket = connect(other);
    await connected(outSocket);
    const ack = await emit(outSocket, 'game:adjourn', { matchId });
    expect(ack.ok).toBe(false);
    expect(ack.error?.code).toBe('GAME_NOT_JOINED');
  });

  it('thời gian còn lại được trừ đúng vào bên đang tới lượt lúc hoãn', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);

    // Đi nước 0: Đỏ đi, lượt chuyển sang Đen (ply 1)
    await emit(r, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: 0 });

    // Đỏ rớt mạng lúc đang lượt Đen
    const discNotice = next(b, 'player:disconnected');
    r.disconnect();
    await discNotice;

    // Đen để trôi 300ms rồi mới hoãn
    await sleep(300);
    const beforeBlackMs = Number(matchRow().blackTimeLeftMs);
    const ack = await emit<StateBody>(b, 'game:adjourn', { matchId });
    expect(ack.ok).toBe(true);
    const afterAdjourn = matchRow();

    // blackTimeLeftMs phải bị trừ bớt
    expect(Number(afterAdjourn.blackTimeLeftMs)).toBeLessThan(beforeBlackMs);
    expect(afterAdjourn.turnStartedAt).toBeNull();
  });

  it('chơi tiếp: vào lại đủ 2 người → status=ACTIVE, turnStartedAt được cập nhật, đồng hồ chạy tiếp', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    await emit(r, 'game:adjourn', { matchId });
    expect(matchRow().status).toBe('ADJOURNED');

    // Đen kết nối lại và game:join
    const b2 = connect(black);
    await connected(b2);

    const rUpdatePromise = next<StateBody>(r, 'game:update');
    const ack = await emit<StateBody>(b2, 'game:join', { matchId });
    expect(ack.ok).toBe(true);
    expect(ack.data?.status).toBe('ACTIVE');
    expect(ack.data?.clockRunning).toBeTruthy();

    const rUpdate = await rUpdatePromise;
    expect(rUpdate.status).toBe('ACTIVE');

    expect(matchRow().status).toBe('ACTIVE');
    expect(matchRow().turnStartedAt).not.toBeNull();
  });

  it('xin thua ván hoãn: khi ván ADJOURNED, người chơi xin thua → ván kết thúc FINISHED như thường', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    await emit(r, 'game:adjourn', { matchId });
    expect(matchRow().status).toBe('ADJOURNED');

    // Đỏ xin thua ván đang hoãn
    const resignAck = await emit<StateBody>(r, 'game:resign', { matchId });
    expect(resignAck.ok).toBe(true);
    expect(resignAck.data?.status).toBe('FINISHED');
    expect(resignAck.data?.result).toBe('BLACK_WIN');
    expect(resignAck.data?.endReason).toBe('RESIGNATION');

    expect(matchRow()).toMatchObject({
      status: 'FINISHED',
      result: 'BLACK_WIN',
      endReason: 'RESIGNATION',
    });
  });

  it('có ván hoãn vẫn tạo phòng mới được, GET /rooms/current không trả phòng hoãn', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    await emit(r, 'game:adjourn', { matchId });
    expect(matchRow().status).toBe('ADJOURNED');

    // GET /rooms/current không trả phòng hoãn
    const currentRes = await request(t.server).get('/rooms/current').set(auth(red)).expect(200);
    expect(currentRes.body.room).toBeNull();

    // Đỏ tạo phòng mới thành công
    const newRoom = await request(t.server)
      .post('/rooms')
      .set(auth(red))
      .send({ name: 'Phòng mới của Đỏ' })
      .expect(201);
    expect(newRoom.body.code).toBeTruthy();
  });

  it('GET /me/adjourned-matches trả danh sách ván hoãn của mình', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    await emit(r, 'game:adjourn', { matchId });

    const res = await request(t.server).get('/me/adjourned-matches').set(auth(red)).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      matchId,
      roomCode,
      myColor: 'RED',
      plyCount: 0,
    });
    expect(res.body[0].opponent).toMatchObject({
      username: 'blackp',
    });
    expect(res.body[0].adjournedAt).toBeTruthy();
  });

  it('Admin: bộ lọc trạng thái nhận ADJOURNED', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const discNotice = next(r, 'player:disconnected');
    b.disconnect();
    await discNotice;

    await emit(r, 'game:adjourn', { matchId });

    const res = await request(t.server)
      .get('/admin/matches?status=ADJOURNED')
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: matchId,
      status: 'ADJOURNED',
    });
  });
});
