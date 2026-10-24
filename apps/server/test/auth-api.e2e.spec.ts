/**
 * XQA-68 – Bộ test API Auth (register / login / me / refresh / logout) chạy trên CI.
 *
 * Đối chiếu: docs/api/auth.md (Contract v0.2), FR-01, FR-02, FR-03, NFR-04.
 * Mỗi `it` mang mã TC-AUTH-API-xx; bảng truy vết ở docs/qa/XQA-68-auth-api-test-report.md.
 * AC: phủ ca lỗi 400 / 401 / 409 · chạy trong CI (job "Test Suite" → pnpm --filter server test).
 */
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { createTestApp, seedUser, TestApp, TEST_JWT_SECRET } from './support/test-app';

interface ErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: { field: string; message: string }[];
}

interface SessionBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: Record<string, unknown>;
}

const VALID_REGISTER = {
  username: 'nguoichoi',
  email: 'player@example.com',
  password: 'example-pass-123',
  displayName: 'Nguoi Choi',
};

/** Mọi lỗi phải đúng format chung của contract. */
function expectErrorFormat(body: ErrorBody, statusCode: number, code: string): void {
  expect(body).toEqual(
    expect.objectContaining({
      statusCode,
      error: expect.any(String),
      code,
      message: expect.any(String),
    }),
  );
}

