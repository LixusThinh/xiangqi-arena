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

/** Thông báo tiếng Việt theo mã lỗi trong contract docs/api/auth.md. */
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_IDENTIFIER_TAKEN: 'Tên đăng nhập hoặc email này đã được sử dụng.',
  AUTH_INVALID_CREDENTIALS: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.',
  ACCOUNT_LOCKED: 'Tài khoản này đã bị khóa.',
  AUTH_TOKEN_MISSING: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  AUTH_TOKEN_INVALID: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  AUTH_TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
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

async function request<T>(
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
      'Không kết nối được với máy chủ. Hãy kiểm tra backend rồi thử lại.',
      0,
      'NETWORK_ERROR',
    );
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
};

/* ---------- Lưu phiên đăng nhập (một chỗ duy nhất, page/AuthForm dùng chung) ---------- */

export interface StoredSession {
  accessToken: string;
  user: AuthUser;
  expiresAt: number;
}

export function saveSession(accessToken: string, expiresIn: number, user: AuthUser): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
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

/** Trả phiên còn hạn, hoặc null (đồng thời xóa phiên hỏng/hết hạn). */
export function getStoredSession(): StoredSession | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const rawUser = localStorage.getItem(CURRENT_USER_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY));
  if (!accessToken || !rawUser || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearSession();
    return null;
  }
  try {
    const user: unknown = JSON.parse(rawUser);
    if (!isAuthUser(user)) {
      clearSession();
      return null;
    }
    return { accessToken, user, expiresAt };
  } catch {
    clearSession();
    return null;
  }
}
