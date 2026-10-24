import { authorizedRequest } from './session';

/** Kiểu dữ liệu theo contract docs/api/room.md (XQA-69). */
export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
export type RoomVisibility = 'PUBLIC' | 'PRIVATE';
export type HostColorPref = 'RED' | 'BLACK' | 'RANDOM';
export type SeatColor = 'RED' | 'BLACK';

export interface RoomPlayer {
  id: string;
  username: string;
  displayName: string;
  rating: number;
}

export interface RoomMember extends RoomPlayer {
  isHost: boolean;
  color: SeatColor | null;
  joinedAt: string;
}

export interface RoomSummary {
  code: string;
  name: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  hostColorPref: HostColorPref;
  ruleProfile: { code: string; baseTimeSec: number; incrementSec: number; isRanked: boolean };
  host: RoomPlayer;
  playerCount: number;
  createdAt: string;
}

export interface RoomDetail extends RoomSummary {
  members: RoomMember[];
  matchId: string | null;
}

export interface CreateRoomInput {
  name?: string;
  visibility?: RoomVisibility;
  hostColorPref?: HostColorPref;
  ruleProfileCode?: string;
}

/** Thông báo tiếng Việt cho mã lỗi Room (contract mục "Mã lỗi"). */
export const ROOM_ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'Không tìm thấy phòng. Kiểm tra lại mã phòng hoặc link mời.',
  ROOM_FULL: 'Phòng đã đủ 2 người.',
  ROOM_CLOSED: 'Phòng đã kết thúc hoặc đã bị hủy.',
  ROOM_USER_BUSY: 'Bạn đang ở một phòng khác. Hãy rời phòng đó trước.',
  ROOM_ALREADY_STARTED: 'Ván đã bắt đầu, không thể rời phòng.',
  ROOM_NOT_MEMBER: 'Bạn không ở trong phòng này.',
};

const path = (code: string) => `/rooms/${encodeURIComponent(code)}`;

export const roomApi = {
  list(): Promise<RoomSummary[]> {
    return authorizedRequest<RoomSummary[]>('/rooms', { method: 'GET' });
  },
  current(): Promise<{ room: RoomDetail | null }> {
    return authorizedRequest<{ room: RoomDetail | null }>('/rooms/current', { method: 'GET' });
  },
  get(code: string): Promise<RoomDetail> {
    return authorizedRequest<RoomDetail>(path(code), { method: 'GET' });
  },
  create(input: CreateRoomInput = {}): Promise<RoomDetail> {
    return authorizedRequest<RoomDetail>('/rooms', { method: 'POST', body: JSON.stringify(input) });
  },
  join(code: string): Promise<RoomDetail> {
    return authorizedRequest<RoomDetail>(`${path(code)}/join`, { method: 'POST' });
  },
  leave(code: string): Promise<void> {
    return authorizedRequest<void>(`${path(code)}/leave`, { method: 'POST' });
  },
};
