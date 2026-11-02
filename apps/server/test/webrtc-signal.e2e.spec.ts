/**
 * XQA-124 e2e: signaling WebRTC qua Socket.IO (Story XQA-32 – gọi video với đối thủ trong ván).
 * Server chỉ chuyển tiếp tín hiệu giữa 2 người chơi của cùng ván; không đọc nội dung SDP / ICE.
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

interface Signal {
  matchId: string;
  from: string;
  kind: string;
  data: unknown;
}

describe('XQA-124 signaling WebRTC (e2e)', () => {
  let t: TestApp;
  let url: string;
  let red: string;
  let black: string;
  let outsider: string;
  let matchId: string;
  const sockets: Socket[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function connect(token: string): Promise<Socket> {
    const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  }

  async function joinedPlayer(token: string): Promise<Socket> {
    const socket = await connect(token);
    const ack = await emit(socket, 'game:join', { matchId });
    expect(ack.ok).toBe(true);
    return socket;
  }

  function emit<T = Record<string, unknown>>(socket: Socket, event: string, payload: unknown): Promise<Ack<T>> {
    return socket.timeout(3000).emitWithAck(event, payload) as Promise<Ack<T>>;
  }

  function next<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeEach(async () => {
    t = await createTestApp();
    await t.app.listen(0);
    const { port } = t.server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    await seedRuleProfiles(t.prisma);
    await seedUser(t.prisma, { username: 'redp' });
    await seedUser(t.prisma, { username: 'blackp' });
    await seedUser(t.prisma, { username: 'outsider' });
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    outsider = await loginAs(t.server, 'outsider');
    const room = await request(t.server).post('/rooms').set(auth(red)).send({ hostColorPref: 'RED' }).expect(201);
    const joined = await request(t.server).post(`/rooms/${room.body.code}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await t.close();
  });

  it('AC1: Đỏ gửi offer → Đen nhận nguyên nội dung kèm from=RED; Đỏ không tự nhận lại', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const offer = { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' };
    const echo = jest.fn();
    r.on('webrtc:signal', echo);
    const got = next<Signal>(b, 'webrtc:signal');
    const ack = await emit<{ delivered: number }>(r, 'webrtc:signal', { matchId, kind: 'offer', data: offer });
    expect(ack).toEqual({ ok: true, data: { delivered: 1 } });
    expect(await got).toEqual({ matchId, from: 'RED', kind: 'offer', data: offer });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(echo).not.toHaveBeenCalled();
  });

  it('AC2: luồng gọi đủ 2 chiều (call → accept → answer → ice → hangup)', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    for (const [sender, receiver, kind, from] of [
      [r, b, 'call', 'RED'],
      [b, r, 'accept', 'BLACK'],
      [b, r, 'answer', 'BLACK'],
      [r, b, 'ice', 'RED'],
      [b, r, 'hangup', 'BLACK'],
    ] as const) {
      const got = next<Signal>(receiver, 'webrtc:signal');
      expect((await emit(sender, 'webrtc:signal', { matchId, kind, data: { n: 1 } })).ok).toBe(true);
      expect(await got).toMatchObject({ kind, from });
    }
  });

  it('AC3: đối thủ chưa mở màn ván → delivered = 0 (FE báo đối thủ chưa sẵn sàng)', async () => {
    const r = await joinedPlayer(red);
    const ack = await emit<{ delivered: number }>(r, 'webrtc:signal', { matchId, kind: 'call' });
    expect(ack).toEqual({ ok: true, data: { delivered: 0 } });
  });

  it('AC4: người ngoài ván / chưa join không gửi được tín hiệu (GAME_NOT_JOINED)', async () => {
    await joinedPlayer(black);
    const o = await connect(outsider);
    const ack = await emit(o, 'webrtc:signal', { matchId, kind: 'call' });
    expect(ack).toMatchObject({ ok: false, error: { code: 'GAME_NOT_JOINED' } });
    // Người ngoài cố game:join cũng bị chặn → vẫn không gửi được
    expect((await emit(o, 'game:join', { matchId })).ok).toBe(false);
    expect((await emit(o, 'webrtc:signal', { matchId, kind: 'call' })).ok).toBe(false);
  });

  it('AC5: payload sai loại / quá lớn bị từ chối (VALIDATION_ERROR), không chuyển tiếp', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const leak = jest.fn();
    b.on('webrtc:signal', leak);
    expect(await emit(r, 'webrtc:signal', { matchId, kind: 'game:move' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(await emit(r, 'webrtc:signal', { matchId, kind: 'offer', data: 'x'.repeat(40_000) })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(leak).not.toHaveBeenCalled();
  });
});
