/**
 * XQA-75 e2e: Socket.IO game events (game:join, game:move → game:update / game:end).
 * AC: người ngoài phòng gửi event bị từ chối; integration test 2 client.
 * FR-10, FR-11, BR-03, NFR-06.
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
  ply: number;
  turn: string | null;
  fen: string;
  yourColor: string | null;
  status: string;
  lastMove: { from: string; to: string } | null;
}

describe('XQA-75 Socket game events (e2e)', () => {
  let t: TestApp;
  let url: string;
  let red: string;
  let black: string;
  let outsider: string;
  let matchId: string;
  let roomCode: string;
  const sockets: Socket[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  function connect(token?: string): Socket {
    const socket = io(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
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

  function next<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 3000);
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

  beforeEach(async () => {
    t = await createTestApp();
    await t.app.listen(0);
    const { port } = t.server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    await seedRuleProfiles(t.prisma);
    await seedUser(t.prisma, { username: 'redp' });
    await seedUser(t.prisma, { username: 'blackp' });
    await seedUser(t.prisma, { username: 'other' });
    red = await loginAs(t.server, 'redp');
    black = await loginAs(t.server, 'blackp');
    outsider = await loginAs(t.server, 'other');
    const room = await request(t.server).post('/rooms').set(auth(red)).send({ hostColorPref: 'RED' }).expect(201);
    roomCode = room.body.code;
    const joined = await request(t.server).post(`/rooms/${roomCode}/join`).set(auth(black)).expect(200);
    matchId = joined.body.matchId;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await t.close();
  });

  it('kết nối không có JWT bị từ chối (AUTH_TOKEN_MISSING)', async () => {
    const socket = connect();
    const error = await connected(socket).then(
      () => null,
      (e: Error & { data?: { code: string } }) => e,
    );
    expect(error?.data?.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('kết nối với token sai bị từ chối (AUTH_TOKEN_INVALID)', async () => {
    const socket = connect('not-a-jwt');
    const error = await connected(socket).then(
      () => null,
      (e: Error & { data?: { code: string } }) => e,
    );
    expect(error?.data?.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('token của phiên đã logout bị từ chối (AUTH_SESSION_REVOKED)', async () => {
    const login = await request(t.server)
      .post('/auth/login')
      .send({ identifier: 'other', password: 'Player-dev-2026!' })
      .expect(200);
    const { accessToken, refreshToken } = login.body as { accessToken: string; refreshToken: string };
    await request(t.server).post('/auth/logout').set(auth(accessToken)).send({ refreshToken }).expect(204);
    const socket = connect(accessToken);
    const error = await connected(socket).then(
      () => null,
      (e: Error & { data?: { code: string } }) => e,
    );
    expect(error?.data?.code).toBe('AUTH_SESSION_REVOKED');
  });

  it('người chơi join được bằng matchId hoặc roomCode, nhận đúng màu', async () => {
    const r = connect(red);
    const b = connect(black);
    await Promise.all([connected(r), connected(b)]);
    const ackRed = await emit(r, 'game:join', { matchId });
    const ackBlack = await emit(b, 'game:join', { roomCode });
    expect(ackRed).toMatchObject({ ok: true, data: { matchId, yourColor: 'RED', turn: 'RED', ply: 0 } });
    expect(ackBlack).toMatchObject({ ok: true, data: { matchId, yourColor: 'BLACK' } });
  });

  it('AC1: người ngoài phòng join bị từ chối GAME_NOT_PLAYER', async () => {
    const o = connect(outsider);
    await connected(o);
    const ack = await emit(o, 'game:join', { matchId });
    expect(ack).toMatchObject({ ok: false, error: { code: 'GAME_NOT_PLAYER' } });
  });

  it('AC1: người ngoài phòng gửi game:move bị từ chối, không ghi nước', async () => {
    const o = connect(outsider);
    await connected(o);
    const ack = await emit(o, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: 0 });
    expect(ack).toMatchObject({ ok: false, error: { code: 'GAME_NOT_JOINED' } });
    expect(t.prisma.rows('move')).toHaveLength(0);
  });

  it('AC2: Đỏ đi trên client A → client B nhận game:update cùng thế cờ, đúng màu của B', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    const blackUpdate = next<StateBody>(b, 'game:update');
    const redUpdate = next<StateBody>(r, 'game:update');

    const ack = await emit(r, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: 0 });
    expect(ack).toMatchObject({ ok: true, data: { ply: 1, turn: 'BLACK', yourColor: 'RED' } });

    const [seenByBlack, seenByRed] = await Promise.all([blackUpdate, redUpdate]);
    expect(seenByBlack).toMatchObject({ ply: 1, turn: 'BLACK', yourColor: 'BLACK', lastMove: { from: 'h7', to: 'e7' } });
    expect(seenByRed.yourColor).toBe('RED');
    expect(seenByBlack.fen).toBe(ack.data?.fen);
  });

  it('sai lượt → GAME_NOT_YOUR_TURN, không phát game:update, thế cờ không đổi', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    let updates = 0;
    r.on('game:update', () => updates++);
    const ack = await emit(b, 'game:move', { matchId, from: 'h0', to: 'g2', expectedPly: 0 });
    expect(ack).toMatchObject({ ok: false, error: { code: 'GAME_NOT_YOUR_TURN' } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(updates).toBe(0);
    expect(t.prisma.rows('move')).toHaveLength(0);
  });

  it('gửi trùng cùng expectedPly → lần 2 bị GAME_STALE_STATE, chỉ 1 nước được ghi', async () => {
    const r = await joinedPlayer(red);
    await joinedPlayer(black);
    const payload = { matchId, from: 'h7', to: 'e7', expectedPly: 0 };
    const first = await emit(r, 'game:move', payload);
    const second = await emit(r, 'game:move', payload);
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: { code: 'GAME_STALE_STATE' } });
    expect(t.prisma.rows('move')).toHaveLength(1);
  });

  // Xe a9 lên a5 bị Tốt a6 chặn đường
  it('nước sai luật → GAME_ILLEGAL_MOVE', async () => {
    const r = await joinedPlayer(red);
    const ack = await emit(r, 'game:move', { matchId, from: 'a9', to: 'a5', expectedPly: 0 });
    expect(ack).toMatchObject({ ok: false, error: { code: 'GAME_ILLEGAL_MOVE' } });
  });

  it('payload sai định dạng → VALIDATION_ERROR', async () => {
    const r = await joinedPlayer(red);
    const ack = await emit(r, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: '0' });
    expect(ack).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    const join = await emit(r, 'game:join', {});
    expect(join).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('ván kết thúc qua socket (lặp nước Điều 24.2) → cả 2 client nhận game:end, đi tiếp bị GAME_NOT_ACTIVE', async () => {
    const r = await joinedPlayer(red);
    const b = await joinedPlayer(black);
    // Cùng chuỗi với game.e2e (XQA-74): hai bên lặp Mã 3 vòng → hòa REPETITION.
    const cycle: Array<[Socket, string, string]> = [
      [r, 'h9', 'g7'],
      [b, 'h0', 'g2'],
      [r, 'g7', 'h9'],
      [b, 'g2', 'h0'],
    ];
    const ends = [next<Record<string, unknown>>(r, 'game:end'), next<Record<string, unknown>>(b, 'game:end')];
    let ply = 0;
    let last: Ack<StateBody> | undefined;
    for (let round = 0; round < 2; round++) {
      for (const [socket, from, to] of cycle) {
        last = await emit(socket, 'game:move', { matchId, from, to, expectedPly: ply });
        expect(last.ok).toBe(true);
        ply++;
      }
    }
    expect(last?.data).toMatchObject({ status: 'FINISHED', turn: null });
    const [endRed, endBlack] = await Promise.all(ends);
    expect(endRed).toMatchObject({ matchId, result: 'DRAW', endReason: 'REPETITION' });
    expect(endBlack).toEqual(endRed);

    const after = await emit(r, 'game:move', { matchId, from: 'h9', to: 'g7', expectedPly: ply });
    expect(after).toMatchObject({ ok: false, error: { code: 'GAME_NOT_ACTIVE' } });
  });

  describe('XQA-91: xin thua / xin hòa qua socket', () => {
    it('game:resign → cả 2 client nhận game:update + game:end (RESIGNATION, đối thủ thắng)', async () => {
      const r = await joinedPlayer(red);
      const b = await joinedPlayer(black);
      const ends = [next<Record<string, unknown>>(r, 'game:end'), next<Record<string, unknown>>(b, 'game:end')];
      const blackUpdate = next<StateBody & { result: string }>(b, 'game:update');
      const ack = await emit(r, 'game:resign', { matchId });
      expect(ack).toMatchObject({ ok: true, data: { status: 'FINISHED' } });
      expect(await blackUpdate).toMatchObject({ status: 'FINISHED', result: 'BLACK_WIN', yourColor: 'BLACK' });
      for (const end of await Promise.all(ends)) {
        expect(end).toMatchObject({ matchId, result: 'BLACK_WIN', endReason: 'RESIGNATION' });
      }
    });

    it('AC1: đề nghị hòa → đối thủ nhận game:draw-offered; đồng ý → game:end DRAW_AGREEMENT', async () => {
      const r = await joinedPlayer(red);
      const b = await joinedPlayer(black);
      const offered = next<Record<string, unknown>>(b, 'game:draw-offered');
      const offerAck = await emit(r, 'game:draw-offer', { matchId });
      expect(offerAck).toMatchObject({ ok: true, data: { drawOffer: { by: 'RED', atPly: 0 } } });
      expect(await offered).toEqual({ matchId, by: 'RED', atPly: 0 });

      const ends = [next<Record<string, unknown>>(r, 'game:end'), next<Record<string, unknown>>(b, 'game:end')];
      const accept = await emit(b, 'game:draw-accept', { matchId });
      expect(accept).toMatchObject({ ok: true, data: { status: 'FINISHED' } });
      for (const end of await Promise.all(ends)) {
        expect(end).toMatchObject({ matchId, result: 'DRAW', endReason: 'DRAW_AGREEMENT' });
      }
    });

    it('từ chối hòa → người đề nghị nhận game:draw-rejected, ván tiếp tục, không có game:end', async () => {
      const r = await joinedPlayer(red);
      const b = await joinedPlayer(black);
      await emit(r, 'game:draw-offer', { matchId });
      let ended = false;
      r.on('game:end', () => (ended = true));
      const rejected = next<Record<string, unknown>>(r, 'game:draw-rejected');
      const ack = await emit(b, 'game:draw-reject', { matchId });
      expect(ack).toMatchObject({ ok: true, data: { status: 'ACTIVE', drawOffer: null } });
      expect(await rejected).toEqual({ matchId, by: 'BLACK' });
      const moved = await emit(r, 'game:move', { matchId, from: 'h7', to: 'e7', expectedPly: 0 });
      expect(moved.ok).toBe(true);
      expect(ended).toBe(false);
    });

    it('người ngoài / chưa join gửi game:resign, game:draw-* → GAME_NOT_JOINED, ván không đổi', async () => {
      const o = connect(outsider);
      await connected(o);
      for (const event of ['game:resign', 'game:draw-offer', 'game:draw-accept', 'game:draw-reject']) {
        const ack = await emit(o, event, { matchId });
        expect(ack).toMatchObject({ ok: false, error: { code: 'GAME_NOT_JOINED' } });
      }
      expect(t.prisma.rows('match')[0]).toMatchObject({ result: null, endReason: null });
      expect(t.prisma.rows('match')[0].status).not.toBe('FINISHED');
      expect(t.prisma.rows('drawOffer')).toHaveLength(0);
    });

    it('payload sai → VALIDATION_ERROR; tự đồng ý đề nghị của mình → GAME_DRAW_OFFER_OWN', async () => {
      const r = await joinedPlayer(red);
      expect(await emit(r, 'game:resign', {})).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
      await emit(r, 'game:draw-offer', { matchId });
      const own = await emit(r, 'game:draw-accept', { matchId });
      expect(own).toMatchObject({ ok: false, error: { code: 'GAME_DRAW_OFFER_OWN' } });
    });
  });
});