describe('XQA-68 Auth API test suite', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.close();
  });

  const register = (body: object) => request(t.server).post('/auth/register').send(body);
  const login = (body: object) => request(t.server).post('/auth/login').send(body);
  const me = (authorization?: string) => {
    const req = request(t.server).get('/auth/me');
    return authorization === undefined ? req : req.set('Authorization', authorization);
  };

  async function registerAndGetSession(): Promise<SessionBody> {
    const res = await register(VALID_REGISTER).expect(201);
    return res.body as SessionBody;
  }

  describe('POST /auth/register (FR-01)', () => {
    it('TC-AUTH-API-01: đăng ký hợp lệ → 201, trả session, không lộ password/hash', async () => {
      const res = await register(VALID_REGISTER).expect(201);
      const body = res.body as SessionBody;
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe(900);
      expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(body.user).toEqual({
        id: expect.stringMatching(/^\d+$/),
        username: 'nguoichoi',
        email: 'player@example.com',
        displayName: 'Nguoi Choi',
        role: 'PLAYER',
        rating: 1200,
        createdAt: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toMatch(/password/i);
    });

    it('TC-AUTH-API-02: mật khẩu lưu dạng bcrypt hash, không phải plaintext (NFR-04)', async () => {
      await register(VALID_REGISTER).expect(201);
      const [user] = t.prisma.rows('user');
      expect(user.passwordHash).not.toBe(VALID_REGISTER.password);
      expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    });

    it('TC-AUTH-API-03: username/email chuẩn hóa chữ thường, khoảng trắng bị cắt', async () => {
      const res = await register({
        ...VALID_REGISTER,
        username: '  NguoiChoi ',
        email: ' PLAYER@Example.com ',
        displayName: '  Nguoi Choi  ',
      }).expect(201);
      expect(res.body.user).toMatchObject({
        username: 'nguoichoi',
        email: 'player@example.com',
        displayName: 'Nguoi Choi',
      });
    });

    it('TC-AUTH-API-04: gửi kèm role=ADMIN không leo quyền (field lạ bị bỏ)', async () => {
      const res = await register({ ...VALID_REGISTER, role: 'ADMIN', rating: 3000 }).expect(201);
      expect(res.body.user.role).toBe('PLAYER');
      expect(res.body.user.rating).toBe(1200);
    });

    it.each([
      ['TC-AUTH-API-05', 'thiếu username', { ...VALID_REGISTER, username: undefined }, 'username'],
      ['TC-AUTH-API-06', 'username 2 ký tự', { ...VALID_REGISTER, username: 'ab' }, 'username'],
      ['TC-AUTH-API-07', 'username 31 ký tự', { ...VALID_REGISTER, username: 'a'.repeat(31) }, 'username'],
      ['TC-AUTH-API-08', 'username có ký tự đặc biệt', { ...VALID_REGISTER, username: 'ng<script>' }, 'username'],
      ['TC-AUTH-API-09', 'email sai định dạng', { ...VALID_REGISTER, email: 'not-an-email' }, 'email'],
      ['TC-AUTH-API-10', 'password 7 ký tự', { ...VALID_REGISTER, password: '1234567' }, 'password'],
      ['TC-AUTH-API-11', 'password 73 ký tự', { ...VALID_REGISTER, password: 'a'.repeat(73) }, 'password'],
      // 25 ký tự "ệ" = 75 byte UTF-8: qua được giới hạn ký tự nhưng vượt 72 byte của bcrypt
      ['TC-AUTH-API-12', 'password > 72 byte UTF-8', { ...VALID_REGISTER, password: 'ệ'.repeat(25) }, 'password'],
      ['TC-AUTH-API-13', 'displayName chỉ có khoảng trắng', { ...VALID_REGISTER, displayName: '   ' }, 'displayName'],
      ['TC-AUTH-API-14', 'displayName 81 ký tự', { ...VALID_REGISTER, displayName: 'x'.repeat(81) }, 'displayName'],
    ])('%s: %s → 400 VALIDATION_ERROR', async (_id, _name, body, field) => {
      const res = await register(body).expect(400);
      expectErrorFormat(res.body as ErrorBody, 400, 'VALIDATION_ERROR');
      expect((res.body as ErrorBody).details?.map((d) => d.field)).toContain(field);
      expect(t.prisma.rows('user')).toHaveLength(0);
    });

    it('TC-AUTH-API-15: username đã tồn tại (khác hoa/thường) → 409 AUTH_IDENTIFIER_TAKEN', async () => {
      await register(VALID_REGISTER).expect(201);
      const res = await register({
        ...VALID_REGISTER,
        username: 'NGUOICHOI',
        email: 'other@example.com',
      }).expect(409);
      expectErrorFormat(res.body as ErrorBody, 409, 'AUTH_IDENTIFIER_TAKEN');
    });

    it('TC-AUTH-API-16: email đã tồn tại (khác hoa/thường) → 409 AUTH_IDENTIFIER_TAKEN', async () => {
      await register(VALID_REGISTER).expect(201);
      const res = await register({
        ...VALID_REGISTER,
        username: 'nguoichoi2',
        email: 'Player@EXAMPLE.com',
      }).expect(409);
      expectErrorFormat(res.body as ErrorBody, 409, 'AUTH_IDENTIFIER_TAKEN');
      expect(t.prisma.rows('user')).toHaveLength(1);
    });
  });

  describe('POST /auth/login (FR-02)', () => {
    beforeEach(async () => {
      await seedUser(t.prisma, { username: 'player1', email: 'player1@xiangqi.local' });
    });

    it('TC-AUTH-API-17: đăng nhập bằng username → 200 + session', async () => {
      const res = await login({ identifier: 'player1', password: 'Player-dev-2026!' }).expect(200);
      expect(res.body.user.username).toBe('player1');
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('TC-AUTH-API-18: đăng nhập bằng email viết hoa → 200', async () => {
      await login({ identifier: 'PLAYER1@XIANGQI.LOCAL', password: 'Player-dev-2026!' }).expect(200);
    });

    it('TC-AUTH-API-19: sai mật khẩu → 401 AUTH_INVALID_CREDENTIALS', async () => {
      const res = await login({ identifier: 'player1', password: 'wrong-password' }).expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_INVALID_CREDENTIALS');
    });

    it('TC-AUTH-API-20: tài khoản không tồn tại trả ĐÚNG cùng lỗi với sai mật khẩu (không lộ user)', async () => {
      const wrongPass = await login({ identifier: 'player1', password: 'wrong-password' }).expect(401);
      const noUser = await login({ identifier: 'ghost', password: 'wrong-password' }).expect(401);
      expect(noUser.body).toEqual(wrongPass.body);
    });

    it.each([
      ['TC-AUTH-API-21', 'thiếu identifier', { password: 'Player-dev-2026!' }, 'identifier'],
      ['TC-AUTH-API-22', 'thiếu password', { identifier: 'player1' }, 'password'],
      ['TC-AUTH-API-23', 'identifier rỗng', { identifier: '   ', password: 'Player-dev-2026!' }, 'identifier'],
    ])('%s: %s → 400 VALIDATION_ERROR', async (_id, _name, body, field) => {
      const res = await login(body).expect(400);
      expectErrorFormat(res.body as ErrorBody, 400, 'VALIDATION_ERROR');
      expect((res.body as ErrorBody).details?.map((d) => d.field)).toContain(field);
    });

    it('TC-AUTH-API-24: tài khoản bị khóa, đúng mật khẩu → 403 ACCOUNT_LOCKED, không cấp token', async () => {
      t.prisma.rows('user')[0].accountStatus = 'LOCKED';
      const res = await login({ identifier: 'player1', password: 'Player-dev-2026!' }).expect(403);
      expectErrorFormat(res.body as ErrorBody, 403, 'ACCOUNT_LOCKED');
      expect(t.prisma.rows('authSession')).toHaveLength(0);
    });

    it('TC-AUTH-API-25: đăng nhập thành công cập nhật lastLoginAt', async () => {
      await login({ identifier: 'player1', password: 'Player-dev-2026!' }).expect(200);
      expect(t.prisma.rows('user')[0].lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('GET /auth/me', () => {
    it('TC-AUTH-API-26: token hợp lệ → 200 thông tin tài khoản', async () => {
      const session = await registerAndGetSession();
      const res = await me(`Bearer ${session.accessToken}`).expect(200);
      expect(res.body).toEqual(session.user);
    });

    it('TC-AUTH-API-27: không gửi token → 401 AUTH_TOKEN_MISSING', async () => {
      const res = await me().expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_TOKEN_MISSING');
    });

    it.each([
      ['TC-AUTH-API-28', 'header không có tiền tố Bearer', 'Token abc'],
      ['TC-AUTH-API-29', 'chuỗi không phải JWT', 'Bearer not-a-jwt'],
    ])('%s: %s → 401 AUTH_TOKEN_INVALID', async (_id, _name, header) => {
      const res = await me(header).expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_TOKEN_INVALID');
    });

    it('TC-AUTH-API-30: JWT ký bằng secret khác → 401 AUTH_TOKEN_INVALID', async () => {
      const forged = await new JwtService({ secret: 'attacker-secret-attacker-secret-1234' }).signAsync({
        sub: '1',
        sid: '1',
      });
      const res = await me(`Bearer ${forged}`).expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_TOKEN_INVALID');
    });

    it('TC-AUTH-API-31: access token hết hạn → 401 AUTH_TOKEN_EXPIRED', async () => {
      await registerAndGetSession();
      const expired = await new JwtService({ secret: TEST_JWT_SECRET }).signAsync(
        { sub: '1', sid: '1' },
        { expiresIn: -10 },
      );
      const res = await me(`Bearer ${expired}`).expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_TOKEN_EXPIRED');
    });

    it('TC-AUTH-API-32: token kiểu cũ (v0.1, không có sid) → 401 AUTH_TOKEN_INVALID', async () => {
      await registerAndGetSession();
      const legacy = await new JwtService({ secret: TEST_JWT_SECRET }).signAsync({ sub: '1' });
      const res = await me(`Bearer ${legacy}`).expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_TOKEN_INVALID');
    });

    it('TC-AUTH-API-33: tài khoản bị khóa sau khi đã đăng nhập → 403 ACCOUNT_LOCKED', async () => {
      const session = await registerAndGetSession();
      t.prisma.rows('user')[0].accountStatus = 'LOCKED';
      const res = await me(`Bearer ${session.accessToken}`).expect(403);
      expectErrorFormat(res.body as ErrorBody, 403, 'ACCOUNT_LOCKED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('TC-AUTH-API-34: refresh hợp lệ → 200, cả 2 token đều mới', async () => {
      const first = await registerAndGetSession();
      const res = await request(t.server)
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      expect(res.body.refreshToken).not.toBe(first.refreshToken);
      expect(res.body.user).toEqual(first.user);
      await me(`Bearer ${res.body.accessToken}`).expect(200);
    });

    it('TC-AUTH-API-35: dùng lại refresh token cũ → 401 AUTH_REFRESH_INVALID', async () => {
      const first = await registerAndGetSession();
      await request(t.server).post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
      const res = await request(t.server)
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_REFRESH_INVALID');
    });

    it('TC-AUTH-API-36: refresh token không tồn tại → 401 AUTH_REFRESH_INVALID', async () => {
      const res = await request(t.server)
        .post('/auth/refresh')
        .send({ refreshToken: 'Z'.repeat(43) })
        .expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_REFRESH_INVALID');
    });

    it('TC-AUTH-API-37: thiếu refreshToken → 400 VALIDATION_ERROR', async () => {
      const res = await request(t.server).post('/auth/refresh').send({}).expect(400);
      expectErrorFormat(res.body as ErrorBody, 400, 'VALIDATION_ERROR');
    });

    it('TC-AUTH-API-38: phiên quá hạn tuyệt đối → 401 AUTH_REFRESH_EXPIRED', async () => {
      const first = await registerAndGetSession();
      t.prisma.rows('authSession')[0].expiresAt = new Date(Date.now() - 1);
      const res = await request(t.server)
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_REFRESH_EXPIRED');
    });
  });

  describe('POST /auth/logout (FR-03)', () => {
    it('TC-AUTH-API-39: logout → 204, access token cũ gọi /auth/me → 401 AUTH_SESSION_REVOKED', async () => {
      const session = await registerAndGetSession();
      await request(t.server).post('/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
      const res = await me(`Bearer ${session.accessToken}`).expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_SESSION_REVOKED');
    });

    it('TC-AUTH-API-40: logout → refresh token cũ → 401 AUTH_REFRESH_INVALID', async () => {
      const session = await registerAndGetSession();
      await request(t.server).post('/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
      const res = await request(t.server)
        .post('/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      expectErrorFormat(res.body as ErrorBody, 401, 'AUTH_REFRESH_INVALID');
    });

    it('TC-AUTH-API-41: logout thiếu refreshToken → 400 VALIDATION_ERROR', async () => {
      const res = await request(t.server).post('/auth/logout').send({}).expect(400);
      expectErrorFormat(res.body as ErrorBody, 400, 'VALIDATION_ERROR');
    });

    it('TC-AUTH-API-42: đăng nhập lại sau logout → phiên mới dùng được', async () => {
      const session = await registerAndGetSession();
      await request(t.server).post('/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
      const res = await login({ identifier: 'nguoichoi', password: VALID_REGISTER.password }).expect(200);
      await me(`Bearer ${res.body.accessToken}`).expect(200);
    });
  });

  describe('Format lỗi chung', () => {
    it('TC-AUTH-API-43: body JSON hỏng → 400 theo format chung', async () => {
      const res = await request(t.server)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"identifier": "player1",')
        .expect(400);
      expectErrorFormat(res.body as ErrorBody, 400, 'VALIDATION_ERROR');
    });

    it('TC-AUTH-API-44: route không tồn tại → 404 NOT_FOUND theo format chung', async () => {
      const res = await request(t.server).get('/auth/khong-co').expect(404);
      expectErrorFormat(res.body as ErrorBody, 404, 'NOT_FOUND');
    });
  });
});
