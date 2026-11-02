/**
 * XQA-141 e2e: đồng hồ thi đấu chỉ do server tính (Story XQA-36, FR-16).
 * Profile ONLINE_RAPID: 300 giây + 2 giây/nước. Để test hết giờ chạy nhanh, test sửa thẳng thời gian còn lại
 * trong DB giả (giống cách game-reconnect hạ thời gian chờ).
 */
import { AddressInfo } from 'node:net';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp, loginAs, seedRuleProfiles, seedUser, TestApp } from './support/test-app';

interface Ack<T = StateBody> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface StateBody {
  matchId: string;
  status: string;
  ply: number;
  result: string | null;
  endReason: string | null;
  redTimeLeftMs: number;
  blackTimeLeftMs: number;
  clockRunning: string | null;
  incrementMs: number;
  serverTime: string;
  moves: unknown[];
}

const BASE_MS = 300_000;
const INCREMENT_MS = 2_000;

describe('XQA-141 đồng hồ server-side (e2e)', () => {
  let t: TestApp;
  let url: string;
  let red: string;
  let black: string;
  let matchId: string;
  const sockets: Socket[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const matchRow = () => t.prisma.rows('match')[0];

  function connect(token: string): Socket {
    const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    return socket;
  }

  async function joinedPlayer(token: string): Promise<Socket> {
    const socket = connect(token);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const ack = await emit(socket, 'game:join', { matchId });
    expect(ack.ok).toBe(true);
    return socket;
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

  /** Đặt thời gian còn lại của Đỏ (bên tới lượt ở ply 0) tính từ bây giờ. */
  function setRedClock(ms: number): void {
    const row = matchRow();
    row.redTimeLeftMs = BigInt(ms);
    row.turnStartedAt = new Date();
  }

  beforeEach(async () => {
    t = await createTestApp();
    await t.app.listen(0);
    const { port } = t.server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    await seedRuleProfiles(t.prisma);
    await seedUser(t.prisma, { username: 'redp' });
    await seedUser(t.prisma, { username: 'blackp' });
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    const room = await request(t.server)
      .post('/rooms')
      .set(auth(red))
      .send({ hostColorPref: 'RED', ruleProfileCode: 'ONLINE_RAPID' })
      .expect(201);
    const joined = await request(t.server).post(`/rooms/${room.body.code}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await t.close();
  });

  it('AC1: GameState có đồng hồ do server chụp; Đỏ tới lượt thì chỉ đồng hồ Đỏ chạy', async () => {
    const state = await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    expect(state.body).toMatchObject({ status: 'ACTIVE', clockRunning: 'RED', incrementMs: INCREMENT_MS });
    expect(state.body.blackTimeLeftMs).toBe(BASE_MS);
    expect(state.body.redTimeLeftMs).toBeLessThanOrEqual(BASE_MS);
    expect(state.body.redTimeLeftMs).toBeGreaterThan(BASE_MS - 1_000);
    expect(Number.isNaN(Date.parse(String(state.body.serverTime)))).toBe(false);
  });

  it('AC2: đi quân → trừ thời gian suy nghĩ của người đi + cộng increment, đồng hồ chuyển sang bên kia', async () => {
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    await sleep(400);
    const moved = await request(t.server)
      .post(`/matches/${matchId}/moves`)
      .set(auth(red))
      .send({ from: 'h7', to: 'e7', expectedPly: 0 })
      .expect(200);
    const redLeft = moved.body.redTimeLeftMs as number;
    // 300 000 − ~400ms suy nghĩ + 2 000 increment
    expect(redLeft).toBeLessThanOrEqual(BASE_MS + INCREMENT_MS - 400);
    expect(redLeft).toBeGreaterThan(BASE_MS + INCREMENT_MS - 1_500);
    expect(moved.body).toMatchObject({ ply: 1, clockRunning: 'BLACK' });
    expect(Number(matchRow().redTimeLeftMs)).toBe(redLeft);
  });

  it('AC3: client gửi kèm thời gian trong game:move → server bỏ qua, chỉ dùng giờ của mình', async () => {
    const r = await joinedPlayer(red);
    await joinedPlayer(black);
    const ack = await emit(r, 'game:move', {
      matchId,
      from: 'h7',
      to: 'e7',
      expectedPly: 0,
      redTimeLeftMs: 999_999_999,
      blackTimeLeftMs: 1,
    });
    expect(ack.ok).toBe(true);
    expect(ack.data!.redTimeLeftMs).toBeLessThanOrEqual(BASE_MS + INCREMENT_MS);
    expect(ack.data!.blackTimeLeftMs).toBeGreaterThan(BASE_MS - 1_000);
  });

  it('AC4: hết giờ trong lúc chờ → server tự xử thua (TIMEOUT) và phát game:end, không cần client báo', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    setRedClock(600);
    // join lại để server hẹn giờ theo đồng hồ mới trong DB
    await emit(b, 'game:join', { matchId });
    const end = next<Record<string, unknown>>(r, 'game:end', 3000);
    const update = next<StateBody>(b, 'game:update', 3000);
    expect(await end).toMatchObject({ matchId, result: 'BLACK_WIN', endReason: 'TIMEOUT' });
    expect(await update).toMatchObject({ status: 'FINISHED', clockRunning: null, redTimeLeftMs: 0 });
    expect(matchRow()).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', endReason: 'TIMEOUT' });
    expect(Number(matchRow().redTimeLeftMs)).toBe(0);
  });

  it('AC5: đi quân sau khi đã hết giờ → nước không được ghi, ván kết thúc TIMEOUT', async () => {
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    setRedClock(0);
    const res = await request(t.server)
      .post(`/matches/${matchId}/moves`)
      .set(auth(red))
      .send({ from: 'h7', to: 'e7', expectedPly: 0 })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', endReason: 'TIMEOUT', ply: 0 });
    expect(res.body.moves).toHaveLength(0);
    expect(t.prisma.rows('move')).toHaveLength(0);
  });

  it('AC6: server ngủ (không có hẹn giờ) rồi có người tải ván sau hạn → vẫn chốt TIMEOUT', async () => {
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    setRedClock(200);
    await sleep(350);
    const res = await request(t.server).get(`/matches/${matchId}`).set(auth(black)).expect(200);
    expect(res.body).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', endReason: 'TIMEOUT' });
  });

  it('AC7: xin thua → đồng hồ dừng, thời gian còn lại giữ nguyên sau đó', async () => {
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    await sleep(300);
    const ended = await request(t.server).post(`/matches/${matchId}/resign`).set(auth(red)).expect(200);
    expect(ended.body).toMatchObject({ status: 'FINISHED', endReason: 'RESIGNATION', clockRunning: null });
    const frozen = ended.body.redTimeLeftMs as number;
    expect(frozen).toBeLessThanOrEqual(BASE_MS - 300);
    await sleep(300);
    const later = await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    expect(later.body.redTimeLeftMs).toBe(frozen);
  });

  it('AC8: hết giờ thì không xin hòa / xin thua được nữa (GAME_NOT_ACTIVE)', async () => {
    await request(t.server).get(`/matches/${matchId}`).set(auth(red)).expect(200);
    setRedClock(0);
    const res = await request(t.server).post(`/matches/${matchId}/resign`).set(auth(red)).expect(409);
    expect(res.body.code).toBe('GAME_NOT_ACTIVE');
    expect(matchRow()).toMatchObject({ status: 'FINISHED', endReason: 'TIMEOUT', result: 'BLACK_WIN' });
  });
});
