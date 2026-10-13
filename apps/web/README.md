# @xiangqi-arena/web

Ứng dụng web Next.js 14 (App Router) cho Xiangqi Arena — hiển thị bàn cờ Cờ Tướng, quản lý tương tác và chuẩn bị tích hợp đấu trực tuyến thời gian thực.

---

## 1. Mục đích & Kiến trúc (Architecture)

Ứng dụng web được xây dựng với mục tiêu mang lại trải nghiệm chơi cờ tướng mượt mà, chính xác theo luật cờ tướng truyền thống, kết hợp trực quan đồ họa cổ điển và công nghệ web hiện đại:

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Styling**: Tailwind CSS với layout responsive và dark theme hiện đại
- **SVG Render Engine**: Bàn cờ SVG tỷ lệ gốc 741×821, sắc nét trên mọi mật độ điểm ảnh (Retina / High-DPI), hỗ trợ co giãn tự động theo kích thước container qua viewBox.
- **Tích hợp Core Engine**: Kết nối trực tiếp với package workspace `@xiangqi-arena/xiangqi-core` để xử lý trạng thái bàn cờ (`Position`), sinh mã băm Zobrist, và chuyển đổi tọa độ đại số.
- **Testing**: Jest + React Testing Library (`@testing-library/react`, `jest-environment-jsdom`) đảm bảo tính toàn vẹn của logic rendering và tương tác.

---

## 2. Component `<Board />`

`<Board />` (`apps/web/components/Board.tsx`) là component cốt lõi chịu trách nhiệm render toàn bộ đồ họa bàn cờ, quân cờ và các hiệu ứng highlight (chọn quân, nước đi gần nhất).

### 2.1. Props Interface

```typescript
export interface BoardProps {
  /** Chuỗi FEN. Nếu không truyền `position`, component sẽ parse FEN này (mặc định STARTING_FEN). */
  fen?: string;

  /** Đối tượng Position từ @xiangqi-arena/xiangqi-core. Ưu tiên hơn `fen` nếu được truyền. */
  position?: Position;

  /** Hướng nhìn bàn cờ: 'r' = Đỏ ở dưới (mặc định), 'b' = Đen ở dưới (lật cờ) */
  orientation?: 'r' | 'b';

  /** Chỉ số ô cờ đang được chọn (0..89) để hiển thị viền highlight mask.png */
  selectedSquare?: number | null;

  /** Nước đi gần nhất { from, to } để highlight 2 ô xuất phát và đích bằng mask2.png */
  lastMove?: { from: number; to: number } | null;

  /** Callback kích hoạt khi người dùng click vào bất kỳ ô nào (quân cờ hoặc ô trống) */
  onSquareClick?: (square: number) => void;

  /** Tùy biến class CSS cho container bao ngoài */
  className?: string;
}
```

### 2.2. Hướng dẫn sử dụng cơ bản

#### Sử dụng chuỗi FEN đơn giản:
```tsx
import Board from '@/components/Board';

export default function GameView() {
  return (
    <Board
      fen="rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1"
      orientation="r"
    />
  );
}
```

#### Tương tác chọn ô và lật bàn cờ:
```tsx
'use client';

import { useState } from 'react';
import Board from '@/components/Board';
import { Position } from '@xiangqi-arena/xiangqi-core';

export default function InteractiveBoard() {
  const [selected, setSelected] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<'r' | 'b'>('r');
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>({
    from: 70, // C2
    to: 43,   // C5
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <button onClick={() => setOrientation((o) => (o === 'r' ? 'b' : 'r'))}>
        Đổi góc nhìn (Hiện tại: {orientation === 'r' ? 'Đỏ' : 'Đen'})
      </button>

      <Board
        orientation={orientation}
        selectedSquare={selected}
        lastMove={lastMove}
        onSquareClick={(sq) => setSelected((prev) => (prev === sq ? null : sq))}
      />
    </div>
  );
}
```

---

## 3. Hệ tọa độ & Hình học bàn cờ (Board Geometry)

Được định nghĩa tập trung trong `components/board-geometry.ts`:
- **Số ô (Squares)**: 90 ô (9 cột `a-i` × 10 hàng `0-9`).
- **Mã hóa ô**: Chỉ số tuyến tính `0..89` theo thứ tự row-major từ hàng 9 (trên cùng phía Đen) xuống hàng 0 (dưới cùng phía Đỏ):
  - Ô `0`: Cột `a`, Hàng `9` (góc trên bên trái góc nhìn Đỏ)
  - Ô `8`: Cột `i`, Hàng `9`
  - Ô `81`: Cột `a`, Hàng `0`
  - Ô `89`: Cột `i`, Hàng `0` (góc dưới bên phải góc nhìn Đỏ)
