'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Position, algebraicToSquare, type Move, type Piece } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/board/Board';
import { formatVietnameseMove } from '@/lib/ai/vietnamese-notation';

/**
 * 8 nước khai cuộc mẫu kinh điển: Pháo đầu đối Bình phong Mã.
 * [nước đi từ, nước đi tới]. Ký hiệu nước được tính tự động bằng formatVietnameseMove.
 */
export const HERO_OPENING_MOVES: ReadonlyArray<[string, string]> = [
  ['h7', 'e7'], // Đỏ: Pháo 2 bình 5
  ['b0', 'c2'], // Đen: Mã 2 tấn 3 (cột b là cột 2 của Đen)
  ['h9', 'g7'], // Đỏ: Mã 2 tấn 3
  ['h0', 'g2'], // Đen: Mã 8 tấn 7 (cột h là cột 8 của Đen)
  ['i9', 'h9'], // Đỏ: Xe 1 bình 2
  ['c3', 'c4'], // Đen: Tốt 3 tấn 1 (cột c là cột 3 của Đen)
  ['h9', 'h3'], // Đỏ: Xe 2 tấn 6
  ['d0', 'e1'], // Đen: Sĩ 4 tấn 5
];

export interface StepSnapshot {
  board: (Piece | null)[];
  lastMove: { from: number; to: number } | null;
  notation: string;
  stepLabel: string;
}

export default function HeroBoard() {
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Tạo sẵn các thế cờ cho từng bước khai cuộc với ký hiệu tính tự động từ engine
  const snapshots: StepSnapshot[] = useMemo(() => {
    const snaps: StepSnapshot[] = [];
    const pos = Position.initial();

    snaps.push({
      board: [...pos.board],
      lastMove: null,
      notation: 'Thế cờ khởi đầu',
      stepLabel: 'Khai cuộc: Pháo đầu vs Bình phong Mã',
    });

    let ply = 1;
    for (const [fromAlg, toAlg] of HERO_OPENING_MOVES) {
      const move: Move = {
        from: algebraicToSquare(fromAlg),
        to: algebraicToSquare(toAlg),
      };
      // Tính ký hiệu tiếng Việt CHÍNH XÁC từ thế cờ trước nước đi
      const notation = formatVietnameseMove(pos, move);
      const moveNum = Math.ceil(ply / 2);
      const isRed = ply % 2 === 1;
      const stepLabel = isRed ? `${moveNum}. ${notation}` : `${moveNum}... ${notation}`;

      pos.applyMove(move);
      snaps.push({
        board: [...pos.board],
        lastMove: move,
        notation,
        stepLabel,
      });
      ply++;
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
            {current.stepLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className="rounded px-2.5 py-1 text-xs border border-wood-700/60 bg-ink-900/80 text-paper-300 hover:text-paper-100 transition min-h-[36px]"
          aria-label={isPaused ? 'Tiếp tục chạy bàn cờ' : 'Tạm dừng chạy bàn cờ'}
        >
          {isPaused ? '▶ Chạy tiếp' : '⏸ Dừng'}
        </button>
      </div>
    </div>
  );
}
