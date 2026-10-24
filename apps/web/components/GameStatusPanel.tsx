'use client';

import React from 'react';
import { Side } from '@xiangqi-arena/xiangqi-core';
import Modal from './Modal';

export interface GameResult {
  winner: Side;
  reason: 'checkmate' | 'no-legal-moves';
}

export interface GameStatusPanelProps {
  sideToMove: Side | null;
  isCheck: boolean;
  result: GameResult | null;
  onNewGame: () => void;
}

const sideName = (side: Side) => (side === 'r' ? 'Đỏ' : 'Đen');

const opponentOf = (side: Side): Side => (side === 'r' ? 'b' : 'r');

// Bên thua là bên còn lại của người thắng (Luật Cờ Tướng, Điều 7.1a/b).
const resultReason = ({ winner, reason }: GameResult) =>
  reason === 'checkmate'
    ? 'Chiếu bí'
    : `${sideName(opponentOf(winner))} hết nước đi`;

export default function GameStatusPanel({
  sideToMove,
  isCheck,
  result,
  onNewGame,
}: GameStatusPanelProps) {
  return (
    <>
      <section
        aria-label="Trạng thái ván đấu"
        aria-live="polite"
        className="w-full max-w-[560px] rounded-xl border border-slate-700/80 bg-slate-800/90 p-4 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Trạng thái ván đấu
            </p>
            <p className="mt-1 text-sm font-bold text-slate-100">
              {sideToMove ? `Đến lượt ${sideName(sideToMove)}` : 'Ván đấu đã kết thúc'}
            </p>
          </div>
          {isCheck && (
            <span className="rounded-lg border border-red-500/50 bg-red-950/70 px-3 py-1.5 text-xs font-extrabold tracking-wider text-red-300">
              CHIẾU
            </span>
          )}
        </div>
      </section>

      <Modal
        isOpen={result !== null}
        title="Ván đấu kết thúc"
        message={
          result
            ? `${sideName(result.winner)} thắng — ${resultReason(result)}.`
            : ''
        }
        confirmText="Ván mới"
        onConfirm={onNewGame}
      />
    </>
  );
}