- **Kích thước gốc SVG**:
  - `BOARD_WIDTH`: `741` px
  - `BOARD_HEIGHT`: `821` px
  - `CELL_SIZE`: `80` px (kích thước mỗi ô cờ / sprite quân)
  - `OFFSET_X`: `10` px
  - `OFFSET_Y`: `10` px
- **Hàm chuyển đổi `getSquareCoordinates(sq, orientation)`**:
  - Khi `orientation === 'r'`: `x = 10 + col * 80`, `y = 10 + row * 80`.
  - Khi `orientation === 'b'`: Đảo ngược hiển thị: `displayCol = 8 - col`, `displayRow = 9 - row`.

---

## 4. Cấu trúc tài nguyên đồ họa (Assets)

Tất cả tài nguyên hình ảnh được đặt tại thư mục `public/ChessImage/`:

| Tên tệp | Kích thước | Mô tả |
|---------|-----------|-------|
| `BOARD.BMP` | 741×821 px | Ảnh nền gỗ bàn cờ tướng truyền thống có sông Sở Hà - Hán Giới và cửu cung |
| `mask.png` | 80×80 px | Viền vuông màu đỏ/vàng đánh dấu ô cờ đang được chọn (`selectedSquare`) |
| `mask2.png` | 80×80 px | Viền hiệu ứng đánh dấu nước cờ gần nhất (`lastMove`) gồm ô đi và ô đến |
| `ChessIcon.ico` | Đa kích thước | Icon ứng dụng Xiangqi Arena |

### Quân cờ Đỏ (Red - Viết thường tiền tố `r`):
- `rk.ico`: Tướng (King)
- `ra.ico`: Sĩ (Advisor)
- `rb.ico`: Tượng (Bishop / Elephant)
- `rn.ico`: Mã (Knight / Horse)
- `rr.ico`: Xe (Rook / Chariot)
- `rc.ico`: Pháo (Cannon)
- `rp.ico`: Tốt (Pawn / Soldier)

### Quân cờ Đen (Black - Viết thường tiền tố `b`):
- `bk.ico`: Tướng (King)
- `ba.ico`: Sĩ (Advisor)
- `bb.ico`: Tượng (Bishop / Elephant)
- `bn.ico`: Mã (Knight / Horse)
- `br.ico`: Xe (Rook / Chariot)
- `bc.ico`: Pháo (Cannon)
- `bp.ico`: Tốt (Pawn / Soldier)

---

## 5. Cấu trúc thư mục

```text
apps/web/
├── app/
│   ├── globals.css      # Cấu hình Tailwind directives & custom CSS
│   ├── layout.tsx       # Root Layout Next.js với font Inter
│   └── page.tsx         # Trang demo tương tác bàn cờ (FEN preset, lật bàn cờ)
├── components/
│   ├── Board.tsx        # Component hiển thị bàn cờ chính
│   ├── board-geometry.ts# Hằng số kích thước SVG & hàm ánh xạ tọa độ
│   └── fen-presets.ts   # Danh sách các thế cờ mẫu phục vụ test & demo
├── public/
│   └── ChessImage/      # Toàn bộ ảnh nền bàn cờ, quân cờ và masks
├── tests/
│   ├── assets.spec.ts   # Kiểm thử sự hiện diện đầy đủ của tài nguyên tĩnh
│   ├── board-geometry.spec.ts # Kiểm thử toán học chuyển đổi tọa độ & lật cờ
│   ├── Board.spec.tsx   # Kiểm thử tương tác React Testing Library cho Board
│   └── setup.ts         # Test setup file (Jest DOM)
├── next.config.mjs      # Cấu hình Next.js (transpilePackages @xiangqi-arena/xiangqi-core)
├── package.json         # Scripts & dependencies của web
├── tailwind.config.ts   # Cấu hình Tailwind CSS
└── tsconfig.json        # Cấu hình TypeScript
```

---

## 6. Hướng dẫn phát triển & Kiểm thử

Chạy các lệnh sau từ thư mục gốc của repo (`xiangqi-arena`):

```bash
# Cài đặt toàn bộ dependencies trong monorepo
pnpm install

# Khởi chạy Next.js development server (mặc định tại http://localhost:3000)
pnpm --filter @xiangqi-arena/web dev

# Chạy bộ kiểm thử Jest cho gói web
pnpm --filter @xiangqi-arena/web test

# Chạy kiểm tra quy chuẩn mã nguồn (ESLint)
pnpm --filter @xiangqi-arena/web lint

# Build production bundle cho ứng dụng web
pnpm --filter @xiangqi-arena/web build
```
