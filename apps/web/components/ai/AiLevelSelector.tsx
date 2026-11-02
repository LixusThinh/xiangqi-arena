'use client';

import React from 'react';
import type { AiLevel } from '@xiangqi-arena/xiangqi-core';

export interface AiLevelSelectorProps {
  level: AiLevel;
  onSelectLevel: (lvl: AiLevel) => void;
  playerSide: 'r' | 'b';
  onSelectSide: (side: 'r' | 'b') => void;
  onStartGame: () => void;
}

export const AI_LEVEL_DESCRIPTIONS: Record<AiLevel, { label: string; desc: string }> = {
  EASY: {
    label: 'Dễ',
    desc: 'Tính toán 1 nước, có sai số nhỏ, phù hợp người mới tập chơi.',
  },
  MEDIUM: {
    label: 'Trung bình',
    desc: 'Tính toán 2 nước, cân bằng và ít sai sót, phù hợp người chơi phong trào.',
  },
  HARD: {
    label: 'Khó',
    desc: 'Tính toán 3 nước, cắt tỉa tối ưu, không sai sót, thử thách bản lĩnh kỳ thủ.',
  },
};

export default function AiLevelSelector({
  level,
  onSelectLevel,
  playerSide,
  onSelectSide,
  onStartGame,
}: AiLevelSelectorProps) {
  const levels: AiLevel[] = ['EASY', 'MEDIUM', 'HARD'];

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-2xl backdrop-blur">
      <div className="mb-6 text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-200">
          Chơi cờ tướng với máy
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Không cần đăng nhập, chọn độ khó và màu quân để bắt đầu tranh tài ngay.
        </p>
      </div>

      {/* Chọn độ khó */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Chọn độ khó
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {levels.map((lvl) => {
            const isSelected = level === lvl;
            const item = AI_LEVEL_DESCRIPTIONS[lvl];
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onSelectLevel(lvl)}
                className={`flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition min-h-[44px] ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/10 text-amber-200 shadow-md ring-1 ring-amber-400/50'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="font-bold text-sm sm:text-base flex items-center justify-between w-full">
                  <span>{item.label}</span>
                  {isSelected && <span className="text-amber-400 text-xs font-normal">● Đã chọn</span>}
                </div>
                <div className="mt-1 text-xs text-slate-400 leading-snug">
                  {item.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chọn màu quân */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Chọn phe (Màu quân)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectSide('r')}
            className={`flex items-center gap-3 rounded-xl border p-3.5 transition min-h-[44px] ${
              playerSide === 'r'
                ? 'border-red-500 bg-red-500/10 text-red-200 shadow-md ring-1 ring-red-500/50'
                : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-red-500/50 bg-red-950 text-base font-bold text-red-400">
              帥
            </span>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-100">Cầm Đỏ (Đi trước)</div>
              <div className="text-xs text-slate-400">Bạn sẽ đi nước đầu tiên</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectSide('b')}
            className={`flex items-center gap-3 rounded-xl border p-3.5 transition min-h-[44px] ${
              playerSide === 'b'
                ? 'border-slate-400 bg-slate-400/10 text-slate-200 shadow-md ring-1 ring-slate-400/50'
                : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-950 text-base font-bold text-slate-300">
              將
            </span>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-100">Cầm Đen (Đi sau)</div>
              <div className="text-xs text-slate-400">Máy sẽ đi nước đầu tiên</div>
            </div>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartGame}
        className="w-full flex min-h-[44px] items-center justify-center rounded-xl bg-amber-400 px-4 py-2.5 text-base font-bold text-slate-950 transition hover:bg-amber-300 shadow-lg shadow-amber-500/20 active:scale-[0.99]"
      >
        Vào ván đấu
      </button>
    </div>
  );
}
