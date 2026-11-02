import { apiRequest } from './auth-api';

export type ReportReason = 'CHEATING' | 'HARASSMENT' | 'SPAM' | 'OTHER';

export interface CreateReportInput {
  reason: ReportReason;
  description?: string;
}

export interface ReportView {
  id: string;
  matchId: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  description: string | null;
  status: 'OPEN' | 'PROCESSING' | 'CLOSED';
  createdAt: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  CHEATING: 'Gian lận',
  HARASSMENT: 'Quấy rối',
  SPAM: 'Spam',
  OTHER: 'Khác',
};

export const reportApi = {
  createReport(matchId: string, input: CreateReportInput): Promise<ReportView> {
    return apiRequest<ReportView>(`/matches/${encodeURIComponent(matchId)}/report`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
