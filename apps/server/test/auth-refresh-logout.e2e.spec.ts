/**
 * XQA-66 e2e: refresh token rotation + logout vô hiệu token.
 * AC1: token đã logout gọi API trả 401. AC2: có e2e test.
 */
import * as request from 'supertest';
import { createTestApp, seedUser, TestApp, TEST_WEB_ORIGIN } from './support/test-app';

interface SessionBody {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

describe('XQA-66 refresh token + logout (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
    await seedUser(t.prisma, { username: 'player1', password: 'Player-dev-2026!' });
  });

  afterEach(async () => {
    await t.close();
  });

  async function login(): Promise<SessionBody> {
    const res = await request(t.server)
      .post('/auth/login')
      .send({ identifier: 'player1', password: 'Player-dev-2026!' })
      .expect(200);
    return res.body as SessionBody;
  }

  it('login trả refresh token 43 ký tự và thời hạn phiên', async () => {
    const session = await login();
    expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresIn).toBe(900);
    expect(session.refreshExpiresIn).toBeGreaterThan(7 * 24 * 3600 - 5);
    // DB chỉ giữ hash, không giữ token gốc
    const [stored] = t.prisma.rows('authSession');
    expect(stored.refreshTokenHash).toHaveLength(64);
    expect(stored.refreshTokenHash).not.toContain(session.refreshToken);
  });

  it('refresh trả cặp token mới và token mới dùng được cho /auth/me', async () => {
    const first = await login();
    const res = await request(t.server)
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    const second = res.body as SessionBody;
    expect(second.refreshToken).not.toBe(first.refreshToken);

    await request(t.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(200)
      .expect((r) => expect(r.body.username).toBe('player1'));
  });

  it('refresh token cũ bị từ chối sau khi đã đổi (rotation)', async () => {
    const first = await login();
    await request(t.server)
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    const reuse = await request(t.server)
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe('AUTH_REFRESH_INVALID');
  });

  it('AC1: sau logout, access token còn hạn gọi /auth/me trả 401 AUTH_SESSION_REVOKED', async () => {
    const session = await login();
    await request(t.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    await request(t.server)
      .post('/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    const res = await request(t.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(401);
    expect(res.body.code).toBe('AUTH_SESSION_REVOKED');
  });

  it('AC1: sau logout, refresh token cũng không đổi được nữa', async () => {
    const session = await login();
    await request(t.server)
      .post('/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    const res = await request(t.server)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
    expect(res.body.code).toBe('AUTH_REFRESH_INVALID');
  });

  it('logout một phiên không ảnh hưởng phiên khác của cùng tài khoản', async () => {
    const laptop = await login();
    const phone = await login();
    await request(t.server)
      .post('/auth/logout')
      .send({ refreshToken: laptop.refreshToken })
      .expect(204);

    await request(t.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${phone.accessToken}`)
      .expect(200);
  });

  it('logout gọi lại lần 2 hoặc với token không tồn tại vẫn 204 (idempotent)', async () => {
    const session = await login();
    for (let i = 0; i < 2; i++) {
      await request(t.server)
        .post('/auth/logout')
        .send({ refreshToken: session.refreshToken })
        .expect(204);
    }
    await request(t.server)
      .post('/auth/logout')
      .send({ refreshToken: 'A'.repeat(43) })
      .expect(204);
  });

  it('refresh token đã quá hạn phiên trả 401 AUTH_REFRESH_EXPIRED', async () => {
    const session = await login();
    const [stored] = t.prisma.rows('authSession');
    stored.expiresAt = new Date(Date.now() - 1000);

    const res = await request(t.server)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
    expect(res.body.code).toBe('AUTH_REFRESH_EXPIRED');
  });

  it('tài khoản bị khóa thì refresh trả 403 ACCOUNT_LOCKED và phiên bị thu hồi', async () => {
    const session = await login();
    const [user] = t.prisma.rows('user');
    user.accountStatus = 'LOCKED';

    const res = await request(t.server)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(403);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
    expect(t.prisma.rows('authSession')[0].revokedAt).toBeInstanceOf(Date);
  });

  it.each([
    ['thiếu refreshToken', {}],
    ['refreshToken sai định dạng', { refreshToken: 'abc' }],
    ['refreshToken không phải chuỗi', { refreshToken: 12345 }],
  ])('%s → 400 VALIDATION_ERROR', async (_name, body) => {
    const res = await request(t.server).post('/auth/refresh').send(body).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].field).toBe('refreshToken');
  });

  it('CORS cho phép origin web đã cấu hình', async () => {
    const res = await request(t.server)
      .options('/auth/refresh')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(TEST_WEB_ORIGIN);
  });
});
