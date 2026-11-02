import { AccountStatus, MatchResult, MatchStatus, ReportReason, ReportStatus, UserRole } from '@prisma/client';

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

export interface AdminDashboardData {
  totalUsers: number;
  totalMatches: number;
  todayMatches: number;
  openReports: number;
  onlineUsers: number;
}
