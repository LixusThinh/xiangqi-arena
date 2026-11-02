import { apiRequest } from './auth-api';

export interface LeaderboardItem {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
}

export interface LeaderboardPage {
  items: LeaderboardItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const LEADERBOARD_PAGE_SIZE = 20;

export const leaderboardApi = {
  getLeaderboard(page = 1, pageSize = LEADERBOARD_PAGE_SIZE): Promise<LeaderboardPage> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return apiRequest<LeaderboardPage>(`/leaderboard?${query.toString()}`, { method: 'GET' });
  },
};
