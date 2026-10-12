import React from 'react';
import { Position } from 'xiangqi-core/position/Position';

interface BoardProps {
  position?: Position;
  isFlipped?: boolean; // true nếu muốn lật bàn cờ (góc nhìn bên Đen)
}

// Hàm tạm để chuyển đổi loại quân cờ sang chữ Hán (bạn có thể điều chỉnh theo type thực tế của core)
const getPieceLabel = (type: string, isRed: boolean) => {
  const labels: Record<string, { red: string; black: string }> = {
    'GENERAL': { red: '帥', black: '將' }, // Tướng
    'ADVISOR': { red: '仕', black: '士' }, // Sĩ
    'ELEPHANT': { red: '相', black: '象' }, // Tượng
    'HORSE':   { red: '傌', black: '馬' }, // Mã
    'ROOK':    { red: '俥', black: '車' }, // Xe
    'CANNON':  { red: '炮', black: '砲' }, // Pháo
    'PAWN':    { red: '兵', black: '卒' }, // Tốt
  };
  return labels[type.toUpperCase()]?.[isRed ? 'red' : 'black'] || type;
};

export default function Board({ position, isFlipped = false }: BoardProps) {
  const CELL_SIZE = 60;
  const BOARD_WIDTH = CELL_SIZE * 8; 
  const BOARD_HEIGHT = CELL_SIZE * 9; 
  const PADDING = 30; 

  return (
    <div className="w-full flex justify-center items-center bg-orange-50 p-4">
      <svg
        width={BOARD_WIDTH + PADDING * 2}
        height={BOARD_HEIGHT + PADDING * 2}
        className="bg-orange-100 border-2 border-orange-900 shadow-md"
      >
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          {/* ... [Phần vẽ lưới 9x10, sông, cung vẫn giữ nguyên như bước 4] ... */}
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <line key={`h-${rowIndex}`} x1={0} y1={rowIndex * CELL_SIZE} x2={BOARD_WIDTH} y2={rowIndex * CELL_SIZE} stroke="#431407" strokeWidth="2" />
          ))}
          {Array.from({ length: 9 }).map((_, colIndex) => (
            <React.Fragment key={`v-${colIndex}`}>
              <line x1={colIndex * CELL_SIZE} y1={0} x2={colIndex * CELL_SIZE} y2={4 * CELL_SIZE} stroke="#431407" strokeWidth="2" />
              <line x1={colIndex * CELL_SIZE} y1={5 * CELL_SIZE} x2={colIndex * CELL_SIZE} y2={9 * CELL_SIZE} stroke="#431407" strokeWidth="2" />
              {(colIndex === 0 || colIndex === 8) && (
                <line x1={colIndex * CELL_SIZE} y1={4 * CELL_SIZE} x2={colIndex * CELL_SIZE} y2={5 * CELL_SIZE} stroke="#431407" strokeWidth="2" />
              )}
            </React.Fragment>
          ))}
          <line x1={3 * CELL_SIZE} y1={0} x2={5 * CELL_SIZE} y2={2 * CELL_SIZE} stroke="#431407" strokeWidth="2" />
          <line x1={5 * CELL_SIZE} y1={0} x2={3 * CELL_SIZE} y2={2 * CELL_SIZE} stroke="#431407" strokeWidth="2" />
          <line x1={3 * CELL_SIZE} y1={7 * CELL_SIZE} x2={5 * CELL_SIZE} y2={9 * CELL_SIZE} stroke="#431407" strokeWidth="2" />
          <line x1={5 * CELL_SIZE} y1={7 * CELL_SIZE} x2={3 * CELL_SIZE} y2={9 * CELL_SIZE} stroke="#431407" strokeWidth="2" />

          {/* 4. VẼ QUÂN CỜ TỪ MẢNG BOARD[90] */}
          {position?.board?.map((piece: any, index: number) => {
            if (!piece) return null; // Bỏ qua ô trống

            // Tính toạ độ cột (x) và hàng (y) từ index (0 -> 89)
            let col = index % 9;
            let row = Math.floor(index / 9);

            // Xử lý góc nhìn: Nếu lật bàn cờ (nhìn từ bên Đen), đảo ngược toạ độ
            if (isFlipped) {
              col = 8 - col;
              row = 9 - row;
            }

            const x = col * CELL_SIZE;
            const y = row * CELL_SIZE;
            
            // Giả định đối tượng piece có thuộc tính 'side' (RED/BLACK) và 'type' (định danh loại quân)
            // Bạn có thể cần sửa lại piece.side và piece.type theo đúng tên biến của xiangqi-core
            const isRed = piece.side === 'RED'; 

            return (
              <g key={`piece-${index}`} transform={`translate(${x}, ${y})`}>
                {/* Viền và nền quân cờ */}
                <circle r={22} fill="#fcecd2" stroke={isRed ? "#dc2626" : "#171717"} strokeWidth="2" />
                {/* Vòng tròn nhỏ trang trí bên trong */}
                <circle r={18} fill="transparent" stroke={isRed ? "#dc2626" : "#171717"} strokeWidth="1" strokeDasharray="2,2" />
                {/* Chữ Hán của quân cờ */}
                <text 
                  textAnchor="middle" 
                  alignmentBaseline="central" 
                  dy="2" // Căn chỉnh nhỏ cho chữ ở giữa tâm
                  fill={isRed ? "#dc2626" : "#171717"}
                  fontSize="24"
                  fontWeight="bold"
                  fontFamily="serif"
                >
                  {getPieceLabel(piece.type, isRed)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}