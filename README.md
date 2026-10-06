# Xiangqi Arena

Nền tảng Cờ Tướng trực tuyến – đồ án môn Quản lý Dự án CNTT (HUTECH).

Stack (D-02): Next.js · NestJS · PostgreSQL · Socket.IO · TypeScript · pnpm workspaces.

## Cấu trúc

| Thư mục | Nội dung | Owner (DECISION-06) |
|---|---|---|
| `apps/web` | Frontend Next.js | Ltk, Nhân |
| `apps/server` | Backend NestJS (REST + Socket.IO Gateway) | Kiệt (platform), Phát (GameService), Thịnh (Admin/Report/DB) |
| `packages/xiangqi-core` | Engine luật cờ thuần TypeScript – không import Nest/React/DB | Phát |
| `docs/` | Contract API/socket, quyết định kỹ thuật đi kèm code | Theo người viết |

## Bắt đầu

```bash
corepack enable          # bật pnpm đi kèm Node
pnpm install
pnpm build && pnpm test
```

Quy trình làm việc: xem [CONTRIBUTING.md](CONTRIBUTING.md).
