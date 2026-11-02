import { authorizedRequest } from './session';

export type UserRole = 'PLAYER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'LOCKED';
export type MatchStatus = 'WAITING' | 'ACTIVE' | 'FINISHED' | 'ABORTED';
export type MatchResult = 'RED_WIN' | 'BLACK_WIN' | 'DRAW';
export type ReportReason = 'CHEATING' | 'HARASSMENT' | 'SPAM' | 'OTHER';
export type ReportStatus = 'OPEN' | 'PROCESSING' | 'CLOSED';

export interface AdminDashboardData {
  totalUsers: number;
  totalMatches: number;
  todayMatches: number;
  openReports: number;
  onlineUsers: number;
}

export interface AdminUserItem {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  rating: number;
  createdAt: string;
}

export interface AdminUsersPage {
  items: AdminUserItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminMatchPlayer {
  id: string;
  username: string;
  displayName: string;
}

export interface AdminMatchItem {
  id: string;
  red: AdminMatchPlayer;
  black: AdminMatchPlayer;
  status: MatchStatus;
  result: MatchResult | null;
  endReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface AdminMatchesPage {
  items: AdminMatchItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminMoveItem {
  ply: number;
  from: string;
  to: string;
  piece: string;
  captured: string | null;
  isCheck: boolean;
  fenAfter: string;
  thinkTimeMs: number;
  createdAt: string;
}

export interface AdminMatchDetail extends AdminMatchItem {
  currentFen: string | null;
  moves: AdminMoveItem[];
}

export interface AdminReportUser {
  id: string;
  username: string;
  displayName: string;
}

export interface AdminReportItem {
  id: string;
  matchId: string;
  reporter: AdminReportUser;
  reportedUser: AdminReportUser;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  handledBy: AdminReportUser | null;
  handledAt: string | null;
  createdAt: string;
}

export interface AdminReportsPage {
  items: AdminReportItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const adminApi = {
  getDashboard(): Promise<AdminDashboardData> {
    return authorizedRequest<AdminDashboardData>('/admin/dashboard', { method: 'GET' });
  },

  getUsers(query: { q?: string; page?: number; pageSize?: number } = {}): Promise<AdminUsersPage> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return authorizedRequest<AdminUsersPage>(`/admin/users${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  updateUserStatus(userId: string, status: AccountStatus): Promise<AdminUserItem> {
    return authorizedRequest<AdminUserItem>(`/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getMatches(query: { status?: MatchStatus; page?: number; pageSize?: number } = {}): Promise<AdminMatchesPage> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return authorizedRequest<AdminMatchesPage>(`/admin/matches${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getMatchDetail(matchId: string): Promise<AdminMatchDetail> {
    return authorizedRequest<AdminMatchDetail>(`/admin/matches/${encodeURIComponent(matchId)}`, {
      method: 'GET',
    });
  },

  getReports(query: { status?: ReportStatus; page?: number; pageSize?: number } = {}): Promise<AdminReportsPage> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return authorizedRequest<AdminReportsPage>(`/admin/reports${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  updateReportStatus(reportId: string, status: ReportStatus): Promise<AdminReportItem> {
    return authorizedRequest<AdminReportItem>(`/admin/reports/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
