'use client';

import React from 'react';
import type { AiLevel } from '@xiangqi-arena/xiangqi-core';
import type { AiGameSummary } from '@/lib/ai-game-api';

export interface AiLevelSelectorProps {
  level: AiLevel;
  onSelectLevel: (lvl: AiLevel) => void;
  playerSide: 'r' | 'b';
  onSelectSide: (side: 'r' | 'b') => void;
  onStartGame: () => void;
  isLoggedIn?: boolean;
  savedGames?: AiGameSummary[];
  loadingSavedGames?: boolean;
  onResumeGame?: (game: AiGameSummary) => void;
  onDeleteGame?: (game: AiGameSummary) => void;
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

function formatUpdatedAt(isoString: string): string {
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN');
    return `${time} ${date}`;
  } catch {
    return isoString;
  }
}

export default function AiLevelSelector({
  level,
  onSelectLevel,
  playerSide,
  onSelectSide,
  onStartGame,
  isLoggedIn = false,
  savedGames = [],
  loadingSavedGames = false,
  onResumeGame,
  onDeleteGame,
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

      {/* Khối Ván đã lưu (chỉ hiện khi đã đăng nhập) */}
      {isLoggedIn && (
        <div className="mt-6 border-t border-slate-800 pt-5" data-testid="saved-games-section">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-amber-200">
            Ván đã lưu
          </h2>
          {loadingSavedGames ? (
            <div className="text-center text-xs text-slate-400 py-3">
              Đang tải danh sách ván đã lưu…
            </div>
          ) : savedGames.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-3">
              Chưa có ván cờ nào được lưu.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
              {savedGames.map((game) => (
                <div
                  key={game.id}
                  data-testid={`saved-game-${game.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex flex-col gap-0.5 text-xs text-slate-300">
                    <div className="font-semibold text-slate-200">
                      Mức: {AI_LEVEL_DESCRIPTIONS[game.level]?.label ?? game.level} · Phe: {game.playerColor === 'r' ? 'Đỏ' : 'Đen'}
                    </div>
                    <div className="text-slate-400">
                      {game.plyCount} nước · Cập nhật lúc {formatUpdatedAt(game.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onResumeGame?.(game)}
                      className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition"
                    >
                      Tiếp tục
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGame?.(game)}
                      className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
