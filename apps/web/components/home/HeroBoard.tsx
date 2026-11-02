'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Position, algebraicToSquare, type Move, type Piece } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/board/Board';

/**
 * 8 nước khai cuộc mẫu kinh điển: Pháo đầu đối Bình phong Mã.
 * Đã kiểm tra tính hợp lệ qua engine của @xiangqi-arena/xiangqi-core.
 */
export const HERO_OPENING_MOVES: ReadonlyArray<[string, string, string]> = [
  ['h7', 'e7', 'Pháo 2 bình 5'],
  ['b0', 'c2', 'Mã 8 tấn 7'],
  ['h9', 'g7', 'Mã 2 tấn 3'],
  ['h0', 'g2', 'Mã 2 tấn 3'],
  ['i9', 'h9', 'Xe 1 bình 2'],
  ['c3', 'c4', 'Tốt 7 tấn 1'],
  ['h9', 'h3', 'Xe 2 tấn 6'],
  ['d0', 'e1', 'Sĩ 4 tấn 5'],
];

export interface StepSnapshot {
  board: (Piece | null)[];
  lastMove: { from: number; to: number } | null;
  notation: string | null;
}

export default function HeroBoard() {
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Tạo sẵn các thế cờ cho từng bước khai cuộc
  const snapshots: StepSnapshot[] = useMemo(() => {
    const snaps: StepSnapshot[] = [];
    const pos = Position.initial();
    snaps.push({
      board: [...pos.board],
      lastMove: null,
      notation: 'Thế cờ khởi đầu',
    });

    for (const [fromAlg, toAlg, desc] of HERO_OPENING_MOVES) {
      const move: Move = {
        from: algebraicToSquare(fromAlg),
        to: algebraicToSquare(toAlg),
      };
      pos.applyMove(move);
      snaps.push({
        board: [...pos.board],
        lastMove: move,
        notation: desc,
      });
    }

    return snaps;
  }, []);

  // Kiểm tra prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', listener);
    return () => mq.removeEventListener?.('change', listener);
  }, []);

  // Tự động chuyển động mỗi 1.2s (1200ms)
  useEffect(() => {
    if (reducedMotion || isPaused) return;

    const isLast = step >= snapshots.length - 1;
    const intervalTime = isLast ? 2400 : 1200; // Dừng lâu hơn ở nước cuối trước khi lặp lại

    const timer = setTimeout(() => {
      setStep((prev) => (prev >= snapshots.length - 1 ? 0 : prev + 1));
    }, intervalTime);

    return () => clearTimeout(timer);
  }, [step, isPaused, reducedMotion, snapshots.length]);

  const current = snapshots[step] ?? snapshots[0];

  return (
    <div className="relative mx-auto w-full max-w-[460px] flex flex-col items-center">
      {/* Khung bàn cờ */}
      <div className="w-full drop-shadow-2xl">
        <Board
          board={current.board}
          lastMove={current.lastMove}
          className="pointer-events-none select-none"
        />
      </div>

      {/* Chú thích nước đi và điều khiển */}
      <div className="mt-3 flex items-center justify-between w-full px-2 text-xs text-paper-400">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-cinnabar-500 animate-pulse" />
          <span className="font-medium text-paper-200">
            {step === 0 ? 'Khai cuộc: Pháo đầu vs Bình phong Mã' : `${step}. ${current.notation}`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className="rounded px-2 py-1 text-xs border border-wood-700/60 bg-ink-900/80 text-paper-300 hover:text-paper-100 transition min-h-[32px] sm:min-h-0"
          aria-label={isPaused ? 'Tiếp tục chạy bàn cờ' : 'Tạm dừng chạy bàn cờ'}
        >
          {isPaused ? '▶ Chạy tiếp' : '⏸ Dừng'}
        </button>
      </div>
    </div>
  );
}
