/**
 * XQA-93 e2e: mất kết nối / vào lại, giữ ván trong thời gian chờ (RuleProfile.reconnectGraceSec).
 * Story XQA-25. FR-22, NFR-07.
 * Thời gian chờ trong test hạ xuống 1 giây (sửa RuleProfile trong DB giả) để test chạy nhanh;
 * production dùng 60 giây từ seed.
 */
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
}

const GRACE_SEC = 1;

describe('XQA-93 mất kết nối / vào lại ván (e2e)', () => {
  let t: TestApp;
  let url: string;
  let red: string;
  let black: string;
  let matchId: string;
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
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    const room = await request(t.server).post('/rooms').set(auth(red)).send({ hostColorPref: 'RED' }).expect(201);
    const joined = await request(t.server).post(`/rooms/${room.body.code}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await t.close();
  });

  it('AC1: Đỏ rớt mạng → Đen nhận player:disconnected, GameState có disconnected, ván vẫn ACTIVE', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const notice = next<Record<string, unknown>>(b, 'player:disconnected');
    r.disconnect();
    const payload = await notice;
    expect(payload).toMatchObject({ matchId, color: 'RED', graceSec: GRACE_SEC });
    expect(Date.parse(payload.deadline as string)).toBeGreaterThan(Date.now());

    const state = await request(t.server).get(`/matches/${matchId}`).set(auth(black)).expect(200);
    expect(state.body).toMatchObject({ status: 'ACTIVE', disconnected: [{ color: 'RED' }] });
    expect(matchRow().status).toBe('ACTIVE');
  });

  it('AC2: vào lại trong thời gian chờ → khôi phục đúng thế cờ + lượt, Đen nhận player:reconnected, không bị xử thua', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    await emit(r, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: 0 });
    const lost = next(b, 'player:disconnected');
    r.disconnect();
    await lost;

    const back = next<Record<string, unknown>>(b, 'player:reconnected');
    const r2 = connect(red);
    await connected(r2);
    const ack = await emit<StateBody & { ply: number; turn: string; yourColor: string }>(r2, 'game:join', { matchId });
    expect(ack.data).toMatchObject({ status: 'ACTIVE', ply: 1, turn: 'BLACK', yourColor: 'RED', disconnected: [] });
    expect(await back).toEqual({ matchId, color: 'RED' });

    await sleep(GRACE_SEC * 1000 + 400);
    expect(matchRow()).toMatchObject({ status: 'ACTIVE', result: null });
  });

  it('AC2: quá thời gian chờ → bên mất kết nối thua (DISCONNECT), Đen nhận game:end', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const end = next<Record<string, unknown>>(b, 'game:end', GRACE_SEC * 1000 + 2000);
    const update = next<StateBody>(b, 'game:update', GRACE_SEC * 1000 + 2000);
    r.disconnect();
    expect(await end).toEqual({ matchId, result: 'BLACK_WIN', endReason: 'DISCONNECT', endRule: null });
    expect(await update).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', disconnected: [] });
    expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', endReason: 'DISCONNECT' });
    expect(t.prisma.rows('room')[0].status).toBe('FINISHED');
  });

  it('mở 2 tab: đóng 1 tab không tính là mất kết nối', async () => {
    const r1 = await joinedPlayer(red);
    await joinedPlayer(red);
    const b = await joinedPlayer(black);
    let notified = false;
    b.on('player:disconnected', () => (notified = true));
    r1.disconnect();
    await sleep(GRACE_SEC * 1000 + 400);
    expect(notified).toBe(false);
    expect(matchRow().status).toBe('ACTIVE');
  });

  it('BR-RECON-01: cả hai cùng mất kết nối quá hạn → ván ABORTED, không ai thắng', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    r.disconnect();
    b.disconnect();
    await sleep(GRACE_SEC * 1000 + 600);
    expect(matchRow()).toMatchObject({ status: 'ABORTED', result: null, endReason: 'DISCONNECT' });
  });

  it('ván đã kết thúc thì rời đi không bị giữ ván / không xử lại', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    await emit(r, 'game:resign', { matchId });
    let notified = false;
    b.on('player:disconnected', () => (notified = true));
    r.disconnect();
    await sleep(GRACE_SEC * 1000 + 400);
    expect(notified).toBe(false);
    expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', endReason: 'RESIGNATION' });
  });

  it('ván kết thúc trong lúc chờ (đối thủ xin thua) → hết giờ không ghi đè kết quả', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const lost = next(b, 'player:disconnected');
    r.disconnect();
    await lost;
    await emit(b, 'game:resign', { matchId });
    await sleep(GRACE_SEC * 1000 + 400);
    expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'RED_WIN', endReason: 'RESIGNATION' });
  });
});
