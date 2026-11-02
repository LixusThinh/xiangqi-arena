'use client';

import { useEffect, useState } from 'react';
import { getStoredSession, SESSION_CHANGED_EVENT, type AuthUser } from '@/lib/auth-api';
import {
  leaderboardApi,
  type LeaderboardItem,
  type LeaderboardPage,
} from '@/lib/leaderboard-api';

export default function LeaderboardView() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredSession()?.user ?? null);
    syncUser();
    window.addEventListener(SESSION_CHANGED_EVENT, syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    leaderboardApi
      .getLeaderboard(page)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Không tải được bảng xếp hạng.');
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
    <main className="py-8 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-amber-300">Bảng xếp hạng</h1>
            <p className="mt-1 text-sm text-slate-400">
              Vinh danh các kỳ thủ xuất sắc nhất trên Xiangqi Arena theo điểm Elo.
            </p>
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40">
          {error ? (
            <p role="alert" className="p-6 text-sm text-rose-300">
              {error}
            </p>
          ) : loading && !data ? (
            <p className="p-6 text-sm text-slate-400">Đang tải bảng xếp hạng…</p>
          ) : data && data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              Chưa có kỳ thủ nào trên bảng xếp hạng.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table data-testid="leaderboard-table" className="min-w-[560px] w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 sm:px-5 py-3 font-semibold text-center w-16">Hạng</th>
                    <th className="px-4 sm:px-5 py-3 font-semibold">Kỳ thủ</th>
                    <th className="px-4 sm:px-5 py-3 font-semibold text-right">Điểm Elo</th>
                    <th className="px-4 sm:px-5 py-3 font-semibold text-right">Số ván</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data?.items.map((item: LeaderboardItem) => {
                    const isMe =
                      currentUser !== null &&
                      (currentUser.id === item.id || currentUser.username === item.username);
                    return (
                      <tr
                        key={item.id}
                        data-testid={isMe ? 'current-user-row' : `leaderboard-row-${item.username}`}
                        className={`transition-colors ${
                          isMe
                            ? 'bg-amber-500/15 border-l-4 border-l-amber-400 font-semibold text-amber-200'
                            : 'hover:bg-slate-800/30 text-slate-200'
                        }`}
                      >
                        <td className="px-4 sm:px-5 py-4 text-center">
                          {item.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-400/20">
                              1
                            </span>
                          ) : item.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-950 font-extrabold text-xs">
                              2
                            </span>
                          ) : item.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-amber-100 font-extrabold text-xs">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">#{item.rank}</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100">{item.displayName}</span>
                            <span className="text-xs text-slate-400">@{item.username}</span>
                            {isMe && (
                              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                                Bạn
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 sm:px-5 py-4 text-right font-bold text-amber-400">
                          {item.rating}
                        </td>
                        <td className="px-4 sm:px-5 py-4 text-right text-slate-400">
                          {item.gamesPlayed}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <nav
          aria-label="Phân trang"
          className="mt-4 flex flex-wrap items-center justify-between sm:justify-end gap-3 text-sm text-slate-300"
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-200 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Trang trước
          </button>
          <span data-testid="leaderboard-page" className="py-2">
            Trang {data?.page ?? page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-200 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trang sau →
          </button>
        </nav>
      </div>
    </main>
  );
}
