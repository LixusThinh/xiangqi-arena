import { apiRequest, CURRENT_USER_KEY, SESSION_CHANGED_EVENT } from './auth-api';
import { authorizedRequest } from './session';

export interface UserProfileResponse {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  rating: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  createdAt: string;
}

export interface UpdateProfileDto {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface UpdatedProfileResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  rating: number;
  createdAt: string;
}

/**
 * Lấy thông tin hồ sơ người chơi công khai theo username (FR-04).
 */
export async function getProfile(username: string): Promise<UserProfileResponse> {
  return apiRequest<UserProfileResponse>(`/users/${encodeURIComponent(username)}/profile`, {
    method: 'GET',
  });
}

/**
 * Cập nhật hồ sơ cá nhân của người dùng hiện tại (FR-04).
 */
export async function updateProfile(dto: UpdateProfileDto): Promise<UpdatedProfileResponse> {
  const result = await authorizedRequest<UpdatedProfileResponse>('/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });

  if (dto.displayName !== undefined && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        user.displayName = result.displayName;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
      }
    } catch {
      // Bỏ qua lỗi nếu JSON hỏng
    }
  }

  return result;
}
