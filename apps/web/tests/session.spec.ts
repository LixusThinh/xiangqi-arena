/**
 * XQA-67: tự refresh token, gọi API cần đăng nhập, đăng xuất.
 * AC2: hết hạn access token không bị văng.
 */
import {
  ACCESS_TOKEN_KEY,
  AuthApiError,
  getStoredSession,
  REFRESH_TOKEN_KEY,
  saveSession,
  SESSION_CHANGED_EVENT,
} from '../lib/auth-api';
import {
  authorizedRequest,
  getAccessToken,
  logout,
  refreshSession,
  safeNextPath,
} from '../lib/session';

const user = {
  id: '42',
  username: 'player1',
  email: 'player1@example.com',
  displayName: 'Player One',
  role: 'PLAYER' as const,
  rating: 1200,
  createdAt: '2026-10-12T10:00:00.000Z',
};

const OLD_REFRESH = 'o'.repeat(43);
const NEW_REFRESH = 'n'.repeat(43);
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function storeSession(accessExpiresInSec: number, accessToken = 'old-access', refreshToken = OLD_REFRESH) {
  saveSession(
    { accessToken, expiresIn: accessExpiresInSec, refreshToken, refreshExpiresIn: 3600 },
    user,
  );
}

const refreshedSession = {
  accessToken: 'new-access',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: NEW_REFRESH,
  refreshExpiresIn: 3000,
  user,
};

const fetchMock = () => global.fetch as jest.Mock;
const calledUrls = () => fetchMock().mock.calls.map(([url]) => url as string);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  localStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  if (originalApiBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
});

