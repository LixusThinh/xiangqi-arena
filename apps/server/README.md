# XQA-59 — Backend bootstrap

## Đọc nhanh trong Visual Studio

Đây là dự án TypeScript/NestJS, không phải solution C# nên repo không có file `.sln`. Màn hình **Folder View** trong ảnh là bình thường: Visual Studio đang hiển thị thư mục repo. Giữ mở thư mục gốc `xiangqi-arena`, sau đó mở **View → Terminal** để chạy lệnh bên dưới.

Trong Solution Explorer, mở `apps/server`:

| File/thư mục | Dùng để làm gì |
|---|---|
| `src/main.ts` | Điểm khởi chạy HTTP server NestJS |
| `src/app.module.ts` | Nối các module của backend |
| `src/auth` | API `POST /auth/register`, `POST /auth/login`, `GET /auth/me`; contract tại `docs/api/auth.md` |
| `src/user`, `src/room`, `src/game`, `src/admin` | Module khung; API nghiệp vụ khác sẽ được bổ sung theo contract đã duyệt |
| `src/prisma` | Kết nối ứng dụng NestJS với PostgreSQL |
| `prisma/schema.prisma` | Mô tả bảng, quan hệ và enum trong database |
| `prisma/migrations/20261012000000_init/migration.sql` | SQL migration tạo cấu trúc database |
| `prisma/seed.ts` | Tạo rule profiles, một admin và hai user thử nghiệm |
| `.env.example` | Mẫu cấu hình local; được sao chép thành `.env`, không commit `.env` |

## Chạy lần đầu trên Windows

Cần cài Node.js 20+ và Docker Desktop, rồi mở **Terminal** tại thư mục gốc repo (thư mục có `pnpm-workspace.yaml`). Mở Docker Desktop trước. Chạy:

```powershell
Copy-Item apps\server\.env.example apps\server\.env
corepack pnpm install
corepack pnpm dev
```

Lệnh `dev` khởi động PostgreSQL, chạy migration, seed dữ liệu và mở NestJS ở chế độ watch. Mở `http://localhost:3000/health`; kết quả mong đợi là `{"status":"ok","database":"connected"}`. Dừng server bằng `Ctrl+C`; dừng PostgreSQL bằng `corepack pnpm db:down`.

Nếu muốn kiểm tra riêng phần build/test/lint mà không cần PostgreSQL:

```powershell
corepack pnpm build
corepack pnpm test
corepack pnpm lint
```

## Dữ liệu mẫu local

| Quyền | Username | Email | Mật khẩu local |
|---|---|---|---|
| Admin | `admin` | `admin@xiangqi.local` | `Admin-dev-2026!` |
| Player | `player1` | `player1@xiangqi.local` | `Player-dev-2026!` |
| Player | `player2` | `player2@xiangqi.local` | `Player-dev-2026!` |

Seed có thể chạy lại; mật khẩu được lưu dưới dạng bcrypt hash. Chỉ dùng mật khẩu trên cho môi trường local, không dùng cho production.

## Auth API — contract-first

Xem [REST Auth Contract v0.1](../../docs/api/auth.md) trước khi tích hợp FE. Ba endpoint register/login/me dùng access JWT Bearer 15 phút; response không bao giờ trả mật khẩu hoặc password hash. Cần đặt `JWT_ACCESS_SECRET` trong `apps/server/.env` (mẫu local có sẵn trong `.env.example`); secret production phải do môi trường triển khai cấp riêng.

## Phạm vi bàn giao và trạng thái

XQA-59 cung cấp khung NestJS, Prisma schema theo ERD v2/DECISION-03, migration ban đầu và seed. XQA-52 triển khai Auth API theo contract nói trên. Các module User/Room/Game/Admin vẫn là khung; các API khác phải theo contract tương ứng đã được nhóm duyệt.

Đã kiểm tra trong môi trường phát triển: build, lint, 8 unit tests và Prisma schema validation đều pass. Trước khi tick đủ acceptance criteria, cần chạy `corepack pnpm dev` trên máy có Docker Desktop để xác nhận PostgreSQL, migration và seed hoạt động end-to-end.

## Lệnh database

Chạy từ thư mục gốc repo:

```powershell
corepack pnpm db:up
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm db:studio
corepack pnpm db:down
```
