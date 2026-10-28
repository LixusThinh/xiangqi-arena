/**
 * XQA-108 – E2E luồng MVP: đăng ký → tạo phòng → 2 trình duyệt chơi → xin thua → xem lịch sử.
 * Ô cờ theo xiangqi-core: index = hàng * 9 + cột, hàng 0 = đáy bên Đen; Board gắn data-testid piece-<ô>, cell-<ô>.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000';
const PASSWORD = 'E2e-pass-2026!';
const sq = (name: string) => (name.charCodeAt(1) - 48) * 9 + (name.charCodeAt(0) - 97);

interface Player {
  page: Page;
  username: string;
  displayName: string;
}

async function register(browser: Browser, tag: string): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const username = `e2e_${tag}_${suffix}`.slice(0, 30);
  const displayName = `E2E ${tag.toUpperCase()}`;
  await page.goto('/register');
  await page.locator('#displayName').fill(displayName);
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(`${username}@e2e.local`);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  // Đăng ký xong được đăng nhập luôn và rời trang /register
  await expect(page).not.toHaveURL(/\/register/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('xiangqi-arena.accessToken'))).toBeTruthy();
  return { page, username, displayName };
}

/** Chưa có màn Sảnh (XQA-70) để bấm "Tạo phòng" → tạo phòng bằng REST với token của chính người chơi. */
async function createRoom(host: Player): Promise<string> {
  const token = await host.page.evaluate(() => localStorage.getItem('xiangqi-arena.accessToken'));
  const res = await host.page.request.post(`${API}/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { hostColorPref: 'RED', name: 'Phòng E2E' },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { code: string }).code;
}

async function move(page: Page, from: string, to: string) {
  await page.getByTestId(`piece-${sq(from)}`).click();
  await page.getByTestId(`cell-${sq(to)}`).click();
}

test.describe('MVP: đăng ký → phòng → chơi online', () => {
  let red: Player;
  let black: Player;
  let code: string;

  test.beforeEach(async ({ browser }) => {
    red = await register(browser, 'red');
    black = await register(browser, 'black');
    code = await createRoom(red);
    // Chủ phòng vào phòng chờ, khách mở link mời → tự vào phòng → đủ 2 người → cả hai sang màn ván
    await red.page.goto(`/room/${code}`);
    await black.page.goto(`/room/${code}`);
    await expect(red.page).toHaveURL(new RegExp(`/room/${code}/play`), { timeout: 20_000 });
    await expect(black.page).toHaveURL(new RegExp(`/room/${code}/play`), { timeout: 20_000 });
    await expect(red.page.getByRole('status')).toContainText('Đến lượt bạn (Đỏ)');
    await expect(black.page.getByRole('status')).toContainText('Đến lượt đối thủ (Đỏ)');
  });

  test.afterEach(async () => {
    await red?.page.context().close();
    await black?.page.context().close();
  });

  test('hai trình duyệt đi quân, nước đi đồng bộ realtime, nước sai luật bị chặn', async () => {
    // Đỏ: Pháo h7 → e7 (Pháo đầu)
    await move(red.page, 'h7', 'e7');
    await expect(black.page.getByTestId(`piece-${sq('e7')}`)).toBeVisible();
    await expect(black.page.getByRole('status')).toContainText('Đến lượt bạn (Đen)');

    // Đen: Mã h0 → g2
    await move(black.page, 'h0', 'g2');
    await expect(red.page.getByTestId(`piece-${sq('g2')}`)).toBeVisible();
    await expect(red.page.getByRole('status')).toContainText('Đến lượt bạn (Đỏ)');

    // Đỏ thử Xe a9 → a5 (bị Tốt a6 chặn) → báo lỗi, bàn cờ không đổi
    await red.page.getByTestId(`piece-${sq('a9')}`).click();
    await red.page.getByTestId(`cell-${sq('a5')}`).click();
    await expect(red.page.getByTestId('move-notice')).toContainText('Nước đi không hợp lệ');
    await expect(red.page.getByTestId(`piece-${sq('a9')}`)).toBeVisible();

    // Reload giữa ván (NFR-07) → vẫn đúng thế cờ
    await black.page.reload();
    await expect(black.page.getByTestId(`piece-${sq('g2')}`)).toBeVisible();
    await expect(black.page.getByTestId(`piece-${sq('e7')}`)).toBeVisible();
  });

  // Bật khi PR #32 (nút Xin thua – XQA-92) và #36 (trang Lịch sử – XQA-98) đã merge vào develop.
  test.fixme('xin thua → hộp kết thúc ở cả hai bên → ván xuất hiện trong Lịch sử', async () => {
    await move(red.page, 'h7', 'e7');
    await expect(black.page.getByTestId(`piece-${sq('e7')}`)).toBeVisible();

    await black.page.getByRole('button', { name: /Xin thua/ }).click();
    await black.page.getByRole('dialog').getByRole('button', { name: 'Xin thua' }).click();
    await expect(black.page.getByText('Đỏ thắng — Xin thua.')).toBeVisible();
    await expect(red.page.getByText('Đỏ thắng — Xin thua.')).toBeVisible();

    await red.page.goto('/history');
    const row = red.page.locator('[data-testid^="history-row-"]').first();
    await expect(row).toContainText(black.displayName);
    await expect(row).toContainText('Thắng');
    await expect(row).toContainText('Xin thua');
    await black.page.goto('/history');
    await expect(black.page.locator('[data-testid^="history-row-"]').first()).toContainText('Thua');
  });
});
