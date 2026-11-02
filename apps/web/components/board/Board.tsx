'use client';

import React, { useId, useMemo } from 'react';
import { Position, STARTING_FEN, isValidSquare, Piece } from '@xiangqi-arena/xiangqi-core';
import {
  BOARD_ASPECT,
  COS_TILT,
  FRONT_FACE_PATH,
  GRAIN_LINES,
  GRID_PATHS,
  INNER_BORDER_PATH,
  SIN_TILT,
  STAR_MARKS,
  SURFACE_PATH,
  UNIT,
  VIEW_BOX_ATTR,
  displayColRow,
  project,
  projectSquare,
  quadPoints,
} from './board-projection';

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

/** Chữ Hán trên mặt quân: Đỏ dùng 帥仕相傌俥炮兵, Đen dùng 將士象馬車砲卒 */
const PIECE_GLYPH: Record<string, string> = {
  rk: '帥', ra: '仕', rb: '相', rn: '傌', rr: '俥', rc: '炮', rp: '兵',
  bk: '將', ba: '士', bb: '象', bn: '馬', br: '車', bc: '砲', bp: '卒',
};

const PIECE_NAME_VI: Record<string, string> = {
  k: 'Tướng', a: 'Sĩ', b: 'Tượng', n: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt',
};

/** Tên cột in ở mép bàn: Đỏ đánh số chữ Hán từ phải sang trái của Đỏ, Đen đánh số Ả Rập từ phải sang trái của Đen */
const RED_FILES = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
const BLACK_FILES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const KAI_FONT =
  '"KaiTi","STKaiti","Kaiti SC","Kaiti TC","BiauKai","DFKai-SB","Noto Serif CJK TC","Noto Serif TC","SimSun",serif';

/** Kích thước quân (đơn vị viewBox, trước khi nhân hệ số phối cảnh) */
const PIECE_R = 0.44 * UNIT;
const PIECE_H = 0.36 * UNIT * SIN_TILT;

const INK = { r: '#b4231c', b: '#1c1917' } as const;

/** Chữ nằm trên mặt bàn: dịch tới điểm chiếu rồi ép dẹt theo góc nghiêng */
function planeTextTransform(col: number, row: number) {
  const p = project(col, row);
  return `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(3)} ${(p.s * COS_TILT).toFixed(3)})`;
}

const RIVER_TEXT: Array<{ ch: string; col: number }> = [
  { ch: '楚', col: 1.5 },
  { ch: '河', col: 2.5 },
  { ch: '漢', col: 5.5 },
  { ch: '界', col: 6.5 },
];

function captureCornersPath(col: number, row: number): string {
  const a = 0.5;
  const len = 0.16;
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return corners
    .map(([dx, dy]) => {
      const corner = project(col + dx * a, row + dy * a);
      const h = project(col + dx * (a - len), row + dy * a);
      const v = project(col + dx * a, row + dy * (a - len));
      return `M${h.x.toFixed(2)} ${h.y.toFixed(2)} L${corner.x.toFixed(2)} ${corner.y.toFixed(2)} L${v.x.toFixed(2)} ${v.y.toFixed(2)}`;
    })
    .join(' ');
}

