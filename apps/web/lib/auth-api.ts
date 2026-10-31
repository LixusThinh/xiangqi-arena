export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'PLAYER' | 'ADMIN';
  rating: number;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  /** Contract Auth v0.2 (XQA-66): token đổi lấy access token mới, chỉ dùng được 1 lần. */
  refreshToken: string;
  /** Số giây còn lại của phiên (hạn tuyệt đối, refresh không kéo dài). */
  refreshExpiresIn: number;
  user: AuthUser;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export const ACCESS_TOKEN_KEY = 'xiangqi-arena.accessToken';
export const CURRENT_USER_KEY = 'xiangqi-arena.user';
export const EXPIRES_AT_KEY = 'xiangqi-arena.expiresAt';
export const REFRESH_TOKEN_KEY = 'xiangqi-arena.refreshToken';
export const REFRESH_EXPIRES_AT_KEY = 'xiangqi-arena.refreshExpiresAt';

/** Sự kiện phát ra trong cùng tab khi phiên được lưu/xóa (tab khác nhận qua sự kiện `storage`). */
export const SESSION_CHANGED_EVENT = 'xiangqi-arena:session-changed';

/** Thông báo tiếng Việt theo mã lỗi trong contract docs/api/auth.md. */
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_IDENTIFIER_TAKEN: 'Tên đăng nhập hoặc email này đã được sử dụng.',
  AUTH_INVALID_CREDENTIALS: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.',
  ACCOUNT_LOCKED: 'Tài khoản này đã bị khóa.',
  AUTH_TOKEN_MISSING: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  AUTH_TOKEN_INVALID: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  AUTH_TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  AUTH_SESSION_REVOKED: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
  AUTH_REFRESH_INVALID: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
  AUTH_REFRESH_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    /** Tên các field bị backend từ chối (chỉ có khi code = VALIDATION_ERROR). */
    public readonly fields: string[] = [],
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Chưa cấu hình NEXT_PUBLIC_API_BASE_URL cho ứng dụng web.');
  }
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Gọi API backend, trả JSON hoặc ném AuthApiError theo format lỗi chung của contract.
 * Dùng chung cho mọi client API (auth, room...). Request cần đăng nhập nên đi qua
 * `authorizedRequest` trong lib/session.ts để tự refresh token.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    // Lỗi cấu hình (thiếu env) giữ nguyên thông báo; lỗi mạng/CORS đổi sang tiếng Việt.
    if (error instanceof Error && error.message.includes('NEXT_PUBLIC_API_BASE_URL')) {
      throw error;
    }
    throw new AuthApiError(
      'Không kết nối được với máy chủ. Máy chủ vừa khởi động lại có thể mất khoảng 1 phút, hãy thử lại sau ít giây.',
      0,
      'NETWORK_ERROR',
    );
  }

  // 204 No Content (ví dụ logout) không có body
  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new AuthApiError(
        'Phản hồi thành công từ API không có JSON hợp lệ.',
        response.status,
        'INVALID_API_RESPONSE',
      );
    }
    body = null;
  }

  if (!response.ok) {
    const errorBody =
      typeof body === 'object' && body !== null
        ? (body as { message?: unknown; code?: unknown; details?: unknown })
        : undefined;
    const code = typeof errorBody?.code === 'string' ? errorBody.code : 'HTTP_ERROR';
    const fields = Array.isArray(errorBody?.details)
      ? errorBody.details
          .map((detail: unknown) =>
            typeof detail === 'object' && detail !== null
              ? (detail as { field?: unknown }).field
              : undefined,
          )
          .filter((field): field is string => typeof field === 'string')
      : [];
    throw new AuthApiError(
      ERROR_MESSAGES[code] ??
        (typeof errorBody?.message === 'string'
          ? errorBody.message
          : `Yêu cầu API thất bại (${response.status}).`),
      response.status,
      code,
      fields,
    );
  }

  return body as T;
}

const request = apiRequest;

export const authApi = {
  register(input: RegisterInput): Promise<AuthSession> {
    return request<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: LoginInput): Promise<AuthSession> {
    return request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  me(accessToken: string): Promise<AuthUser> {
    return request<AuthUser>('/auth/me', { method: 'GET' }, accessToken);
  },

  refresh(refreshToken: string): Promise<AuthSession> {
    return request<AuthSession>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  logout(refreshToken: string): Promise<void> {
    return request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};

/* ---------- Lưu phiên đăng nhập (một chỗ duy nhất, page/AuthForm/session dùng chung) ---------- */

export interface StoredSession {
  accessToken: string;
  user: AuthUser;
  /** Mốc (ms) access token hết hạn. Hết hạn KHÔNG có nghĩa là mất phiên: còn refresh được. */
  expiresAt: number;
  refreshToken: string;
  /** Mốc (ms) phiên hết hạn tuyệt đối; quá mốc này phải đăng nhập lại. */
  refreshExpiresAt: number;
}

export type SessionTokens = Pick<
  AuthSession,
  'accessToken' | 'expiresIn' | 'refreshToken' | 'refreshExpiresIn'
>;

function notifySessionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }
}

export function saveSession(tokens: SessionTokens, user: AuthUser): void {
  const now = Date.now();
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  localStorage.setItem(EXPIRES_AT_KEY, String(now + tokens.expiresIn * 1000));
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(REFRESH_EXPIRES_AT_KEY, String(now + tokens.refreshExpiresIn * 1000));
  notifySessionChanged();
}

export function clearSession(): void {
  const hadSession = localStorage.getItem(REFRESH_TOKEN_KEY) !== null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_EXPIRES_AT_KEY);
  if (hadSession) notifySessionChanged();
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.email === 'string' &&
    typeof user.displayName === 'string'
  );
}

/**
 * Trả phiên còn dùng được (refresh token chưa hết hạn), hoặc null và xóa phiên hỏng/hết hạn.
 * Access token có thể đã hết hạn: lib/session.ts sẽ tự refresh khi gọi API.
 * Phiên lưu từ trước XQA-67 (không có refresh token) bị coi là hết hạn.
 */
export function getStoredSession(): StoredSession | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const rawUser = localStorage.getItem(CURRENT_USER_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY));
  const refreshExpiresAt = Number(localStorage.getItem(REFRESH_EXPIRES_AT_KEY));
  if (
    !accessToken ||
    !rawUser ||
    !refreshToken ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(refreshExpiresAt) ||
    refreshExpiresAt <= Date.now()
  ) {
    clearSession();
    return null;
  }
  try {
    const user: unknown = JSON.parse(rawUser);
    if (!isAuthUser(user)) {
      clearSession();
      return null;
    }
    return { accessToken, user, expiresAt, refreshToken, refreshExpiresAt };
  } catch {
    clearSession();
    return null;
  }
}
