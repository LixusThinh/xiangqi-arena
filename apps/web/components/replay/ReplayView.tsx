'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Position, algebraicToSquare, type Move } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/board/Board';
import {
  historyApi,
  formatDuration,
  formatEndedAt,
  HISTORY_END_REASON_LABELS,
  HISTORY_ERROR_MESSAGES,
  type MatchHistoryDetail,
  type HistoryOutcome,
} from '@/lib/history-api';
import { formatVietnameseMove } from '@/lib/ai/vietnamese-notation';
import { AuthApiError } from '@/lib/auth-api';

export interface ReplayViewProps {
  matchId: string;
  initialData?: MatchHistoryDetail;
}

export interface ReplayMoveItem {
  ply: number;
  notation: string;
  color: 'RED' | 'BLACK';
  fenAfter: string;
  move: Move;
}

const OUTCOME_LABEL: Record<HistoryOutcome, string> = { WIN: 'Thắng', LOSS: 'Thua', DRAW: 'Hòa' };
const OUTCOME_STYLE: Record<HistoryOutcome, string> = {
  WIN: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  LOSS: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  DRAW: 'bg-slate-700/60 text-slate-200 border-slate-600',
};

export default function ReplayView({ matchId, initialData }: ReplayViewProps) {
  const [detail, setDetail] = useState<MatchHistoryDetail | null>(initialData ?? null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [currentPly, setCurrentPly] = useState<number>(() => (initialData ? initialData.moves.length : 0));
  const activeMoveRef = useRef<HTMLButtonElement | null>(null);

  // Tải chi tiết ván cờ từ API nếu chưa có initialData
  useEffect(() => {
    if (initialData) {
      setDetail(initialData);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    historyApi
      .get(matchId)
      .then((res) => {
        if (!cancelled) {
          setDetail(res);
          // Mặc định hiển thị ở nước đi cuối cùng của ván đấu
          setCurrentPly(res.moves.length);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof AuthApiError
            ? (HISTORY_ERROR_MESSAGES[err.code] ?? err.message)
            : 'Không tải được chi tiết ván đấu để xem lại.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [matchId, initialData]);

  // Tính toán ký hiệu tiếng Việt chuẩn cho từng nước đi
  const replayMoves: ReplayMoveItem[] = useMemo(() => {
    if (!detail) return [];

    const result: ReplayMoveItem[] = [];
    let currentPos = Position.fromFen(detail.initialFen);

    for (const m of detail.moves) {
      const move: Move = {
        from: algebraicToSquare(m.from),
        to: algebraicToSquare(m.to),
      };
      const notation = formatVietnameseMove(currentPos, move);
      result.push({
        ply: m.ply,
        notation,
        color: m.color,
        fenAfter: m.fenAfter,
        move,
      });

      // Chuyển sang thế cờ tiếp theo
      if (m.fenAfter) {
        currentPos = Position.fromFen(m.fenAfter);
      } else {
        const next = currentPos.clone();
        next.applyMove(move);
        currentPos = next;
      }
    }

    return result;
  }, [detail]);

  // Điều hướng nước đi
  const handleFirst = useCallback(() => setCurrentPly(0), []);
  const handlePrev = useCallback(() => setCurrentPly((p) => Math.max(0, p - 1)), []);
  const handleNext = useCallback(
    () => setCurrentPly((p) => Math.min(replayMoves.length, p + 1)),
    [replayMoves.length],
  );
  const handleLast = useCallback(() => setCurrentPly(replayMoves.length), [replayMoves.length]);

  // Bắt sự kiện phím mũi tên trái/phải
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua khi đang focus vào input hoặc textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        handleLast();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFirst, handlePrev, handleNext, handleLast]);

  // Cuộn tới nước đang chọn
  useEffect(() => {
    if (activeMoveRef.current && typeof activeMoveRef.current.scrollIntoView === 'function') {
      activeMoveRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPly]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 text-slate-300">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span>Đang tải ván đấu…</span>
        </div>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] max-w-4xl mx-auto p-4 sm:p-6 text-slate-100">
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-6 text-center">
          <p className="text-base font-semibold text-rose-300">{error ?? 'Không tìm thấy ván đấu.'}</p>
          <Link
            href="/history"
            className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            ← Quay lại Lịch sử
          </Link>
        </div>
      </main>
    );
  }

  // Xác định thế cờ và lastMove tại nước hiện tại
  const currentFen = currentPly === 0 ? detail.initialFen : replayMoves[currentPly - 1]?.fenAfter ?? detail.initialFen;
  const currentLastMove = currentPly === 0 ? null : replayMoves[currentPly - 1]?.move ?? null;

  // Hướng nhìn bàn cờ theo phe của người chơi trong ván
  const orientation = detail.yourColor === 'RED' ? 'r' : 'b';

  // Nhóm các nước thành từng cặp (Đỏ - Đen)
  const pairedMoves: Array<{
    turnNumber: number;
    red?: ReplayMoveItem;
    black?: ReplayMoveItem;
  }> = [];

  for (let i = 0; i < replayMoves.length; i += 2) {
    pairedMoves.push({
      turnNumber: Math.floor(i / 2) + 1,
      red: replayMoves[i],
      black: replayMoves[i + 1],
    });
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] max-w-6xl mx-auto px-3 py-4 sm:px-4 sm:py-6 flex flex-col gap-4 text-slate-100">
      {/* Header điều hướng và thông tin ván */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/history"
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 transition hover:border-amber-400/60 hover:text-amber-200"
          >
            ← Lịch sử
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-amber-200 truncate">
            Xem lại ván đấu #{detail.matchId}
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{formatEndedAt(detail.endedAt)}</span>
          <span>·</span>
          <span>{formatDuration(detail.durationSec)}</span>
        </div>
      </div>

      {/* Thông tin 2 người chơi & kết quả */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {/* Người chơi Đỏ */}
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-500/50 bg-red-950 text-base font-bold text-red-400">
            帥
          </span>
          <div className="min-w-0">
            <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">
              Bên Đỏ {detail.yourColor === 'RED' ? '(Bạn)' : ''}
            </div>
            <div className="text-sm font-bold text-slate-100 truncate">
              {detail.yourColor === 'RED' ? 'Bạn' : detail.opponent.displayName}
            </div>
            <div className="text-xs text-slate-400">
              Elo: {detail.yourColor === 'RED' ? (detail.ratingChange ? detail.ratingChange.before : '—') : detail.opponent.rating}
            </div>
          </div>
        </div>

        {/* Kết quả trung tâm */}
        <div className="flex flex-col items-center justify-center text-center py-1 sm:py-0 border-y sm:border-y-0 sm:border-x border-slate-800">
          <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${OUTCOME_STYLE[detail.outcome]}`}>
            {OUTCOME_LABEL[detail.outcome]}
          </span>
          <span className="mt-1 text-xs text-slate-400">
            {detail.endReason ? (HISTORY_END_REASON_LABELS[detail.endReason] ?? detail.endReason) : 'Kết thúc'}
          </span>
        </div>

        {/* Người chơi Đen */}
        <div className="flex items-center justify-end sm:justify-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-600 bg-slate-950 text-base font-bold text-slate-300">
            將
          </span>
          <div className="min-w-0 text-right sm:text-left">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Bên Đen {detail.yourColor === 'BLACK' ? '(Bạn)' : ''}
            </div>
            <div className="text-sm font-bold text-slate-100 truncate">
              {detail.yourColor === 'BLACK' ? 'Bạn' : detail.opponent.displayName}
            </div>
            <div className="text-xs text-slate-400">
              Elo: {detail.yourColor === 'BLACK' ? (detail.ratingChange ? detail.ratingChange.before : '—') : detail.opponent.rating}
            </div>
          </div>
        </div>
      </div>

      {/* Khu vực trung tâm: Bàn cờ và Bảng danh sách nước */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Bàn cờ 2.5D */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="w-full max-w-[560px]">
            <Board
              fen={currentFen}
              orientation={orientation}
              lastMove={currentLastMove}
              className="w-full drop-shadow-2xl pointer-events-none select-none"
            />
          </div>

          {/* Thanh điều khiển Replay */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 w-full max-w-[560px]">
            <button
              type="button"
              disabled={currentPly === 0}
              onClick={handleFirst}
              aria-label="Về đầu"
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              |◀ Về đầu
            </button>
            <button
              type="button"
              disabled={currentPly === 0}
              onClick={handlePrev}
              aria-label="Lùi"
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ◀ Lùi
            </button>
            <span
              data-testid="replay-step-indicator"
              className="px-3 py-2 text-xs sm:text-sm font-mono text-slate-300 font-medium"
            >
              Nước {currentPly} / {replayMoves.length}
            </span>
            <button
              type="button"
              disabled={currentPly === replayMoves.length}
              onClick={handleNext}
              aria-label="Tiến"
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tiến ▶
            </button>
            <button
              type="button"
              disabled={currentPly === replayMoves.length}
              onClick={handleLast}
              aria-label="Về cuối"
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Về cuối ▶|
            </button>
          </div>
        </div>

        {/* Danh sách nước đi bên phải */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Danh sách nước đi
            </span>
            <span className="text-xs text-slate-500">{replayMoves.length} nước</span>
          </div>

          <div
            data-testid="replay-move-list"
            className="flex-1 overflow-y-auto max-h-[360px] sm:max-h-[440px] pr-1 space-y-1 font-mono text-xs sm:text-sm"
          >
            {/* Nước 0 (Khởi đầu) */}
            <button
              type="button"
              onClick={() => setCurrentPly(0)}
              className={`w-full flex items-center justify-between rounded px-2.5 py-1.5 transition text-left ${
                currentPly === 0
                  ? 'bg-amber-400/20 text-amber-200 font-bold border border-amber-400/40'
                  : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span>0. Khởi đầu</span>
              <span className="text-[10px] text-slate-500">Thế xuất phát</span>
            </button>

            {/* Các hiệp tiếp theo */}
            {pairedMoves.map((pair) => (
              <div
                key={pair.turnNumber}
                className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-800/30"
              >
                <span className="w-8 shrink-0 text-slate-500 text-xs text-right pr-2">
                  {pair.turnNumber}.
                </span>

                {/* Nước của Đỏ */}
                <div className="flex-1">
                  {pair.red ? (
                    <button
                      type="button"
                      ref={currentPly === pair.red.ply ? activeMoveRef : undefined}
                      onClick={() => setCurrentPly(pair.red!.ply)}
                      className={`w-full rounded px-2 py-1 text-left transition truncate min-h-[32px] sm:min-h-0 ${
                        currentPly === pair.red.ply
                          ? 'bg-red-500/20 text-red-300 font-bold border border-red-500/50 shadow-sm'
                          : 'text-red-400 hover:bg-slate-800/60'
                      }`}
                    >
                      {pair.red.notation}
                    </button>
                  ) : (
                    <span className="px-2 text-slate-600">—</span>
                  )}
                </div>

                {/* Nước của Đen */}
                <div className="flex-1">
                  {pair.black ? (
                    <button
                      type="button"
                      ref={currentPly === pair.black.ply ? activeMoveRef : undefined}
                      onClick={() => setCurrentPly(pair.black!.ply)}
                      className={`w-full rounded px-2 py-1 text-left transition truncate min-h-[32px] sm:min-h-0 ${
                        currentPly === pair.black.ply
                          ? 'bg-slate-400/20 text-slate-100 font-bold border border-slate-400/50 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      {pair.black.notation}
                    </button>
                  ) : (
                    <span className="px-2 text-slate-600">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
