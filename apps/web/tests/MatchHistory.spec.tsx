/**
 * XQA-98: trang Lịch sử ván đấu. AC: theo wireframe hi-fi (bảng đối thủ, kết quả, số nước, thời gian,
 * thời lượng; phân trang). API: docs/api/history.md (XQA-97).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MatchHistory from '../components/history/MatchHistory';
import { saveSession } from '../lib/auth-api';
import { formatDuration, moveCount, type MatchHistoryItem, type MatchHistoryPage } from '../lib/history-api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/history',
}));

const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function item(id: string, overrides: Partial<MatchHistoryItem> = {}): MatchHistoryItem {
  return {
    matchId: id,
    roomCode: 'K7MPQ2XA',
    ruleProfileCode: 'VN_STANDARD',
    isRanked: false,
    yourColor: 'RED',
    opponent: { id: '2', username: 'black', displayName: 'Kỳ Vương', rating: 1250 },
    outcome: 'WIN',
    result: 'RED_WIN',
    endReason: 'CHECKMATE',
    plyCount: 41,
    startedAt: '2026-10-20T08:00:00.000Z',
    endedAt: '2026-10-20T08:12:30.000Z',
    durationSec: 750,
    ...overrides,
  };
}

function page(items: MatchHistoryItem[], overrides: Partial<MatchHistoryPage> = {}): MatchHistoryPage {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1, ...overrides };
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

function fail(status: number, body: unknown): Response {
  return { ok: false, status, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

const fetchMock = () => global.fetch as jest.Mock;
const requestedUrl = (call: number) => String(fetchMock().mock.calls[call][0]);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.test';
  global.fetch = jest.fn();
  localStorage.clear();
  saveSession(
    { accessToken: 'access', expiresIn: 900, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
    { id: '1', username: 'red', email: 'red@x.vn', displayName: 'Red', role: 'PLAYER', rating: 1200, createdAt: '2026-10-01T00:00:00.000Z' },
  );
});

afterAll(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
});

describe('helpers lịch sử', () => {
  it('số nước = ceil(plyCount / 2) theo H-05', () => {
    expect(moveCount(41)).toBe(21);
    expect(moveCount(40)).toBe(20);
    expect(moveCount(1)).toBe(1);
  });

  it('thời lượng đọc được', () => {
    expect(formatDuration(750)).toBe('12 phút 30 giây');
    expect(formatDuration(45)).toBe('45 giây');
    expect(formatDuration(3720)).toBe('1 giờ 2 phút');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('MatchHistory (XQA-98)', () => {
  it('gọi GET /me/matches?page=1&pageSize=20 kèm access token', async () => {
    fetchMock().mockResolvedValueOnce(ok(page([item('12')])));
    render(<MatchHistory />);
    await screen.findByTestId('history-row-12');
    expect(requestedUrl(0)).toBe('http://api.test/me/matches?page=1&pageSize=20');
    const init = fetchMock().mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access');
  });

  it('mỗi dòng có đối thủ, kết quả + lý do, số nước, thời gian (giờ VN), thời lượng', async () => {
    fetchMock().mockResolvedValueOnce(ok(page([item('12')])));
    render(<MatchHistory />);
    const row = await screen.findByTestId('history-row-12');
    expect(within(row).getByText('Kỳ Vương')).toBeInTheDocument();
    expect(within(row).getByText('Thắng')).toBeInTheDocument();
    expect(within(row).getByText('Chiếu bí')).toBeInTheDocument();
    expect(within(row).getByText('21')).toBeInTheDocument();
    expect(within(row).getByText('12 phút 30 giây')).toBeInTheDocument();
    // 08:12 UTC = 15:12 giờ Việt Nam
    expect(row).toHaveTextContent('15:12');
    expect(row).toHaveTextContent('20/10/2026');
    expect(screen.getByTestId('history-total')).toHaveTextContent('1');
  });

  it('kết quả Thua / Hòa và lý do mới (xin thua, hòa thỏa thuận, mất kết nối) hiện đúng nhãn', async () => {
    fetchMock().mockResolvedValueOnce(
      ok(
        page([
          item('3', { outcome: 'LOSS', result: 'BLACK_WIN', endReason: 'RESIGNATION' }),
          item('2', { outcome: 'DRAW', result: 'DRAW', endReason: 'DRAW_AGREEMENT' }),
          item('1', { outcome: 'WIN', endReason: 'DISCONNECT', yourColor: 'BLACK', durationSec: null }),
        ]),
      ),
    );
    render(<MatchHistory />);
    expect(within(await screen.findByTestId('history-row-3')).getByText('Thua')).toBeInTheDocument();
    expect(within(screen.getByTestId('history-row-3')).getByText('Xin thua')).toBeInTheDocument();
    expect(within(screen.getByTestId('history-row-2')).getByText('Hòa')).toBeInTheDocument();
    expect(within(screen.getByTestId('history-row-2')).getByText('Hòa theo thỏa thuận')).toBeInTheDocument();
    const row1 = screen.getByTestId('history-row-1');
    expect(within(row1).getByText('Mất kết nối')).toBeInTheDocument();
    expect(row1).toHaveTextContent('Bạn cầm Đen');
    expect(row1).toHaveTextContent('—');
  });

  it('phân trang: Trang sau gọi page=2, nút bị khóa ở trang đầu / trang cuối', async () => {
    fetchMock()
      .mockResolvedValueOnce(ok(page([item('40')], { total: 25, totalPages: 2 })))
      .mockResolvedValueOnce(ok(page([item('5')], { page: 2, total: 25, totalPages: 2 })));
    render(<MatchHistory />);
    await screen.findByTestId('history-row-40');
    expect(screen.getByTestId('history-page')).toHaveTextContent('Trang 1/2');
    expect(screen.getByRole('button', { name: /Trang trước/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Trang sau/ }));
    await screen.findByTestId('history-row-5');
    expect(requestedUrl(1)).toBe('http://api.test/me/matches?page=2&pageSize=20');
    expect(screen.getByTestId('history-page')).toHaveTextContent('Trang 2/2');
    expect(screen.getByRole('button', { name: /Trang sau/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Trang trước/ })).toBeEnabled();
  });

  it('chưa có ván nào → thông báo trống, Tổng số ván = 0', async () => {
    fetchMock().mockResolvedValueOnce(ok(page([], { total: 0, totalPages: 0 })));
    render(<MatchHistory />);
    expect(await screen.findByText('Bạn chưa chơi xong ván nào.')).toBeInTheDocument();
    expect(screen.getByTestId('history-total')).toHaveTextContent('0');
    expect(screen.getByTestId('history-page')).toHaveTextContent('Trang 1/1');
  });

  it('API lỗi → báo lỗi tiếng Việt', async () => {
    fetchMock().mockResolvedValueOnce(
      fail(400, { statusCode: 400, error: 'Bad Request', code: 'VALIDATION_ERROR', message: 'bad page' }),
    );
    render(<MatchHistory />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Trang không hợp lệ.');
  });

  it('đang tải → hiện trạng thái tải', async () => {
    fetchMock().mockReturnValueOnce(new Promise(() => undefined));
    render(<MatchHistory />);
    await waitFor(() => expect(screen.getByText('Đang tải lịch sử…')).toBeInTheDocument());
  });
});
