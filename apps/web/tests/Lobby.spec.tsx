/**
 * XQA-70: màn Sảnh (FR-05, FR-06).
 * AC1: danh sách cập nhật khi có phòng mới. AC2: theo wireframe (danh sách + tạo phòng chọn màu, công khai/riêng tư).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Lobby from '../components/lobby/Lobby';
import { saveSession } from '../lib/auth-api';
import type { RoomDetail, RoomSummary } from '../lib/room-api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/lobby',
}));

const API = 'http://localhost:3000';
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function summary(code: string, name: string, overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    code,
    name,
    visibility: 'PUBLIC',
    status: 'WAITING',
    hostColorPref: 'RANDOM',
    ruleProfile: { code: 'VN_STANDARD', baseTimeSec: 600, incrementSec: 0, isRanked: false },
    host: { id: '9', username: 'other', displayName: 'Kỳ Vương', rating: 1350 },
    playerCount: 1,
    createdAt: '2026-10-28T08:00:00.000Z',
    ...overrides,
  };
}

function detail(code: string, name: string): RoomDetail {
  return { ...summary(code, name, { host: { id: '1', username: 'me', displayName: 'Me', rating: 1200 } }), members: [], matchId: null };
}

function ok(body: unknown, status = 200): Response {
  return { ok: true, status, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}
function fail(status: number, code: string): Response {
  return {
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ statusCode: status, error: 'x', code, message: code }),
  } as unknown as Response;
}

/** Trả lời fetch theo URL + method, để thứ tự gọi current/list không làm test giòn. */
function routeFetch(routes: {
  current?: () => Response;
  list?: () => Response;
  create?: () => Response;
}) {
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === `${API}/rooms/current`) return Promise.resolve(routes.current?.() ?? ok({ room: null }));
    if (url === `${API}/rooms` && method === 'GET') return Promise.resolve(routes.list?.() ?? ok([]));
    if (url === `${API}/rooms` && method === 'POST') return Promise.resolve(routes.create!());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
}

const calls = () => (global.fetch as jest.Mock).mock.calls as Array<[string, RequestInit | undefined]>;
const createBody = () => {
  const call = calls().find(([url, init]) => url === `${API}/rooms` && init?.method === 'POST');
  return call ? JSON.parse(call[1]!.body as string) : undefined;
};

/** Chờ lần tải danh sách đầu xong (tránh cập nhật state sau khi test kết thúc). */
const listLoaded = () => screen.findByText(/Chưa có phòng nào đang chờ/);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = API;
  localStorage.clear();
  mockPush.mockClear();
  global.fetch = jest.fn();
  saveSession(
    { accessToken: 'access', expiresIn: 900, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
    {
      id: '1',
      username: 'me',
      email: 'me@x.vn',
      displayName: 'Me',
      role: 'PLAYER',
      rating: 1200,
      createdAt: '2026-10-21T08:00:00.000Z',
    },
  );
});

