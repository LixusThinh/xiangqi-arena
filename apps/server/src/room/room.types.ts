import { HostColorPref, RoomStatus, RoomVisibility } from '@prisma/client';

export type SeatColor = 'RED' | 'BLACK';

export interface RoomPlayerResponse {
  id: string;
  username: string;
  displayName: string;
  rating: number;
}

export interface RoomRuleProfileResponse {
  code: string;
  baseTimeSec: number;
  incrementSec: number;
  isRanked: boolean;
}

export interface RoomMemberResponse extends RoomPlayerResponse {
  isHost: boolean;
  /** null khi phòng còn WAITING; gán khi đủ 2 người (room → PLAYING). */
  color: SeatColor | null;
  joinedAt: Date;
}

export interface RoomSummaryResponse {
  code: string;
  name: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  hostColorPref: HostColorPref;
  ruleProfile: RoomRuleProfileResponse;
  host: RoomPlayerResponse;
  playerCount: number;
  createdAt: Date;
}

export interface RoomDetailResponse extends RoomSummaryResponse {
  members: RoomMemberResponse[];
  /** Ván được tạo khi phòng đủ 2 người; GameService (XQA-74) dùng id này để bắt đầu ván. */
  matchId: string | null;
}

/** Sức chứa cố định: Cờ Tướng 2 người, chưa có khán giả (spectator ngoài scope V1). */
export const ROOM_CAPACITY = 2;

export const DEFAULT_RULE_PROFILE_CODE = 'VN_STANDARD';
