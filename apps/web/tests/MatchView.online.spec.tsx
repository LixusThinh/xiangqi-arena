/**
 * XQA-76: đi quân online qua socket.
 * AC1: đi trên máy A, máy B thấy ngay. AC2: nước bị từ chối không làm lệch bàn cờ.
 * Socket thật được thay bằng GameConnection giả (contract docs/api/socket.md).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MatchView from '../components/MatchView';
import { saveSession } from '../lib/auth-api';
import {
  GameSocketError,
  type GameConnection,
  type GameEnd,
  type GameState,
  type MoveRequest,
} from '../lib/game-socket';
import type { RoomDetail, RoomMember } from '../lib/room-api';

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Router của Next ổn định giữa các lần render → mock cũng phải trả cùng 1 object
const mockRouter = { replace: mockReplace, push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/room/K7MPQ2XA/play',
}));

const CODE = 'K7MPQ2XA';
const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1';
const AFTER_C2_5 = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1';
// Ô theo xiangqi-core: index = hàng * 9 + cột, hàng 0 = đáy bên Đen
const H7 = 7 * 9 + 7;
const E7 = 7 * 9 + 4;
const H0 = 7;

const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function member(id: string, name: string, color: RoomMember['color']): RoomMember {
  return { id, username: name.toLowerCase(), displayName: name, rating: 1200, isHost: id === '1', color, joinedAt: '2026-10-21T08:00:00.000Z' };
}
const RED = member('1', 'Red', 'RED');
const BLACK = member('2', 'Black', 'BLACK');

const playingRoom: RoomDetail = {
  code: CODE,
  name: 'Phòng test',
  visibility: 'PUBLIC',
  status: 'PLAYING',
  hostColorPref: 'RED',
  ruleProfile: { code: 'VN_STANDARD', baseTimeSec: 600, incrementSec: 0, isRanked: false },
  host: { id: '1', username: 'red', displayName: 'Red', rating: 1200 },
  playerCount: 2,
  createdAt: '2026-10-21T08:00:00.000Z',
  members: [RED, BLACK],
  matchId: '9',
};

function state(overrides: Partial<GameState> = {}): GameState {
  const player = (m: RoomMember) => ({ id: m.id, username: m.username, displayName: m.displayName, rating: 1200 });
  return {
    matchId: '9',
    roomCode: CODE,
    status: 'ACTIVE',
    fen: START,
    ply: 0,
    turn: 'RED',
    inCheck: false,
    result: null,
    endReason: null,
    endRule: null,
    red: player(RED),
    black: player(BLACK),
    yourColor: 'RED',
    lastMove: null,
    moves: [],
    redTimeLeftMs: 600000,
    blackTimeLeftMs: 600000,
    startedAt: '2026-10-21T08:00:00.000Z',
    endedAt: null,
    ...overrides,
  };
}

const afterRedMove = (yourColor: 'RED' | 'BLACK') =>
  state({
    fen: AFTER_C2_5,
    ply: 1,
    turn: 'BLACK',
    yourColor,
    lastMove: { ply: 1, from: 'h7', to: 'e7', piece: 'C', captured: null, isCheck: false },
  });

class FakeConnection implements GameConnection {
  updates: Array<(s: GameState) => void> = [];
  ends: Array<(e: GameEnd) => void> = [];
  conn: Array<(c: boolean) => void> = [];
  moves: MoveRequest[] = [];
  joins = 0;
  closed = false;
  constructor(
    public joinState: GameState,
    public moveImpl: (m: MoveRequest) => Promise<GameState> = () => new Promise(() => undefined),
  ) {}
  join = jest.fn(async () => {
    this.joins++;
    return this.joinState;
  });
  move = jest.fn((m: MoveRequest) => {
    this.moves.push(m);
    return this.moveImpl(m);
  });
  onUpdate(l: (s: GameState) => void) {
    this.updates.push(l);
  }
  onEnd(l: (e: GameEnd) => void) {
    this.ends.push(l);
  }
  onConnectionChange(l: (c: boolean) => void) {
    this.conn.push(l);
  }
  close() {
    this.closed = true;
  }
  pushUpdate(s: GameState) {
    act(() => this.updates.forEach((l) => l(s)));
  }
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

function signInAs(user: RoomMember) {
  saveSession(
    { accessToken: 'access', expiresIn: 900, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
    { id: user.id, username: user.username, email: `${user.username}@x.vn`, displayName: user.displayName, role: 'PLAYER', rating: 1200, createdAt: '2026-10-01T00:00:00.000Z' },
  );
}

async function renderAs(user: RoomMember, conn: FakeConnection) {
  signInAs(user);
  (global.fetch as jest.Mock).mockResolvedValueOnce(ok(playingRoom));
  const connect = jest.fn(() => conn);
  render(<MatchView code={CODE} connect={connect} />);
  await waitFor(() => expect(conn.join).toHaveBeenCalledWith(CODE));
  await screen.findByText(/Đến lượt/);
  return connect;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.test';
  global.fetch = jest.fn();
  localStorage.clear();
  mockReplace.mockReset();
  mockPush.mockReset();
});

afterAll(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
});

describe('MatchView – đi quân online (XQA-76)', () => {
  it('kết nối bằng access token và join theo mã phòng', async () => {
    const conn = new FakeConnection(state());
    const connect = await renderAs(RED, conn);
    expect(connect).toHaveBeenCalledWith('access');
    expect(screen.getByRole('status')).toHaveTextContent('Đến lượt bạn (Đỏ)');
  });

  it('gửi game:move với ô a0..i9 + expectedPly, bàn cờ đổi theo state server trả về', async () => {
    const conn = new FakeConnection(state(), async () => afterRedMove('RED'));
    await renderAs(RED, conn);

    fireEvent.click(screen.getByTestId(`piece-${H7}`));
    expect(screen.getByTestId(`valid-move-${E7}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`cell-${E7}`));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đến lượt đối thủ (Đen)'));
    expect(conn.moves).toEqual([{ matchId: '9', from: 'h7', to: 'e7', expectedPly: 0 }]);
    expect(screen.getByTestId(`piece-${E7}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`piece-${H7}`)).not.toBeInTheDocument();
  });

  it('chưa có xác nhận từ server thì bàn cờ chưa đổi', async () => {
    const conn = new FakeConnection(state()); // move không bao giờ trả
    await renderAs(RED, conn);
    fireEvent.click(screen.getByTestId(`piece-${H7}`));
    fireEvent.click(screen.getByTestId(`cell-${E7}`));
    await waitFor(() => expect(conn.move).toHaveBeenCalled());
    expect(screen.getByTestId(`piece-${H7}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`piece-${E7}`)).not.toBeInTheDocument();
  });

  it('AC1: máy B (Đen) thấy nước của Đỏ ngay khi nhận game:update', async () => {
    const conn = new FakeConnection(state({ yourColor: 'BLACK' }));
    await renderAs(BLACK, conn);
    expect(screen.getByRole('status')).toHaveTextContent('Đến lượt đối thủ (Đỏ)');

    conn.pushUpdate(afterRedMove('BLACK'));

    expect(screen.getByTestId(`piece-${E7}`)).toBeInTheDocument();
    expect(screen.getByTestId('last-move-to')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đến lượt bạn (Đen)');
  });

  it('AC2: server từ chối → bàn cờ giữ nguyên, hiện lỗi tiếng Việt', async () => {
    const conn = new FakeConnection(state(), async () => {
      throw new GameSocketError('GAME_NOT_YOUR_TURN', 'It is not your turn');
    });
    await renderAs(RED, conn);
    fireEvent.click(screen.getByTestId(`piece-${H7}`));
    fireEvent.click(screen.getByTestId(`cell-${E7}`));

    expect(await screen.findByTestId('move-notice')).toHaveTextContent('Chưa tới lượt bạn.');
    expect(screen.getByTestId(`piece-${H7}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`piece-${E7}`)).not.toBeInTheDocument();
  });

  it('GAME_STALE_STATE → join lại để lấy thế cờ mới của server', async () => {
    const conn = new FakeConnection(state(), async () => {
      throw new GameSocketError('GAME_STALE_STATE', 'stale');
    });
    await renderAs(RED, conn);
    conn.joinState = afterRedMove('RED');
    fireEvent.click(screen.getByTestId(`piece-${H7}`));
    fireEvent.click(screen.getByTestId(`cell-${E7}`));

    await waitFor(() => expect(conn.joins).toBe(2));
    await waitFor(() => expect(screen.getByTestId(`piece-${E7}`)).toBeInTheDocument());
    expect(screen.getByTestId('move-notice')).toHaveTextContent('Bàn cờ vừa thay đổi');
  });

  it('không tới lượt thì không chọn được quân, không gửi gì', async () => {
    const conn = new FakeConnection(state({ yourColor: 'BLACK' }));
    await renderAs(BLACK, conn);
    fireEvent.click(screen.getByTestId(`piece-${H0}`));
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();
    expect(conn.move).not.toHaveBeenCalled();
  });

  it('nước sai luật bị chặn ngay ở máy, không gửi lên server', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    fireEvent.click(screen.getByTestId(`piece-${H7}`));
    fireEvent.click(screen.getByTestId(`cell-${8 * 9 + 6}`)); // Pháo h7 → g8: đi chéo, sai luật
    expect(screen.getByTestId('move-notice')).toHaveTextContent('Nước đi không hợp lệ.');
    expect(conn.move).not.toHaveBeenCalled();
    expect(screen.getByTestId(`piece-${H7}`)).toBeInTheDocument();
  });

  it('game:end → hộp thoại kết thúc, nút Về Sảnh', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    act(() => conn.ends.forEach((l) => l({ matchId: '9', result: 'DRAW', endReason: 'REPETITION', endRule: 'Điều 24.2' })));
    expect(await screen.findByText(/Hòa — Lặp nước \(Điều 23\) — Điều 24.2\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Về Sảnh' }));
    expect(mockPush).toHaveBeenCalledWith('/lobby');
  });

  it('mất kết nối → hiện banner, có lại → ẩn', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    act(() => conn.conn.forEach((l) => l(false)));
    expect(screen.getByRole('alert')).toHaveTextContent('Mất kết nối máy chủ');
    act(() => conn.conn.forEach((l) => l(true)));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