describe('getAccessToken', () => {
  it('trả access token đang còn hạn, không gọi refresh', async () => {
    storeSession(900);
    await expect(getAccessToken()).resolves.toBe('old-access');
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('AC2: access token đã hết hạn → tự refresh, lưu cặp token mới, không bị văng', async () => {
    storeSession(-1);
    fetchMock().mockResolvedValueOnce(mockResponse(refreshedSession));

    await expect(getAccessToken()).resolves.toBe('new-access');

    expect(calledUrls()).toEqual(['http://localhost:3000/auth/refresh']);
    expect(JSON.parse(fetchMock().mock.calls[0][1].body)).toEqual({ refreshToken: OLD_REFRESH });
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe(NEW_REFRESH);
    expect(getStoredSession()?.user.username).toBe('player1');
  });

  it('chưa đăng nhập → null', async () => {
    await expect(getAccessToken()).resolves.toBeNull();
  });
});

describe('refreshSession', () => {
  it('nhiều lời gọi cùng lúc chỉ tạo 1 request refresh (single-flight)', async () => {
    storeSession(-1);
    fetchMock().mockResolvedValueOnce(mockResponse(refreshedSession));

    const results = await Promise.all([refreshSession(), refreshSession(), getAccessToken()]);

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(results[0]?.accessToken).toBe('new-access');
    expect(results[2]).toBe('new-access');
  });

  it('refresh bị từ chối (401) → xóa phiên, trả null', async () => {
    storeSession(-1);
    fetchMock().mockResolvedValueOnce(
      mockResponse({ statusCode: 401, code: 'AUTH_REFRESH_INVALID', message: 'x' }, 401),
    );
    const onChange = jest.fn();
    window.addEventListener(SESSION_CHANGED_EVENT, onChange);

    await expect(refreshSession()).resolves.toBeNull();

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(onChange).toHaveBeenCalled();
    window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
  });

  it('mất mạng khi refresh → GIỮ phiên (không văng), ném lỗi để thử lại sau', async () => {
    storeSession(-1);
    fetchMock().mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(refreshSession()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe(OLD_REFRESH);
  });

  it('tab khác đã refresh trước (token trong storage đổi) → dùng token mới, không xóa phiên', async () => {
    storeSession(-1);
    fetchMock().mockImplementationOnce(async () => {
      // Trong lúc request này chạy, tab khác đổi token thành công và ghi vào localStorage
      storeSession(900, 'other-tab-access', NEW_REFRESH);
      return mockResponse({ statusCode: 401, code: 'AUTH_REFRESH_INVALID', message: 'x' }, 401);
    });

    const result = await refreshSession();

    expect(result?.accessToken).toBe('other-tab-access');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe(NEW_REFRESH);
  });
});

describe('authorizedRequest', () => {
  it('gắn Bearer token vào request', async () => {
    storeSession(900);
    fetchMock().mockResolvedValueOnce(mockResponse({ ok: true }));

    await expect(authorizedRequest('/rooms')).resolves.toEqual({ ok: true });
    const headers = new Headers(fetchMock().mock.calls[0][1].headers);
    expect(headers.get('Authorization')).toBe('Bearer old-access');
  });

  it('AC2: server báo AUTH_TOKEN_EXPIRED → refresh rồi gửi lại đúng 1 lần với token mới', async () => {
    storeSession(900);
    fetchMock()
      .mockResolvedValueOnce(
        mockResponse({ statusCode: 401, code: 'AUTH_TOKEN_EXPIRED', message: 'x' }, 401),
      )
      .mockResolvedValueOnce(mockResponse(refreshedSession))
      .mockResolvedValueOnce(mockResponse([{ code: 'K7MPQ2XA' }]));

    await expect(authorizedRequest('/rooms')).resolves.toEqual([{ code: 'K7MPQ2XA' }]);

    expect(calledUrls()).toEqual([
      'http://localhost:3000/rooms',
      'http://localhost:3000/auth/refresh',
      'http://localhost:3000/rooms',
    ]);
    const retryHeaders = new Headers(fetchMock().mock.calls[2][1].headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access');
  });

  it('phiên đã bị thu hồi (AUTH_SESSION_REVOKED) → xóa phiên và ném lỗi', async () => {
    storeSession(900);
    fetchMock().mockResolvedValueOnce(
      mockResponse({ statusCode: 401, code: 'AUTH_SESSION_REVOKED', message: 'x' }, 401),
    );

    await expect(authorizedRequest('/rooms')).rejects.toBeInstanceOf(AuthApiError);
    expect(getStoredSession()).toBeNull();
  });

  it('lỗi nghiệp vụ (409) không đụng tới phiên', async () => {
    storeSession(900);
    fetchMock().mockResolvedValueOnce(
      mockResponse({ statusCode: 409, code: 'ROOM_FULL', message: 'x' }, 409),
    );

    await expect(authorizedRequest('/rooms/X/join', { method: 'POST' })).rejects.toMatchObject({
      code: 'ROOM_FULL',
    });
    expect(getStoredSession()).not.toBeNull();
  });

  it('chưa đăng nhập → ném AUTH_SESSION_ENDED, không gọi API', async () => {
    await expect(authorizedRequest('/rooms')).rejects.toMatchObject({ code: 'AUTH_SESSION_ENDED' });
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('xóa phiên ở máy và báo backend thu hồi refresh token', async () => {
    storeSession(900);
    fetchMock().mockResolvedValueOnce({ ok: true, status: 204, json: jest.fn() } as unknown as Response);

    await logout();

    expect(getStoredSession()).toBeNull();
    expect(calledUrls()).toEqual(['http://localhost:3000/auth/logout']);
    expect(JSON.parse(fetchMock().mock.calls[0][1].body)).toEqual({ refreshToken: OLD_REFRESH });
  });

  it('backend lỗi vẫn xóa phiên ở máy', async () => {
    storeSession(900);
    fetchMock().mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(logout()).resolves.toBeUndefined();
    expect(getStoredSession()).toBeNull();
  });
});

describe('safeNextPath', () => {
  it.each([
    ['/room/K7MPQ2XA', '/room/K7MPQ2XA'],
    ['/lobby?tab=public', '/lobby?tab=public'],
    [null, '/'],
    ['', '/'],
    ['https://evil.example.com', '/'],
    ['//evil.example.com', '/'],
    ['/\\evil.example.com', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
