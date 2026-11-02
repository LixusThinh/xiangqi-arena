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

export interface UpdatedProfileResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  rating: number;
  createdAt: string;
}
