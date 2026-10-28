import { authorizedRequest } from './session';

/** Kiểu dữ liệu theo contract docs/api/history.md (XQA-97). */
export type HistoryOutcome = 'WIN' | 'LOSS' | 'DRAW';

export interface HistoryOpponent {
  id: string;
  username: string;
  displayName: string;
  rating: number;
}

export interface MatchHistoryItem {
  matchId: string;
  roomCode: string;
  ruleProfileCode: string;
  isRanked: boolean;
  yourColor: 'RED' | 'BLACK';
  opponent: HistoryOpponent;
  outcome: HistoryOutcome;
  result: 'RED_WIN' | 'BLACK_WIN' | 'DRAW';
  endReason: string | null;
  /** Tổng số lần đi của cả hai bên (H-05). */
  plyCount: number;
  startedAt: string | null;
  endedAt: string;
  durationSec: number | null;
}

export interface MatchHistoryPage {
  items: MatchHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const HISTORY_PAGE_SIZE = 20;

/** Nhãn lý do kết thúc theo bảng `endReason` của docs/api/history.md (đủ mọi giá trị enum MatchEndReason). */
export const HISTORY_END_REASON_LABELS: Record<string, string> = {
  CHECKMATE: 'Chiếu bí',
  STALEMATE: 'Hết nước đi',
  RESIGNATION: 'Xin thua',
  TIMEOUT: 'Hết giờ',
  DISCONNECT: 'Mất kết nối',
  DRAW_AGREEMENT: 'Hòa theo thỏa thuận',
  REPETITION: 'Lặp nước (Điều 23)',
  MOVE_LIMIT: 'Hết số nước tự nhiên',
};

export const HISTORY_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Trang không hợp lệ.',
  HISTORY_NOT_FOUND: 'Không tìm thấy ván đấu trong lịch sử của bạn.',
};

export const historyApi = {
  list(page = 1, pageSize = HISTORY_PAGE_SIZE): Promise<MatchHistoryPage> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return authorizedRequest<MatchHistoryPage>(`/me/matches?${query.toString()}`, { method: 'GET' });
  },
};

/** "Số nước" theo cách đếm của người chơi: một cặp Đỏ–Đen là 1 nước (H-05: ceil(plyCount / 2)). */
export function moveCount(plyCount: number): number {
  return Math.ceil(plyCount / 2);
}

/** 750 → "12 phút 30 giây"; null → "—". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút ${s} giây`;
  return `${s} giây`;
}

/** Thời điểm theo giờ Việt Nam, cố định múi giờ để mọi máy hiển thị giống nhau. */
export function formatEndedAt(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
