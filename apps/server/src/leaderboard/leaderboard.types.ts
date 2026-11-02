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
