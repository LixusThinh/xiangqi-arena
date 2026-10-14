'use client';

import React, { useMemo } from 'react';
import { Position, STARTING_FEN, isValidSquare, Piece } from '@xiangqi-arena/xiangqi-core';
import {
  getSquareCoordinates,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
} from './board-geometry';

export interface BoardProps {
  /** Mảng 90 ô quân cờ trực tiếp từ state */
  board?: (Piece | null)[];

  /** Chuỗi FEN. Nếu không truyền board hoặc position, component sẽ parse FEN này. */
  fen?: string;

  /** Đối tượng Position từ @xiangqi-arena/xiangqi-core. */
  position?: Position;

  /** Hướng nhìn: 'r' = Đỏ ở dưới (mặc định), 'b' = Đen ở dưới */
  orientation?: 'r' | 'b';

  /** Ô cờ đang được chọn (0..89) */
  selectedSquare?: number | null;

  /** Nước đi gần nhất để highlight { from, to } */
  lastMove?: { from: number; to: number } | null;

  /** Danh sách các ô đi hợp lệ từ ô đang chọn để hiển thị gợi ý */
  validMoves?: number[];

  /** Callback khi click vào bất kỳ ô nào */
  onSquareClick?: (square: number) => void;

  /** CSS class tùy biến */
  className?: string;
}

export default function Board({
  board,
  fen,
  position,
  orientation = 'r',
  selectedSquare,
  lastMove,
  validMoves,
  onSquareClick,
  className = '',
}: BoardProps) {
  // Resolve Position instance or parse FEN safely
  const { currentPos, error } = useMemo(() => {
    if (board) {
      return { currentPos: null, error: null };
    }
    if (position) {
      return { currentPos: position, error: null };
    }
    const fenStringToUse = fen ?? STARTING_FEN;
    try {
      return { currentPos: Position.fromFen(fenStringToUse), error: null };
    } catch (err) {
      return {
        currentPos: null,
        error: err instanceof Error ? err.message : 'Invalid FEN',
      };
    }
  }, [board, position, fen]);

  if (!board && (error || !currentPos)) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 ${className}`}>
        <p className="font-semibold">FEN không hợp lệ</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  const boardArray = board ?? currentPos!.board;

  return (
    <div
      className={`relative inline-block w-full max-w-[560px] aspect-[741/821] select-none shadow-2xl rounded-lg overflow-hidden ${className}`}
    >
      <svg
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 1: Nền bàn cờ */}
        <image
          href="/ChessImage/BOARD.BMP"
          x="0"
          y="0"
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
        />

        {/* Layer 2: Highlight nước vừa đi (lastMove) */}
        {lastMove && isValidSquare(lastMove.from) && isValidSquare(lastMove.to) && (
          <>
            {(() => {
              const fromCoords = getSquareCoordinates(lastMove.from, orientation);
              return (
                <image
                  data-testid="last-move-from"
                  href="/ChessImage/mask2.png"
                  x={fromCoords.x}
                  y={fromCoords.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  className="pointer-events-none opacity-80"
                />
              );
            })()}
            {(() => {
              const toCoords = getSquareCoordinates(lastMove.to, orientation);
              return (
                <image
                  data-testid="last-move-to"
                  href="/ChessImage/mask2.png"
                  x={toCoords.x}
                  y={toCoords.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  className="pointer-events-none opacity-80"
                />
              );
            })()}
          </>
        )}

        {/* Layer 2b: Highlight ô đang chọn (selectedSquare) */}
        {selectedSquare != null && isValidSquare(selectedSquare) && (
          (() => {
            const coords = getSquareCoordinates(selectedSquare, orientation);
            return (
              <image
                data-testid="selected-mask"
                href="/ChessImage/mask.png"
                x={coords.x}
                y={coords.y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                className="pointer-events-none"
              />
            );
          })()
        )}

        {/* Layer 2c: Gợi ý các ô đi hợp lệ (validMoves) */}
        {validMoves && validMoves.length > 0 && validMoves.map((sq) => {
          if (!isValidSquare(sq)) return null;
          const coords = getSquareCoordinates(sq, orientation);
          const targetPiece = boardArray[sq];
          const isCapture = targetPiece !== null && targetPiece !== undefined;
          const cx = coords.x + CELL_SIZE / 2;
          const cy = coords.y + CELL_SIZE / 2;

          if (isCapture) {
            return (
              <circle
                key={`hint-${sq}`}
                data-testid={`hint-sq-${sq}`}
                data-hint-type="capture"
                cx={cx}
                cy={cy}
                r={CELL_SIZE * 0.42}
                fill="none"
                stroke="rgba(239, 68, 68, 0.85)"
                strokeWidth={3}
                strokeDasharray="4 2"
                className="pointer-events-none animate-pulse"
              />
            );
          }

          return (
            <circle
              key={`hint-${sq}`}
              data-testid={`hint-sq-${sq}`}
              data-hint-type="peaceful"
              cx={cx}
              cy={cy}
              r={CELL_SIZE * 0.16}
              fill="rgba(34, 197, 94, 0.65)"
              className="pointer-events-none"
            />
          );
        })}

        {/* Layer 3: 90 ô tương tác click */}
        {Array.from({ length: 90 }, (_, sq) => {
          const { x, y } = getSquareCoordinates(sq, orientation);
          return (
            <rect
              key={`cell-${sq}`}
              data-testid={`cell-${sq}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSquareClick?.(sq)}
            />
          );
        })}

        {/* Layer 4: Quân cờ */}
        {boardArray.map((piece, sq) => {
          if (!piece) return null;
          const { x, y } = getSquareCoordinates(sq, orientation);
          const iconName = `${piece.color}${piece.type}.ico`;
          const isSelected = selectedSquare === sq;

          return (
            <image
              key={`piece-${sq}`}
              data-testid={`piece-${sq}`}
              data-piece={`${piece.color}${piece.type}`}
              href={`/ChessImage/${iconName}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              className={`cursor-pointer pointer-events-auto transition-transform duration-100 [transform-box:fill-box] origin-center ${
                isSelected ? 'scale-105 filter drop-shadow-md' : 'hover:scale-105'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSquareClick?.(sq);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
