import { authApi, AuthApiError } from '../lib/auth-api';

const session = {
  accessToken: 'real-access-token',
  tokenType: 'Bearer' as const,
  expiresIn: 900 as const,
  user: {
    id: '42',
    username: 'new_player',
    email: 'new@example.com',
    displayName: 'New Player',
    role: 'PLAYER' as const,
    rating: 1200,
    createdAt: '2026-10-12T10:00:00.000Z',
  },
};
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('authApi', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
  });

  it('posts registration to the configured backend URL', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mockResponse(session, 201));

    await expect(
      authApi.register({
        username: 'new_player',
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New Player',
      }),
    ).resolves.toEqual(session);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'new_player',
          email: 'new@example.com',
          password: 'password123',
          displayName: 'New Player',
        }),
      }),
    );
  });

  it('preserves the backend 409 duplicate-identifier response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse(
        {
          statusCode: 409,
          code: 'AUTH_IDENTIFIER_TAKEN',
          message: 'Username or email is already registered',
        },
        409,
      ),
    );

    await expect(
      authApi.register({
        username: 'new_player',
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New Player',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'AUTH_IDENTIFIER_TAKEN',
      message: 'Tên đăng nhập hoặc email này đã được sử dụng.',
    } satisfies Partial<AuthApiError>);
  });

  it('preserves the backend 401 credentials error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse(
        {
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Username/email or password is incorrect',
        },
        401,
      ),
    );

    await expect(
      authApi.login({ identifier: 'new_player', password: 'wrongpass' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('sends the bearer token to /me', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mockResponse(session.user));

    await expect(authApi.me(session.accessToken)).resolves.toEqual(session.user);
    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/me',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      `Bearer ${session.accessToken}`,
    );
  });
});
