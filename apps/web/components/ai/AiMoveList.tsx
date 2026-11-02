'use client';

import React, { useEffect, useRef } from 'react';

export interface MoveHistoryItem {
  ply: number;
  notation: string;
  side: 'r' | 'b';
}

export interface AiMoveListProps {
  moves: MoveHistoryItem[];
}

export default function AiMoveList({ moves }: AiMoveListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Nhóm các nước đi theo từng hiệp (cặp Đỏ - Đen)
  const pairedMoves: Array<{
    turnNumber: number;
    red?: MoveHistoryItem;
    black?: MoveHistoryItem;
  }> = [];

  for (let i = 0; i < moves.length; i += 2) {
    const red = moves[i]?.side === 'r' ? moves[i] : undefined;
    const black = moves[i]?.side === 'b' ? moves[i] : moves[i + 1]?.side === 'b' ? moves[i + 1] : undefined;
    pairedMoves.push({
      turnNumber: Math.floor(i / 2) + 1,
      red,
      black,
    });
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Biên bản ván đấu
        </span>
        <span className="text-xs text-slate-500">{moves.length} nước</span>
      </div>

      <div
        ref={containerRef}
        data-testid="ai-move-list"
        className="flex-1 overflow-y-auto max-h-[220px] sm:max-h-[340px] pr-1 space-y-1 text-sm font-mono"
      >
        {pairedMoves.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 italic">
            Chưa có nước đi nào
          </div>
        ) : (
          pairedMoves.map((pair) => (
            <div
              key={pair.turnNumber}
              className="flex items-center rounded px-2 py-1 hover:bg-slate-800/50 text-xs sm:text-sm"
            >
              <span className="w-8 shrink-0 text-slate-500">
                {pair.turnNumber}.
              </span>
              <span className="flex-1 truncate text-red-400 font-medium">
                {pair.red?.notation ?? '—'}
              </span>
              <span className="flex-1 truncate text-slate-300 font-medium">
                {pair.black?.notation ?? '—'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
