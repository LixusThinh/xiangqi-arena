import {
  apiRequest,
  AuthApiError,
  authApi,
  clearSession,
  getStoredSession,
  saveSession,
  type StoredSession,
} from './auth-api';

/** Refresh sớm khi access token còn dưới 30 giây, tránh gửi request rồi mới bị 401. */
export const REFRESH_SKEW_MS = 30_000;

let inflightRefresh: Promise<StoredSession | null> | null = null;

/**
 * Đổi refresh token lấy cặp token mới và lưu lại.
 *
 * - Nhiều request cùng lúc gặp token hết hạn chỉ tạo MỘT lời gọi refresh (single-flight),
 *   vì backend xoay vòng refresh token: gọi song song thì lời gọi thứ 2 bị 401.
 * - Tab khác có thể vừa refresh trước (token trong localStorage đã đổi) → dùng luôn token đó.
 * - Backend từ chối (401/403) → xóa phiên, trả null. Lỗi mạng → giữ phiên, ném lỗi để thử lại sau.
 */
export function refreshSession(): Promise<StoredSession | null> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    const current = getStoredSession();
    if (!current) return null;
    try {
      const session = await authApi.refresh(current.refreshToken);
      saveSession(session, session.user);
      return getStoredSession();
    } catch (error) {
      const latest = getStoredSession();
      if (latest && latest.refreshToken !== current.refreshToken) {
        return latest;
      }
      if (error instanceof AuthApiError && (error.statusCode === 401 || error.statusCode === 403)) {
        clearSession();
        return null;
      }
      throw error;
    }
  })().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

/** Access token dùng được ngay, tự refresh nếu sắp hết hạn. null = chưa đăng nhập / phiên đã hết. */
export async function getAccessToken(): Promise<string | null> {
  const session = getStoredSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return session.accessToken;
  }
  const refreshed = await refreshSession();
  return refreshed?.accessToken ?? null;
}

function sessionEnded(): AuthApiError {
  return new AuthApiError(
    'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
    401,
    'AUTH_SESSION_ENDED',
  );
}

const SESSION_GONE_CODES = new Set(['AUTH_SESSION_REVOKED', 'AUTH_TOKEN_INVALID', 'AUTH_TOKEN_MISSING']);

/**
 * Gọi API cần đăng nhập. Gặp `AUTH_TOKEN_EXPIRED` thì refresh rồi thử lại đúng 1 lần
 * (AC XQA-67: hết hạn access token không bị văng). Phiên đã bị thu hồi → xóa phiên,
 * AuthGuard tự đưa người dùng về /login.
 */
export async function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw sessionEnded();
  try {
    return await apiRequest<T>(path, init, token);
  } catch (error) {
    if (!(error instanceof AuthApiError)) throw error;
    if (error.code === 'AUTH_TOKEN_EXPIRED') {
      const refreshed = await refreshSession();
      if (!refreshed) throw sessionEnded();
      return apiRequest<T>(path, init, refreshed.accessToken);
    }
    if (SESSION_GONE_CODES.has(error.code)) {
      clearSession();
    }
    throw error;
  }
}

/**
 * Đăng xuất: xóa phiên ở máy ngay (người dùng thấy đăng xuất tức thì), rồi báo backend thu hồi
 * phiên. Backend lỗi/mất mạng cũng không giữ phiên lại ở máy.
 */
export async function logout(): Promise<void> {
  const session = getStoredSession();
  clearSession();
  if (!session) return;
  try {
    await authApi.logout(session.refreshToken);
  } catch {
    // Phiên ở máy đã xóa; refresh token cũ hết hạn sau tối đa REFRESH_TOKEN_TTL_SEC.
  }
}

/** Chỉ cho phép chuyển hướng tới đường dẫn nội bộ, chặn open redirect kiểu `?next=//evil.com`. */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}

export function loginPathFor(currentPath: string): string {
  return `/login?next=${encodeURIComponent(currentPath)}`;
}