export default function Board({
  board,
  fen,
  position,
  orientation = 'r',
  selectedSquare,
  lastMove,
  validMoves = [],
  onSquareClick,
  className = '',
}: BoardProps) {
  // id riêng cho gradient/filter để nhiều bàn cờ trên cùng trang không giẫm id của nhau
  const uid = `xq${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ref = (name: string) => `url(#${uid}-${name})`;

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
  const interactive = Boolean(onSquareClick);
  const move = lastMove && isValidSquare(lastMove.from) && isValidSquare(lastMove.to) ? lastMove : null;
  const hintSquares = (validMoves ?? []).filter((sq) => isValidSquare(sq));
  const quietHints = hintSquares.filter((sq) => !boardArray[sq]);
  const captureHints = hintSquares.filter((sq) => boardArray[sq]);

  // Vẽ quân từ hàng xa tới hàng gần để quân gần che quân xa
  const pieces = boardArray
    .map((piece, sq) => (piece ? { piece, sq, ...displayColRow(sq, orientation) } : null))
    .filter((p): p is { piece: Piece; sq: number; col: number; row: number } => p !== null)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const filesBottom = orientation === 'r' ? RED_FILES : [...BLACK_FILES].reverse();
  const filesTop = orientation === 'r' ? BLACK_FILES : [...RED_FILES].reverse();

  return (
    <div
      className={`relative inline-block w-full max-w-[640px] select-none ${className}`}
      style={{ aspectRatio: BOARD_ASPECT.toFixed(4) }}
    >
      <svg
        viewBox={VIEW_BOX_ATTR}
        className={`block h-full w-full overflow-visible ${interactive ? 'xq-board--interactive' : ''}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Bàn cờ tướng"
      >
        <defs>
          <linearGradient id={`${uid}-surface`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9a866" />
            <stop offset="0.55" stopColor="#e8bf80" />
            <stop offset="1" stopColor="#f0cd93" />
          </linearGradient>
          <radialGradient id={`${uid}-sheen`} cx="0.38" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#fff6dd" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff6dd" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8692f" />
            <stop offset="1" stopColor="#5e3617" />
          </linearGradient>
          <linearGradient id={`${uid}-piece-side`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7a4a1f" />
            <stop offset="0.3" stopColor="#d7a865" />
            <stop offset="0.55" stopColor="#c08a4a" />
            <stop offset="1" stopColor="#6b3f18" />
          </linearGradient>
          <radialGradient id={`${uid}-piece-top`} cx="0.4" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="0.6" stopColor="#f6e2b8" />
            <stop offset="1" stopColor="#dcb779" />
          </radialGradient>
          <filter id={`${uid}-blur-sm`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id={`${uid}-blur-lg`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* Layer 0: Bóng đổ của cả bàn + mép trước tạo bề dày */}
        <path d={SURFACE_PATH} transform="translate(0 22)" fill="#000" opacity="0.45" filter={ref('blur-lg')} />
        <path d={FRONT_FACE_PATH} fill={ref('front')} />

        {/* Layer 1: Mặt gỗ, vân gỗ, đường kẻ, chữ Sở Hà – Hán Giới, số cột */}
        <path d={SURFACE_PATH} fill={ref('surface')} stroke="#8a5a2b" strokeWidth="1.5" />
        <g fill="none" stroke="#8b5220" strokeLinecap="round">
          {GRAIN_LINES.map((g, i) => (
            <path key={`grain-${i}`} d={g.d} strokeWidth={g.width} opacity={g.opacity} />
          ))}
        </g>
        <path d={SURFACE_PATH} fill={ref('sheen')} />
        <g fill="none" stroke="#4a2c12" strokeLinecap="round" strokeLinejoin="round">
          <path d={INNER_BORDER_PATH} strokeWidth="4" />
          {GRID_PATHS.map((d, i) => (
            <path key={`grid-${i}`} d={d} strokeWidth="1.8" />
          ))}
          {STAR_MARKS.map((d, i) => (
            <path key={`star-${i}`} d={d} strokeWidth="1.6" />
          ))}
        </g>
        <g fill="#5b3415" opacity="0.55" fontFamily={KAI_FONT} fontSize="46" textAnchor="middle" dominantBaseline="central">
          {RIVER_TEXT.map(({ ch, col }) => (
            <text key={ch} transform={planeTextTransform(col, 4.5)}>
              {ch}
            </text>
          ))}
        </g>
        <g fill="#5b3415" opacity="0.6" fontSize="19" fontWeight="600" textAnchor="middle" dominantBaseline="central">
          {filesTop.map((label, col) => (
            <text key={`ft-${col}`} transform={planeTextTransform(col, -0.64)}>
              {label}
            </text>
          ))}
          {filesBottom.map((label, col) => (
            <text key={`fb-${col}`} transform={planeTextTransform(col, 9.66)}>
              {label}
            </text>
          ))}
        </g>

        {/* Layer 2: Highlight nước vừa đi và ô đang chọn, nằm trên mặt bàn */}
        {move && (
          <>
            <polygon
              data-testid="last-move-from"
              data-square={move.from}
              points={quadPoints(displayColRow(move.from, orientation).col, displayColRow(move.from, orientation).row, 0.42)}
              fill="rgba(234, 88, 12, 0.18)"
              stroke="rgba(234, 88, 12, 0.7)"
              strokeWidth="2"
              strokeDasharray="6 5"
              className="pointer-events-none"
            />
            <polygon
              data-testid="last-move-to"
              data-square={move.to}
              points={quadPoints(displayColRow(move.to, orientation).col, displayColRow(move.to, orientation).row, 0.46)}
              fill="rgba(234, 88, 12, 0.32)"
              stroke="rgba(194, 65, 12, 0.85)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          </>
        )}
        {selectedSquare != null && isValidSquare(selectedSquare) && (
          <polygon
            data-testid="selected-mask"
            data-square={selectedSquare}
            points={quadPoints(
              displayColRow(selectedSquare, orientation).col,
              displayColRow(selectedSquare, orientation).row,
              0.47,
            )}
            fill="rgba(250, 204, 21, 0.35)"
            stroke="rgba(161, 98, 7, 0.9)"
            strokeWidth="3"
            strokeLinejoin="round"
            className="pointer-events-none"
          />
        )}

        {/* Layer 3: Gợi ý ô trống đi được (chấm xanh nằm trên mặt bàn, dưới quân) */}
        {quietHints.map((sq) => {
          const p = projectSquare(sq, orientation);
          const rx = 0.15 * UNIT * p.s;
          return (
            <g key={`valid-move-group-${sq}`} data-testid={`valid-move-${sq}`} className="pointer-events-none">
              <ellipse
                data-testid={`hint-sq-${sq}`}
                data-hint-type="peaceful"
                cx={p.x}
                cy={p.y}
                rx={rx}
                ry={rx * COS_TILT}
                fill="rgba(22, 163, 74, 0.8)"
                stroke="rgba(240, 253, 244, 0.9)"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* Layer 4: 90 ô tương tác click */}
        {Array.from({ length: 90 }, (_, sq) => {
          const { col, row } = displayColRow(sq, orientation);
          return (
            <polygon
              key={`cell-${sq}`}
              data-testid={`cell-${sq}`}
              points={quadPoints(col, row, 0.5)}
              fill="transparent"
              className={interactive ? 'cursor-pointer' : undefined}
              onClick={() => onSquareClick?.(sq)}
            />
          );
        })}

        {/* Layer 5: Quân cờ dạng khối trụ có bề dày và bóng đổ */}
        {pieces.map(({ piece, sq, col, row }) => {
          const code = `${piece.color}${piece.type}`;
          const p = project(col, row);
          const isSelected = selectedSquare === sq;
          const arriving = move !== null && move.to === sq;
          let arriveStyle: React.CSSProperties | undefined;
          if (arriving) {
            const from = projectSquare(move.from, orientation);
            arriveStyle = {
              ['--dx' as string]: (from.x - p.x).toFixed(2),
              ['--dy' as string]: (from.y - p.y).toFixed(2),
            };
          }
          const scale = p.s.toFixed(3);

          return (
            <g
              // Đổi key khi có nước mới để quân vừa đi được mount lại và chạy hiệu ứng trượt
              key={arriving ? `piece-${sq}-from-${move.from}` : `piece-${sq}`}
              data-testid={`piece-${sq}`}
              data-piece={code}
              data-col={col}
              data-row={row}
              transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
              className={`xq-piece${interactive ? ' cursor-pointer' : ''}${isSelected ? ' xq-piece--selected' : ''}`}
              aria-label={`${PIECE_NAME_VI[piece.type]} ${piece.color === 'r' ? 'Đỏ' : 'Đen'}`}
              onClick={(e) => {
                e.stopPropagation();
                onSquareClick?.(sq);
              }}
            >
              <g className={arriving ? 'xq-arrive' : undefined} style={arriveStyle}>
                <g transform={`scale(${scale})`}>
                  <ellipse
                    className="xq-shadow"
                    cx={5}
                    cy={4}
                    rx={PIECE_R * 1.05}
                    ry={PIECE_R * COS_TILT * 1.05}
                    fill="#1a0f05"
                    opacity="0.5"
                    filter={ref('blur-sm')}
                  />
                </g>
                <g className="xq-lift">
                  <g transform={`scale(${scale})`}>
                    <ellipse cx={0} cy={0} rx={PIECE_R} ry={PIECE_R * COS_TILT} fill={ref('piece-side')} />
                    <rect x={-PIECE_R} y={-PIECE_H} width={PIECE_R * 2} height={PIECE_H} fill={ref('piece-side')} />
                    <g transform={`translate(0 ${(-PIECE_H).toFixed(2)}) scale(1 ${COS_TILT.toFixed(4)})`}>
                      <circle r={PIECE_R} fill={ref('piece-top')} stroke="#8a5a2b" strokeWidth="1.5" />
                      <circle r={PIECE_R * 0.8} fill="none" stroke={INK[piece.color]} strokeWidth="2.6" />
                      <g textAnchor="middle" dominantBaseline="central" fontSize={PIECE_R * 1.05} fontWeight="700" fontFamily={KAI_FONT}>
                        <text y={1.5} fill="#fff" opacity="0.6">
                          {PIECE_GLYPH[code]}
                        </text>
                        <text fill={INK[piece.color]}>{PIECE_GLYPH[code]}</text>
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          );
        })}

        {/* Layer 6: Ô ăn quân được: 4 góc đỏ quanh quân, vẽ trên quân để luôn thấy */}
        {captureHints.map((sq) => {
          const { col, row } = displayColRow(sq, orientation);
          return (
            <g key={`valid-move-group-${sq}`} data-testid={`valid-move-${sq}`} className="pointer-events-none">
              <path
                data-testid={`hint-sq-${sq}`}
                data-hint-type="capture"
                d={captureCornersPath(col, row)}
                fill="none"
                stroke="rgba(220, 38, 38, 0.95)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
