'use client';

import React from 'react';
import { Side } from '@xiangqi-arena/xiangqi-core';

export interface MatchControlsProps {
  playerSide: Side;
  onSelectSide: (side: Side) => void;
  onNewGame: () => void;
  onOfferDraw: () => void;
  onLeaveRoom: () => void;
  className?: string;
}

export default function MatchControls({
  playerSide,
  onSelectSide,
  onNewGame,
  onOfferDraw,
  onLeaveRoom,
  className = '',
}: MatchControlsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 w-full max-w-[560px] p-3 bg-slate-800/90 border border-slate-700/80 rounded-xl shadow-lg backdrop-blur ${className}`}>
      {/* Chọn phe */}
      <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
        <button
          type="button"
          aria-pressed={playerSide === 'r'}
          onClick={() => onSelectSide('r')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            playerSide === 'r'
              ? 'bg-red-600 text-white shadow-md shadow-red-900/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          Phe Đỏ
        </button>
        <button
          type="button"
          aria-pressed={playerSide === 'b'}
          onClick={() => onSelectSide('b')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            playerSide === 'b'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
          Phe Đen
        </button>
      </div>

      {/* Nút thao tác trận đấu */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewGame}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/30 transition-colors shadow-sm"
        >
          🔄 Ván mới
        </button>
        <button
          type="button"
          onClick={onOfferDraw}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors shadow-sm"
        >
          🤝 Xin hòa
        </button>
        <button
          type="button"
          onClick={onLeaveRoom}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition-colors shadow-sm"
        >
          🚪 Thoát
        </button>
      </div>
    </div>
  );
}
