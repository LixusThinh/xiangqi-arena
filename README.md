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
pnpm install             # tự build luôn packages/xiangqi-core (postinstall)
```

> **Vì sao phải build engine?** `apps/web` và `apps/server` import `@xiangqi-arena/xiangqi-core` từ thư mục `dist/` (bản build, không commit lên git). `pnpm install` đã tự build sẵn. Nếu pull code engine mới mà **không** chạy lại `pnpm install`, `dist/` vẫn là bản cũ và web/server sẽ báo lỗi kiểu `has no exported member ...`. Khi đó chạy:
>
> ```bash
> pnpm build:core
> ```

### Mỗi lần bắt đầu làm task

```bash
git status                       # phải sạch; đang sửa dở thì: git stash
git checkout develop
git pull
pnpm install                     # cập nhật dependency + build lại engine
git checkout -b feature/XQA-<số>-<mô-tả-ngắn>
```

Không sửa code trực tiếp trên `develop`. Pull bị lỗi thì **đừng xoá repo clone lại**, chụp lỗi gửi nhóm; xem thêm [CONTRIBUTING.md](CONTRIBUTING.md).

Khởi chạy backend cùng PostgreSQL (cần Docker Desktop đang chạy):

```bash
Copy-Item apps\server\.env.example apps\server\.env # PowerShell; chỉ cần làm một lần
pnpm dev
```

`pnpm dev` khởi động PostgreSQL, áp dụng migration, seed tài khoản local rồi chạy NestJS. Xem [apps/server/README.md](apps/server/README.md) để biết tài khoản mẫu và lệnh database. Kiểm tra build/test bằng:

```bash
pnpm build
pnpm test
pnpm lint
```

Quy trình làm việc: xem [CONTRIBUTING.md](CONTRIBUTING.md).
