/**
 * XQA-71: màn Phòng chờ + vào ván.
 * AC1: rời phòng được khi chưa bắt đầu. AC2: đủ 2 người, cả 2 vào ván.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WaitingRoom from '../components/room/WaitingRoom';
import MatchView from '../components/match/MatchView';
import { saveSession } from '../lib/auth-api';
import type { RoomDetail, RoomMember } from '../lib/room-api';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => '/room/K7MPQ2XA',
}));

// XQA-76: MatchView mở socket khi vào ván; test của XQA-71 không cần socket thật.
jest.mock('../lib/game-socket', () => ({
  ...jest.requireActual('../lib/game-socket'),
  connectGame: () => ({
    join: () => new Promise(() => undefined),
    move: () => new Promise(() => undefined),
    onUpdate: () => undefined,
    onEnd: () => undefined,
    onConnectionChange: () => undefined,
    close: () => undefined,
  }),
}));

const CODE = 'K7MPQ2XA';
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function member(id: string, name: string, isHost: boolean, color: RoomMember['color'] = null): RoomMember {
  return {
    id,
    username: name.toLowerCase(),
    displayName: name,
    rating: 1200,
    isHost,
    color,
    joinedAt: '2026-10-21T08:00:00.000Z',
  };
}

const HOST = member('1', 'Host', true);
const GUEST = member('2', 'Guest', false);

function room(overrides: Partial<RoomDetail> = {}): RoomDetail {
  return {
    code: CODE,
    name: 'Phòng của Host',
    visibility: 'PUBLIC',
    status: 'WAITING',
    hostColorPref: 'RANDOM',
    ruleProfile: { code: 'VN_STANDARD', baseTimeSec: 600, incrementSec: 0, isRanked: false },
    host: { id: '1', username: 'host', displayName: 'Host', rating: 1200 },
    playerCount: 1,
    createdAt: '2026-10-21T08:00:00.000Z',
    members: [HOST],
    matchId: null,
    ...overrides,
  };
}

const playingRoom = room({
  status: 'PLAYING',
  playerCount: 2,
  matchId: '9',
  members: [{ ...HOST, color: 'BLACK' }, { ...GUEST, color: 'RED' }],
});

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

function signInAs(user: RoomMember) {
  saveSession(
    { accessToken: 'access', expiresIn: 900, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
    {
      id: user.id,
      username: user.username,
      email: `${user.username}@x.vn`,
      displayName: user.displayName,
      role: 'PLAYER',
      rating: 1200,
      createdAt: '2026-10-21T08:00:00.000Z',
    },
  );
}

const fetchMock = () => global.fetch as jest.Mock;
const requests = () =>
  fetchMock().mock.calls.map(([url, init]) => `${(init?.method as string) ?? 'GET'} ${url}`);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  localStorage.clear();
  mockReplace.mockClear();
  mockPush.mockClear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  if (originalApiBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
});

describe('WaitingRoom', () => {
  it('chủ phòng thấy tên mình, ô đối thủ đang chờ, thời gian và cách chia màu', async () => {
    signInAs(HOST);
    fetchMock().mockResolvedValue(ok(room()));
    render(<WaitingRoom code={CODE} />);

    expect(await screen.findByText('Phòng của Host')).toBeInTheDocument();
    expect(screen.getByTestId('seat-Chủ phòng')).toHaveTextContent('Host');
    expect(screen.getByTestId('seat-Đối thủ')).toHaveTextContent('Đang chờ…');
    expect(screen.getByText('10 phút mỗi bên')).toBeInTheDocument();
    expect(screen.getByText('Bốc thăm màu quân khi đủ người')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang chờ đối thủ');
    // chủ phòng đã là thành viên → không gọi join
    expect(requests()).toEqual([`GET http://localhost:3000/rooms/${CODE}`]);
  });

  it('khách mở link mời phòng đang chờ → tự vào phòng (join)', async () => {
    signInAs(GUEST);
    fetchMock()
      .mockResolvedValueOnce(ok(room()))
      .mockResolvedValueOnce(ok(playingRoom));
    render(<WaitingRoom code={CODE} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${CODE}/play`));
    expect(requests()).toEqual([
      `GET http://localhost:3000/rooms/${CODE}`,
      `POST http://localhost:3000/rooms/${CODE}/join`,
    ]);
  });

  it('AC2: chủ phòng đang chờ, đối thủ vào → lần hỏi lại thấy PLAYING → tự vào ván', async () => {
    jest.useFakeTimers();
    signInAs(HOST);
    fetchMock()
      .mockResolvedValueOnce(ok(room()))
      .mockResolvedValueOnce(ok(room()))
      .mockResolvedValueOnce(ok(playingRoom));
    render(<WaitingRoom code={CODE} pollIntervalMs={1000} />);
    expect(await screen.findByText('Phòng của Host')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${CODE}/play`));
  });

  it('AC1: bấm "Rời phòng" khi đang chờ → gọi leave rồi về Sảnh', async () => {
    signInAs(HOST);
    fetchMock()
      .mockResolvedValueOnce(ok(room()))
      .mockResolvedValueOnce({ ok: true, status: 204, json: jest.fn() } as unknown as Response);
    render(<WaitingRoom code={CODE} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rời phòng' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/lobby'));
    expect(requests()[1]).toBe(`POST http://localhost:3000/rooms/${CODE}/leave`);
  });

  it('rời phòng thất bại → báo lỗi, vẫn ở lại phòng', async () => {
    signInAs(HOST);
    fetchMock()
      .mockResolvedValueOnce(ok(room()))
      .mockResolvedValueOnce(fail(409, 'ROOM_ALREADY_STARTED'));
    render(<WaitingRoom code={CODE} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rời phòng' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ván đã bắt đầu');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('người thứ 3 mở link phòng đang chơi → báo "Phòng đã đủ 2 người", không gọi join', async () => {
    signInAs(member('3', 'Third', false));
    fetchMock().mockResolvedValueOnce(ok(playingRoom));
    render(<WaitingRoom code={CODE} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Phòng đã đủ 2 người.');
    expect(requests()).toHaveLength(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('mã phòng không tồn tại → báo lỗi tiếng Việt', async () => {
    signInAs(GUEST);
    fetchMock().mockResolvedValueOnce(fail(404, 'ROOM_NOT_FOUND'));
    render(<WaitingRoom code="ZZZZZZZZ" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy phòng');
  });

  it('đang ở phòng khác → báo lỗi kèm link quay lại phòng đó', async () => {
    signInAs(GUEST);
    fetchMock()
      .mockResolvedValueOnce(ok(room()))
      .mockResolvedValueOnce(fail(409, 'ROOM_USER_BUSY'))
      .mockResolvedValueOnce(ok({ room: room({ code: 'AAAABBBB' }) }));
    render(<WaitingRoom code={CODE} />);

    expect(await screen.findByRole('link', { name: 'Quay lại phòng AAAABBBB' })).toHaveAttribute(
      'href',
      '/room/AAAABBBB',
    );
  });

  it('chủ phòng thấy phòng bị hủy → hiện "Phòng đã bị hủy" và nút về Sảnh', async () => {
    signInAs(HOST);
    fetchMock().mockResolvedValueOnce(ok(room({ status: 'CANCELLED' })));
    render(<WaitingRoom code={CODE} />);

    expect(await screen.findByText('Phòng đã bị hủy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về Sảnh' })).toHaveAttribute('href', '/lobby');
    expect(screen.queryByRole('button', { name: 'Rời phòng' })).not.toBeInTheDocument();
  });
});

describe('MatchView (màn ván cờ)', () => {
  it('AC2: người cầm Đen thấy bàn cờ xoay phía Đen, hiện màu của cả 2 người', async () => {
    signInAs(HOST); // HOST cầm BLACK trong playingRoom
    fetchMock().mockResolvedValueOnce(ok(playingRoom));
    render(<MatchView code={CODE} />);

    expect(await screen.findByTestId('player-me')).toHaveTextContent('Host (bạn)');
    expect(screen.getByTestId('player-me')).toHaveTextContent('Quân Đen');
    expect(screen.getByTestId('player-opponent')).toHaveTextContent('Quân Đỏ');
    expect(screen.getByRole('status')).toHaveTextContent('Bạn cầm quân Đen');
  });

  it('người cầm Đỏ cũng vào được ván', async () => {
    signInAs(GUEST);
    fetchMock().mockResolvedValueOnce(ok(playingRoom));
    render(<MatchView code={CODE} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Bạn cầm quân Đỏ');
  });

  it('phòng còn WAITING → quay về màn Phòng chờ', async () => {
    signInAs(HOST);
    fetchMock().mockResolvedValueOnce(ok(room()));
    render(<MatchView code={CODE} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${CODE}`));
  });

  it('không phải người chơi của phòng → quay về màn Phòng chờ', async () => {
    signInAs(member('3', 'Third', false));
    fetchMock().mockResolvedValueOnce(ok(playingRoom));
    render(<MatchView code={CODE} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${CODE}`));
  });
});
