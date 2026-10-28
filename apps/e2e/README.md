# E2E – Playwright (XQA-108)

Luồng MVP chạy trên trình duyệt thật: đăng ký → tạo phòng → 2 trình duyệt chơi → xin thua → xem lịch sử.

## Chạy trên CI

`.github/workflows/e2e.yml` dựng PostgreSQL (service container), `prisma migrate deploy`, chạy server (3000) và web
(3001, bản build), rồi `pnpm --filter @xiangqi-arena/e2e e2e`. Fail → tải artifact `playwright-report` có trace + video.

## Chạy tay

```bash
corepack pnpm db:up && corepack pnpm db:migrate        # PostgreSQL local
corepack pnpm --filter @xiangqi-arena/server dev         # cổng 3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 corepack pnpm --filter @xiangqi-arena/web dev -- --port 3001
corepack pnpm --filter @xiangqi-arena/e2e exec playwright install chromium   # lần đầu
corepack pnpm --filter @xiangqi-arena/e2e e2e
```

Biến môi trường: `E2E_WEB_URL` (mặc định `http://localhost:3001`).

## Giới hạn hiện tại

- Phòng được tạo qua màn Sảnh `/lobby` (XQA-70): chủ phòng điền tên, chọn Đỏ, bấm "Tạo phòng"; khách mở Sảnh và bấm "Vào" ở phòng đó.
- Ca "xin thua → lịch sử" đã bật (XQA-92, XQA-98 có trong develop).
