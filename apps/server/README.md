# XQA-59 — Backend bootstrap

## Cau truc

| Tep/thu muc | Chuc nang |
|---|---|
| `src/main.ts` | Khoi dong HTTP server NestJS |
| `src/app.module.ts` | Ket noi cac module backend |
| `src/auth`, `src/user`, `src/room`, `src/game`, `src/admin` | Module khung theo yeu cau XQA-59 |
| `src/prisma` | Ket noi NestJS voi PostgreSQL bang Prisma |
| `prisma/schema.prisma` | Khai bao bang, quan he va enum database |
| `prisma/migrations/20261012000000_init/migration.sql` | Migration tao schema ban dau |
| `prisma/seed.ts` | Tao rule profiles va 3 tai khoan local |

## Chay local tren Windows

Can Node.js 20+, Docker Desktop/WSL2 dang hoat dong. Mo terminal tai thu muc goc (noi co `pnpm-workspace.yaml`) va chay:

```powershell
Copy-Item apps\server\.env.example apps\server\.env
corepack pnpm install
corepack pnpm dev
```

Kiem tra `http://localhost:3000/health`; server tra `status: ok` khi Postgres ket noi duoc. Dung server bang `Ctrl+C`, dung PostgreSQL bang `corepack pnpm db:down`.

Neu chi can kiem tra ma nguon, khong can Postgres:

```powershell
corepack pnpm build
corepack pnpm test
corepack pnpm lint
```

## Seed accounts local

| Quyen | Username | Email | Mat khau local |
|---|---|---|---|
| Admin | `admin` | `admin@xiangqi.local` | `Admin-dev-2026!` |
| Player | `player1` | `player1@xiangqi.local` | `Player-dev-2026!` |
| Player | `player2` | `player2@xiangqi.local` | `Player-dev-2026!` |

Mat khau chi dung cho local; database chi luu bcrypt hash. Khong dung tai khoan nay tren production.

Goi XQA-59 cung cap bootstrap, schema, migration va seed. De co Auth REST API, ap dung goi `XQA_52_Auth_API` kem theo rieng trong thu muc nopbt.
