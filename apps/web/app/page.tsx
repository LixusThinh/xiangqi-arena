'use client';

import React, { useState, useMemo } from 'react';
import Board from '@/components/Board';
import { FEN_PRESETS } from '@/components/fen-presets';
import { Position, squareToAlgebraic, squareToCoord } from '@xiangqi-arena/xiangqi-core';

export default function DemoPage() {
  const [currentFen, setCurrentFen] = useState<string>(FEN_PRESETS[0].fen);
  const [inputFen, setInputFen] = useState<string>(FEN_PRESETS[0].fen);
  const [orientation, setOrientation] = useState<'r' | 'b'>('r');
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);

  // Position derived for status readout
  const positionInfo = useMemo(() => {
    try {
      const pos = Position.fromFen(currentFen);
      return {
        sideToMove: pos.sideToMove === 'r' ? 'Đỏ' : 'Đen',
        zobristHash: pos.toHashString(),
        board: pos.board,
        error: null,
      };
    } catch (e) {
      return {
        sideToMove: '-',
        zobristHash: '-',
        board: [],
        error: e instanceof Error ? e.message : 'Invalid FEN',
      };
    }
  }, [currentFen]);

  const handleSelectPreset = (fen: string) => {
    setCurrentFen(fen);
    setInputFen(fen);
    setSelectedSquare(null);
  };

  const handleApplyCustomFen = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentFen(inputFen.trim());
    setSelectedSquare(null);
  };

  const handleSquareClick = (sq: number) => {
    setSelectedSquare((prev) => (prev === sq ? null : sq));
  };

  const selectedPiece = selectedSquare != null && positionInfo.board[selectedSquare];

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-900 text-slate-100 flex flex-col items-center">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-amber-400">
          Xiangqi Arena — Bàn Cờ Tướng Web
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Issue XQA-43: Render bàn cờ từ FEN & Thay đổi góc nhìn Đỏ / Đen
        </p>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cột hiển thị bàn cờ */}
        <section className="lg:col-span-7 flex flex-col items-center">
          <Board
            fen={currentFen}
            orientation={orientation}
            selectedSquare={selectedSquare}
            onSquareClick={handleSquareClick}
          />
        </section>

        {/* Cột điều khiển & Thông tin */}
        <section className="lg:col-span-5 flex flex-col gap-6 bg-slate-800/80 backdrop-blur p-6 rounded-xl border border-slate-700 shadow-xl">
          {/* Nút lật bàn cờ */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block mb-2">
              Góc nhìn bàn cờ (Orientation)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrientation('r')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  orientation === 'r'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                🔴 Góc nhìn Đỏ (Mặc định)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('b')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  orientation === 'b'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                ⚫ Góc nhìn Đen (Lật 180°)
              </button>
            </div>
          </div>

          {/* Chọn 4 FEN mẫu */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block mb-2">
              Thế cờ mẫu (Acceptance Criteria)
            </label>
            <div className="flex flex-col gap-2">
              {FEN_PRESETS.map((preset, idx) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.fen)}
                  className={`text-left p-3 rounded-lg border text-sm transition-all ${
                    currentFen === preset.fen
                      ? 'bg-amber-500/10 border-amber-500/60 text-amber-300'
                      : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <div className="font-semibold">
                    {idx + 1}. {preset.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Nhập FEN tùy ý */}
          <form onSubmit={handleApplyCustomFen} className="flex flex-col gap-2">
            <label htmlFor="custom-fen" className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Nhập FEN tùy ý
            </label>
            <div className="flex gap-2">
              <input
                id="custom-fen"
                type="text"
                value={inputFen}
                onChange={(e) => setInputFen(e.target.value)}
                placeholder="Dán chuỗi FEN vào đây..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"
              >
                Áp dụng
              </button>
            </div>
          </form>

          {/* Bảng trạng thái */}
          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700 text-xs flex flex-col gap-2 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400 font-sans">Lượt đi:</span>
              <span className="font-bold text-amber-400">{positionInfo.sideToMove}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400 font-sans">Zobrist Hash:</span>
              <span className="text-slate-300">{positionInfo.zobristHash}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Ô đang chọn:</span>
              <span className="text-slate-300">
                {selectedSquare != null
                  ? `${squareToAlgebraic(selectedSquare)} (sq: ${selectedSquare}, col: ${
                      squareToCoord(selectedSquare).col
                    }, row: ${squareToCoord(selectedSquare).row}) ${
                      selectedPiece ? `[${selectedPiece.color === 'r' ? 'Đỏ' : 'Đen'} ${selectedPiece.type.toUpperCase()}]` : '[Ô trống]'
                    }`
                  : 'Chưa chọn'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