afterEach(() => {
  jest.useRealTimers();
  if (originalApiBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
});

describe('Lobby', () => {
  it('hiện danh sách phòng đang chờ với chủ phòng, rating, thời gian, cách chia màu', async () => {
    routeFetch({
      list: () =>
        ok([
          summary('AAAA1111', 'Giao hữu tối nay'),
          summary('BBBB2222', 'Đấu hạng', {
            hostColorPref: 'RED',
            ruleProfile: { code: 'ONLINE_RAPID', baseTimeSec: 300, incrementSec: 2, isRanked: true },
          }),
        ]),
    });
    render(<Lobby />);

    const first = await screen.findByTestId('room-AAAA1111');
    expect(first).toHaveTextContent('Giao hữu tối nay');
    expect(first).toHaveTextContent('Kỳ Vương · 1350 · 10 phút · Bốc thăm màu');
    expect(screen.getByTestId('room-BBBB2222')).toHaveTextContent('5 phút + 2s · Chủ phòng cầm Đỏ · Tính hạng');
  });

  it('danh sách rỗng → hiện hướng dẫn tạo phòng', async () => {
    routeFetch({ list: () => ok([]) });
    render(<Lobby />);
    expect(await screen.findByText(/Chưa có phòng nào đang chờ/)).toBeInTheDocument();
  });

  it('AC1: có phòng mới → lần tải lại sau đó danh sách tự cập nhật', async () => {
    jest.useFakeTimers();
    let round = 0;
    routeFetch({
      list: () => {
        round++;
        return ok(round === 1 ? [] : [summary('NEW00001', 'Phòng mới')]);
      },
    });
    render(<Lobby pollIntervalMs={1000} />);
    expect(await screen.findByText(/Chưa có phòng nào đang chờ/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(await screen.findByTestId('room-NEW00001')).toHaveTextContent('Phòng mới');
  });

  it('bấm "Vào" ở một phòng → sang màn Phòng chờ của phòng đó', async () => {
    routeFetch({ list: () => ok([summary('AAAA1111', 'Giao hữu')]) });
    render(<Lobby />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vào phòng Giao hữu' }));
    expect(mockPush).toHaveBeenCalledWith('/room/AAAA1111');
  });

  it('phòng do mình tạo → hiện "Phòng của bạn", không có nút Vào', async () => {
    routeFetch({
      list: () => ok([summary('MINE0001', 'Phòng tôi', { host: { id: '1', username: 'me', displayName: 'Me', rating: 1200 } })]),
    });
    render(<Lobby />);
    const row = await screen.findByTestId('room-MINE0001');
    expect(within(row).getByRole('link', { name: 'Phòng của bạn' })).toHaveAttribute('href', '/room/MINE0001');
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('AC2: tạo phòng với tên, màu Đen, riêng tư, 5 phút → gửi đúng body rồi sang Phòng chờ', async () => {
    routeFetch({ create: () => ok(detail('CRT00001', 'Phòng luyện'), 201) });
    render(<Lobby />);
    await listLoaded();

    fireEvent.change(screen.getByLabelText('Tên phòng'), { target: { value: '  Phòng luyện  ' } });
    fireEvent.click(screen.getByLabelText('Đen'));
    fireEvent.change(screen.getByLabelText('Thời gian'), { target: { value: 'ONLINE_RAPID' } });
    fireEvent.click(screen.getByLabelText(/Phòng riêng tư/));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/room/CRT00001'));
    expect(createBody()).toEqual({
      name: 'Phòng luyện',
      hostColorPref: 'BLACK',
      visibility: 'PRIVATE',
      ruleProfileCode: 'ONLINE_RAPID',
    });
  });

  it('tạo phòng để trống tên → không gửi name (server tự đặt tên), mặc định bốc thăm + công khai', async () => {
    routeFetch({ create: () => ok(detail('CRT00002', 'Phòng của Me'), 201) });
    render(<Lobby />);
    await listLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/room/CRT00002'));
    expect(createBody()).toEqual({ hostColorPref: 'RANDOM', visibility: 'PUBLIC', ruleProfileCode: 'VN_STANDARD' });
  });

  it('tạo phòng lỗi ROOM_USER_BUSY → báo lỗi tiếng Việt, không chuyển trang', async () => {
    routeFetch({ create: () => fail(409, 'ROOM_USER_BUSY') });
    render(<Lobby />);
    await listLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn đang ở một phòng khác');
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeEnabled();
  });

  it('nhập mã phòng (chữ thường, có khoảng trắng) → chuẩn hóa rồi sang Phòng chờ', async () => {
    routeFetch({});
    render(<Lobby />);
    await listLoaded();
    const joinButton = screen.getAllByRole('button', { name: 'Vào' }).at(-1)!;
    expect(joinButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Mã phòng'), { target: { value: ' k7mpq2xa ' } });
    fireEvent.click(joinButton);
    expect(mockPush).toHaveBeenCalledWith('/room/K7MPQ2XA');
  });

  it('đang ở phòng khác → banner "Quay lại phòng", khóa tạo phòng và nút Vào', async () => {
    routeFetch({
      current: () => ok({ room: detail('OLD00001', 'Phòng cũ') }),
      list: () => ok([summary('AAAA1111', 'Giao hữu')]),
    });
    render(<Lobby />);

    expect(await screen.findByRole('link', { name: 'Quay lại phòng' })).toHaveAttribute('href', '/room/OLD00001');
    expect(screen.getByRole('status')).toHaveTextContent('Phòng cũ');
    expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Vào phòng Giao hữu' })).toBeDisabled();
  });

  it('tải danh sách lỗi → báo lỗi, lần sau tải được thì hết lỗi', async () => {
    jest.useFakeTimers();
    let round = 0;
    routeFetch({
      list: () => {
        round++;
        return round === 1 ? fail(500, 'INTERNAL') : ok([summary('AAAA1111', 'Giao hữu')]);
      },
    });
    render(<Lobby pollIntervalMs={1000} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(await screen.findByTestId('room-AAAA1111')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
