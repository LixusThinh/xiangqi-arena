'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  type AdminReportItem,
  type ReportReason,
  type ReportStatus,
} from '@/lib/admin-api';

const STATUS_FILTERS: { label: string; value: ReportStatus | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Chờ xử lý (OPEN)', value: 'OPEN' },
  { label: 'Đang xử lý (PROCESSING)', value: 'PROCESSING' },
  { label: 'Đã đóng (CLOSED)', value: 'CLOSED' },
];

function formatReason(reason: ReportReason): string {
  switch (reason) {
    case 'CHEATING':
      return 'Gian lận';
    case 'HARASSMENT':
      return 'Quấy rối / Xúc phạm';
    case 'SPAM':
      return 'Spam tin nhắn';
    case 'OTHER':
      return 'Lý do khác';
    default:
      return reason;
  }
}

function formatStatus(status: ReportStatus): { text: string; badgeClass: string } {
  switch (status) {
    case 'OPEN':
      return { text: 'Chờ xử lý', badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30' };
    case 'PROCESSING':
      return { text: 'Đang xử lý', badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    case 'CLOSED':
      return { text: 'Đã đóng', badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600' };
    default:
      return { text: status, badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

export default function AdminReportsTab() {
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (targetPage = page, targetFilter = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getReports({
        page: targetPage,
        status: targetFilter === 'ALL' ? undefined : targetFilter,
      });
      setReports(res.items);
      setPage(res.page);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      setError((err as Error).message || 'Không thể tải danh sách báo cáo.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchReports(page, statusFilter);
  }, [page, statusFilter, fetchReports]);

  const handleFilterChange = (filter: ReportStatus | 'ALL') => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleUpdateStatus = async (reportId: string, nextStatus: ReportStatus) => {
    setUpdatingId(reportId);
    setError(null);
    try {
      const updated = await adminApi.updateReportStatus(reportId, nextStatus);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError((err as Error).message || 'Không thể cập nhật trạng thái báo cáo.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div data-testid="admin-reports-tab" className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleFilterChange(f.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === f.value
                  ? 'border border-amber-500/50 bg-amber-500/20 text-amber-200'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400">
          Tổng cộng: <span className="font-semibold text-slate-200">{total}</span> báo cáo
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Reports Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Mã ván</th>
              <th className="px-4 py-3">Người báo cáo</th>
              <th className="px-4 py-3">Người bị tố cáo</th>
              <th className="px-4 py-3">Lý do</th>
              <th className="px-4 py-3">Mô tả</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Người xử lý</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Đang tải danh sách báo cáo…
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Không tìm thấy báo cáo nào.
                </td>
              </tr>
            ) : (
              reports.map((r) => {
                const statusMeta = formatStatus(r.status);
                const isUpdating = updatingId === r.id;
                return (
                  <tr key={r.id} className="transition hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400" title={r.matchId}>
                      {r.matchId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-200">{r.reporter.displayName}</span>
                      <span className="block text-[10px] text-slate-500">@{r.reporter.username}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-rose-300">{r.reportedUser.displayName}</span>
                      <span className="block text-[10px] text-slate-500">@{r.reportedUser.username}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-amber-300">{formatReason(r.reason)}</span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-300">
                      {r.description ? (
                        <p className="line-clamp-2 text-[11px] break-words" title={r.description}>
                          {r.description}
                        </p>
                      ) : (
                        <span className="text-slate-500 italic">Không có mô tả</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.badgeClass}`}>
                        {statusMeta.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.handledBy ? (
                        <div>
                          <span className="text-slate-300">{r.handledBy.displayName}</span>
                          <span className="block text-[10px] text-slate-500">@{r.handledBy.username}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'OPEN' ? (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void handleUpdateStatus(r.id, 'PROCESSING')}
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
                        >
                          {isUpdating ? '…' : 'Tiếp nhận'}
                        </button>
                      ) : r.status === 'PROCESSING' ? (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void handleUpdateStatus(r.id, 'CLOSED')}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                        >
                          {isUpdating ? '…' : 'Đóng'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Đã giải quyết</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 text-xs">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
          >
            Trang trước
          </button>
          <span className="text-slate-400">
            Trang <span className="font-semibold text-slate-200">{page}</span> / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
