# @xiangqi-arena/web

Ứng dụng web Next.js 14 (App Router) cho Xiangqi Arena.

## Công nghệ sử dụng
- **Framework**: Next.js 14 (App Router, React 18)
- **Styling**: Tailwind CSS
- **Testing**: Jest + React Testing Library (`jest-environment-jsdom`)
- **Linting & Typing**: ESLint 9 + TypeScript 5.8+
- **Monorepo Package**: Tiêu thụ `@xiangqi-arena/xiangqi-core` qua workspace protocol

## Cấu trúc thư mục
- `app/`: Next.js App Router (layout, pages, global CSS)
- `components/`: React UI components (Board, controls, dialogs)
- `lib/`: Tiện ích helper (geometry, FEN presets, socket client)
- `public/ChessImage/`: Tài nguyên đồ họa bàn cờ, quân cờ và selection masks
- `tests/`: Bộ kiểm thử Jest và cấu hình test setup

## Lệnh phát triển (từ thư mục gốc repo)
```bash
# Cài đặt dependencies
pnpm install

# Chạy Next.js dev server
pnpm --filter @xiangqi-arena/web dev

# Build ứng dụng
pnpm --filter @xiangqi-arena/web build

# Chạy unit tests
pnpm --filter @xiangqi-arena/web test

# Kiểm tra linter
pnpm --filter @xiangqi-arena/web lint
```
