'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthApiError } from '@/lib/auth-api';
import {
  formatDuration,
  formatEndedAt,
  HISTORY_END_REASON_LABELS,
  HISTORY_ERROR_MESSAGES,
  historyApi,
  moveCount,
  type HistoryOutcome,
  type MatchHistoryPage,
} from '@/lib/history-api';

const OUTCOME_LABEL: Record<HistoryOutcome, string> = { WIN: 'Thắng', LOSS: 'Thua', DRAW: 'Hòa' };
const OUTCOME_STYLE: Record<HistoryOutcome, string> = {
  WIN: 'bg-emerald-500/15 text-emerald-300',
  LOSS: 'bg-rose-500/15 text-rose-300',
  DRAW: 'bg-slate-700/60 text-slate-200',
};

/**
 * XQA-98: trang Lịch sử ván đấu (FR-17), theo wireframe hi-fi màn "Lịch sử thi đấu" (/flow, XQA-85).
 * Bảng: đối thủ, kết quả, số nước, thời gian, thời lượng; phân trang theo GET /me/matches (XQA-97).
 * Khác wireframe: chưa có bộ lọc kết quả và thẻ thống kê thắng/hòa/thua vì API chưa hỗ trợ;
 * nút "Xem lại" chờ Replay (XQA-33).
 */
export default function MatchHistory() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MatchHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    historyApi
      .list(page)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof AuthApiError
            ? (HISTORY_ERROR_MESSAGES[err.code] ?? err.message)
            : 'Không tải được lịch sử ván đấu.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = Math.max(1, data?.totalPages ?? 1);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Xiangqi Arena</p>
            <h1 className="mt-1 text-3xl font-extrabold text-amber-300">Lịch sử thi đấu</h1>
            <p className="mt-2 text-sm text-slate-400">Các ván bạn đã chơi xong, ván kết thúc gần nhất ở trên cùng.</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/lobby" className="text-slate-300 underline hover:text-amber-200">
              ← Về Sảnh
            </Link>
          </nav>
        </header>

        <div className="mt-6 inline-flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-3">
          <p className="text-xs text-slate-400">Tổng số ván</p>
          <p data-testid="history-total" className="text-2xl font-bold text-slate-100">
            {data ? data.total : '—'}
          </p>
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40">
          {error ? (
            <p role="alert" className="p-6 text-sm text-rose-300">
              {error}
            </p>
          ) : loading && !data ? (
            <p className="p-6 text-sm text-slate-400">Đang tải lịch sử…</p>
          ) : data && data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              {data.total === 0 ? 'Bạn chưa chơi xong ván nào.' : 'Trang này không có ván nào.'}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Thời gian</th>
                  <th className="px-5 py-3 font-semibold">Đối thủ</th>
                  <th className="px-5 py-3 font-semibold">Kết quả</th>
                  <th className="px-5 py-3 font-semibold">Số nước</th>
                  <th className="px-5 py-3 font-semibold">Thời lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data?.items.map((m) => (
                  <tr key={m.matchId} data-testid={`history-row-${m.matchId}`} className="hover:bg-slate-800/30">
                    <td className="px-5 py-4 text-xs text-slate-400">{formatEndedAt(m.endedAt)}</td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-100">{m.opponent.displayName}</span>
                      <span className="block text-xs text-slate-500">
                        Bạn cầm {m.yourColor === 'RED' ? 'Đỏ' : 'Đen'} · Elo đối thủ {m.opponent.rating}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME_STYLE[m.outcome]}`}>
                        {OUTCOME_LABEL[m.outcome]}
                      </span>
                      {m.endReason && (
                        <span className="block pt-1.5 text-xs text-slate-500">
                          {HISTORY_END_REASON_LABELS[m.endReason] ?? m.endReason}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-300">{moveCount(m.plyCount)}</td>
                    <td className="px-5 py-4 text-slate-300">{formatDuration(m.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <nav aria-label="Phân trang" className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-300">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Trang trước
          </button>
          <span data-testid="history-page">
            Trang {data?.page ?? page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trang sau →
          </button>
        </nav>
      </div>
    </main>
  );
}
