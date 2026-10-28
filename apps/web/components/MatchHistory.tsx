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
  WIN: 'bg-emerald-50 text-emerald-700',
  LOSS: 'bg-rose-50 text-rose-700',
  DRAW: 'bg-stone-100 text-stone-700',
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
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Hồ sơ kỳ thủ</p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">Lịch sử thi đấu</h1>
        <p className="mt-2 text-sm text-stone-500">Các ván bạn đã chơi xong, ván kết thúc gần nhất ở trên cùng.</p>

        <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
            <p className="text-xs text-stone-500">Tổng số ván</p>
            <p data-testid="history-total" className="text-2xl font-bold text-stone-900">
              {data ? data.total : '—'}
            </p>
          </div>
          <Link href="/lobby" className="text-sm font-semibold text-emerald-700">
            ← Về Sảnh
          </Link>
        </div>

        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {error ? (
            <p role="alert" className="p-6 text-sm text-rose-700">
              {error}
            </p>
          ) : loading && !data ? (
            <p className="p-6 text-sm text-stone-500">Đang tải lịch sử…</p>
          ) : data && data.items.length === 0 ? (
            <p className="p-6 text-sm text-stone-500">
              {data.total === 0 ? 'Bạn chưa chơi xong ván nào.' : 'Trang này không có ván nào.'}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Thời gian</th>
                  <th className="px-5 py-3 font-semibold">Đối thủ</th>
                  <th className="px-5 py-3 font-semibold">Kết quả</th>
                  <th className="px-5 py-3 font-semibold">Số nước</th>
                  <th className="px-5 py-3 font-semibold">Thời lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data?.items.map((m) => (
                  <tr key={m.matchId} data-testid={`history-row-${m.matchId}`}>
                    <td className="px-5 py-4 text-xs text-stone-500">{formatEndedAt(m.endedAt)}</td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-stone-800">{m.opponent.displayName}</span>
                      <span className="block text-xs text-stone-400">
                        Bạn cầm {m.yourColor === 'RED' ? 'Đỏ' : 'Đen'} · Elo đối thủ {m.opponent.rating}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME_STYLE[m.outcome]}`}>
                        {OUTCOME_LABEL[m.outcome]}
                      </span>
                      {m.endReason && (
                        <span className="block pt-1 text-xs text-stone-400">
                          {HISTORY_END_REASON_LABELS[m.endReason] ?? m.endReason}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-stone-700">{moveCount(m.plyCount)}</td>
                    <td className="px-5 py-4 text-stone-700">{formatDuration(m.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <nav aria-label="Phân trang" className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-700 disabled:opacity-40"
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
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-700 disabled:opacity-40"
          >
            Trang sau →
          </button>
        </nav>
      </div>
    </main>
  );
}
