'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  type AdminMatchDetail,
  type AdminMatchItem,
  type MatchStatus,
} from '@/lib/admin-api';

const STATUS_FILTERS: { label: string; value: MatchStatus | 'ALL' }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'Đang diễn ra (ACTIVE)', value: 'ACTIVE' },
  { label: 'Đã hoàn thành (FINISHED)', value: 'FINISHED' },
  { label: 'Đang chờ (WAITING)', value: 'WAITING' },
  { label: 'Bị hủy (ABORTED)', value: 'ABORTED' },
];

function formatResult(result: string | null): string {
  if (result === 'RED_WIN') return 'Đỏ thắng';
  if (result === 'BLACK_WIN') return 'Đen thắng';
  if (result === 'DRAW') return 'Hòa';
  return '—';
}

function formatStatus(status: MatchStatus): { text: string; badgeClass: string } {
  switch (status) {
    case 'ACTIVE':
      return { text: 'Đang diễn ra', badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    case 'FINISHED':
      return { text: 'Đã xong', badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600' };
    case 'WAITING':
      return { text: 'Đang chờ', badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    case 'ABORTED':
      return { text: 'Bị hủy', badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30' };
    default:
      return { text: status, badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

export default function AdminMatchesTab() {
  const [matches, setMatches] = useState<AdminMatchItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal chi tiết ván
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminMatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchMatches = useCallback(async (targetPage = page, targetFilter = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getMatches({
        page: targetPage,
        status: targetFilter === 'ALL' ? undefined : targetFilter,
      });
      setMatches(res.items);
      setPage(res.page);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      setError((err as Error).message || 'Không thể tải danh sách ván đấu.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchMatches(page, statusFilter);
  }, [page, statusFilter, fetchMatches]);

  const handleFilterChange = (filter: MatchStatus | 'ALL') => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleOpenDetail = async (matchId: string) => {
    setSelectedMatchId(matchId);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await adminApi.getMatchDetail(matchId);
      setDetail(data);
    } catch (err) {
      setDetailError((err as Error).message || 'Không thể tải chi tiết ván đấu.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedMatchId(null);
    setDetail(null);
  };

  return (
    <div data-testid="admin-matches-tab" className="flex flex-col gap-4">
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
          Tổng cộng: <span className="font-semibold text-slate-200">{total}</span> ván
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Matches Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Mã ván</th>
              <th className="px-4 py-3">Bên Đỏ</th>
              <th className="px-4 py-3">Bên Đen</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Kết quả</th>
              <th className="px-4 py-3">Lý do kết thúc</th>
              <th className="px-4 py-3">Bắt đầu</th>
              <th className="px-4 py-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Đang tải danh sách ván đấu…
                </td>
              </tr>
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Không tìm thấy ván đấu nào.
                </td>
              </tr>
            ) : (
              matches.map((m) => {
                const statusMeta = formatStatus(m.status);
                return (
                  <tr key={m.id} className="transition hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400" title={m.id}>
                      {m.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 font-medium text-rose-300">
                      {m.red.displayName}{' '}
                      <span className="text-[11px] text-slate-400">(@{m.red.username})</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-300">
                      {m.black.displayName}{' '}
                      <span className="text-[11px] text-slate-400">(@{m.black.username})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.badgeClass}`}>
                        {statusMeta.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatResult(m.result)}</td>
                    <td className="px-4 py-3 text-slate-400">{m.endReason || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {m.startedAt ? new Date(m.startedAt).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleOpenDetail(m.id)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-700"
                      >
                        Xem
                      </button>
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

      {/* Modal chi tiết ván đấu */}
      {selectedMatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-match-detail-title"
            className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-100 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 id="admin-match-detail-title" className="text-lg font-bold text-amber-400">
                Chi tiết ván đấu
              </h3>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="text-slate-400 hover:text-slate-200"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Đang tải thông tin ván đấu…</div>
            ) : detailError ? (
              <div className="py-8 text-center text-sm text-rose-300">{detailError}</div>
            ) : detail ? (
              <div className="flex flex-col gap-4 text-xs">
                {/* Header thông tin */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] text-slate-400">Bên Đỏ</p>
                    <p className="font-bold text-rose-300">{detail.red.displayName}</p>
                    <p className="text-[10px] text-slate-400">@{detail.red.username}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Bên Đen</p>
                    <p className="font-bold text-slate-200">{detail.black.displayName}</p>
                    <p className="text-[10px] text-slate-400">@{detail.black.username}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Kết quả</p>
                    <p className="font-bold text-amber-300">{formatResult(detail.result)}</p>
                    <p className="text-[10px] text-slate-400">{detail.endReason || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Trạng thái</p>
                    <p className="font-bold text-slate-200">{detail.status}</p>
                    <p className="text-[10px] text-slate-400">
                      {detail.moves ? `${detail.moves.length} nước` : '0 nước'}
                    </p>
                  </div>
                </div>

                {/* FEN */}
                {detail.currentFen && (
                  <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">FEN bàn cờ:</span>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-slate-300">{detail.currentFen}</p>
                  </div>
                )}

                {/* Danh sách nước đi */}
                <div>
                  <h4 className="mb-2 text-xs font-bold text-slate-300">
                    Danh sách nước đi ({detail.moves.length})
                  </h4>
                  {detail.moves.length === 0 ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-900/30 py-6 text-center text-slate-400">
                      Chưa có nước đi nào được thực hiện.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/40">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 border-b border-slate-700 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-3 py-2 text-center">#</th>
                            <th className="px-3 py-2">Quân</th>
                            <th className="px-3 py-2">Nước đi</th>
                            <th className="px-3 py-2">Ăn quân</th>
                            <th className="px-3 py-2 text-center">Chiếu</th>
                            <th className="px-3 py-2 text-right">Suy nghĩ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60 font-mono text-[11px] text-slate-300">
                          {detail.moves.map((mv) => (
                            <tr key={mv.ply} className="hover:bg-slate-750">
                              <td className="px-3 py-1.5 text-center text-slate-500">{mv.ply}</td>
                              <td className="px-3 py-1.5 font-sans font-medium text-amber-300">{mv.piece}</td>
                              <td className="px-3 py-1.5">
                                {mv.from} → {mv.to}
                              </td>
                              <td className="px-3 py-1.5 text-slate-400">{mv.captured || '—'}</td>
                              <td className="px-3 py-1.5 text-center font-bold text-rose-400">
                                {mv.isCheck ? '✓' : ''}
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-400">
                                {(mv.thinkTimeMs / 1000).toFixed(1)}s
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCloseDetail}
                    className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-600"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
