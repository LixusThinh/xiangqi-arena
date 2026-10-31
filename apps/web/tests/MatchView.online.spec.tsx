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
  type DrawRejected,
  type PlayerDisconnected,
  type PlayerReconnected,
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
    drawOffer: null,
    disconnected: [],
    redTimeLeftMs: 600000,
    blackTimeLeftMs: 600000,
    clockRunning: 'RED',
    incrementMs: 0,
    serverTime: '2026-10-21T08:00:00.000Z',
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
  rejected: Array<(r: DrawRejected) => void> = [];
  gone: Array<(p: PlayerDisconnected) => void> = [];
  back: Array<(p: PlayerReconnected) => void> = [];
  moves: MoveRequest[] = [];
  /** Kết quả cho resign / offerDraw / answerDraw; mặc định không bao giờ trả. */
  actionImpl: (name: string) => Promise<GameState> = () => new Promise(() => undefined);
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
  resign = jest.fn((matchId: string) => this.actionImpl(`resign:${matchId}`));
  offerDraw = jest.fn((matchId: string) => this.actionImpl(`offer:${matchId}`));
  answerDraw = jest.fn((matchId: string, accept: boolean) => this.actionImpl(`${accept ? 'accept' : 'reject'}:${matchId}`));
  onDrawOffered() {}
  onDrawRejected(l: (r: DrawRejected) => void) {
    this.rejected.push(l);
  }
  onPlayerDisconnected(l: (p: PlayerDisconnected) => void) {
    this.gone.push(l);
  }
  onPlayerReconnected(l: (p: PlayerReconnected) => void) {
    this.back.push(l);
  }
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

describe('MatchView – xin hòa / xin thua (XQA-92)', () => {
  const finished = (overrides: Partial<GameState>) => state({ status: 'FINISHED', turn: null, ...overrides });

  it('AC2: Xin thua có bước xác nhận; Chơi tiếp thì không gửi gì', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    fireEvent.click(screen.getByRole('button', { name: /Xin thua/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Bạn chắc chắn muốn xin thua?');
    fireEvent.click(screen.getByRole('button', { name: 'Chơi tiếp' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(conn.resign).not.toHaveBeenCalled();
  });

  it('AC2: xác nhận Xin thua → gửi game:resign, hiện kết quả server trả về', async () => {
    const conn = new FakeConnection(state());
    conn.actionImpl = async () => finished({ result: 'BLACK_WIN', endReason: 'RESIGNATION' });
    await renderAs(RED, conn);
    fireEvent.click(screen.getByRole('button', { name: /Xin thua/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xin thua' }));
    expect(conn.resign).toHaveBeenCalledWith('9');
    expect(await screen.findByText('Đen thắng — Xin thua.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xin hòa/ })).not.toBeInTheDocument();
  });

  it('Xin hòa → gửi game:draw-offer, hiện "đã gửi", nút Xin hòa bị khóa', async () => {
    const conn = new FakeConnection(state());
    conn.actionImpl = async () => state({ drawOffer: { by: 'RED', atPly: 0 } });
    await renderAs(RED, conn);
    fireEvent.click(screen.getByRole('button', { name: /Xin hòa/ }));
    expect(conn.offerDraw).toHaveBeenCalledWith('9');
    expect(await screen.findByTestId('draw-offer-sent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xin hòa/ })).toBeDisabled();
    // Người đề nghị không thấy popup trả lời
    expect(screen.queryByText('Đối thủ đề nghị hòa')).not.toBeInTheDocument();
  });

  it('AC1: đối thủ thấy popup đề nghị hòa; Đồng ý → gửi draw-accept, ván Hòa', async () => {
    const conn = new FakeConnection(state({ yourColor: 'BLACK' }));
    conn.actionImpl = async () =>
      finished({ yourColor: 'BLACK', result: 'DRAW', endReason: 'DRAW_AGREEMENT' });
    await renderAs(BLACK, conn);
    conn.pushUpdate(state({ yourColor: 'BLACK', drawOffer: { by: 'RED', atPly: 0 } }));
    expect(screen.getByText('Đối thủ đề nghị hòa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý hòa' }));
    expect(conn.answerDraw).toHaveBeenCalledWith('9', true);
    expect(await screen.findByText('Hòa — Hai bên đồng ý hòa.')).toBeInTheDocument();
  });

  it('Từ chối → gửi draw-reject, popup đóng, ván tiếp tục', async () => {
    const conn = new FakeConnection(state({ yourColor: 'BLACK' }));
    conn.actionImpl = async () => state({ yourColor: 'BLACK' });
    await renderAs(BLACK, conn);
    conn.pushUpdate(state({ yourColor: 'BLACK', drawOffer: { by: 'RED', atPly: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    expect(conn.answerDraw).toHaveBeenCalledWith('9', false);
    await waitFor(() => expect(screen.queryByText('Đối thủ đề nghị hòa')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Đến lượt đối thủ (Đỏ)');
  });

  it('người đề nghị nhận game:draw-rejected → hiện thông báo', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    act(() => conn.rejected.forEach((l) => l({ matchId: '9', by: 'BLACK' })));
    expect(screen.getByTestId('move-notice')).toHaveTextContent('Đối thủ đã từ chối đề nghị hòa.');
  });

  it('server từ chối (GAME_DRAW_OFFER_TOO_SOON) → báo tiếng Việt + tải lại state', async () => {
    const conn = new FakeConnection(state());
    conn.actionImpl = async () => {
      throw new GameSocketError('GAME_DRAW_OFFER_TOO_SOON', 'too soon');
    };
    await renderAs(RED, conn);
    fireEvent.click(screen.getByRole('button', { name: /Xin hòa/ }));
    expect(await screen.findByTestId('move-notice')).toHaveTextContent('Đi thêm một nước rồi hãy đề nghị lại.');
    await waitFor(() => expect(conn.joins).toBe(2));
  });

  it('reload giữa lúc có đề nghị hòa của đối thủ → popup vẫn hiện (theo state server)', async () => {
    const conn = new FakeConnection(state({ yourColor: 'BLACK', drawOffer: { by: 'RED', atPly: 0 } }));
    signInAs(BLACK);
    (global.fetch as jest.Mock).mockResolvedValueOnce(ok(playingRoom));
    render(<MatchView code={CODE} connect={() => conn} />);
    expect(await screen.findByText('Đối thủ đề nghị hòa')).toBeInTheDocument();
  });
});

describe('MatchView – vào lại ván, banner mất kết nối (XQA-94)', () => {
  const T0 = Date.parse('2026-10-28T10:00:00.000Z');
  afterEach(() => {
    jest.useRealTimers();
  });

  it('AC1: reload giữa ván → join lại theo mã phòng, bàn cờ khôi phục đúng nước đã đi + lượt', async () => {
    const conn = new FakeConnection(afterRedMove('BLACK'));
    await renderAs(BLACK, conn);
    expect(conn.join).toHaveBeenCalledWith(CODE);
    expect(screen.getByTestId(`piece-${E7}`)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đến lượt bạn (Đen)');
  });

  it('AC2: đối thủ mất kết nối → banner đếm ngược theo hạn của server, mỗi giây giảm 1', async () => {
    jest.useFakeTimers({ now: T0 });
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    act(() =>
      conn.gone.forEach((l) =>
        l({ matchId: '9', color: 'BLACK', deadline: new Date(T0 + 60_000).toISOString(), graceSec: 60 }),
      ),
    );
    expect(screen.getByTestId('opponent-disconnected')).toHaveTextContent('60 giây');
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId('opponent-disconnected')).toHaveTextContent('55 giây');
  });

  it('đối thủ vào lại (player:reconnected) → banner tắt', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    act(() =>
      conn.gone.forEach((l) =>
        l({ matchId: '9', color: 'BLACK', deadline: new Date(Date.now() + 60_000).toISOString(), graceSec: 60 }),
      ),
    );
    expect(screen.getByTestId('opponent-disconnected')).toBeInTheDocument();
    act(() => conn.back.forEach((l) => l({ matchId: '9', color: 'BLACK' })));
    expect(screen.queryByTestId('opponent-disconnected')).not.toBeInTheDocument();
  });

  it('reload khi đối thủ đang mất kết nối → banner hiện ngay từ state.disconnected', async () => {
    const deadline = new Date(Date.now() + 30_000).toISOString();
    const conn = new FakeConnection(state({ disconnected: [{ color: 'BLACK', deadline }] }));
    await renderAs(RED, conn);
    expect(screen.getByTestId('opponent-disconnected')).toHaveTextContent(/(29|30) giây/);
  });

  it('banner không hiện cho chính mình và tắt khi ván kết thúc', async () => {
    const deadline = new Date(Date.now() + 30_000).toISOString();
    const conn = new FakeConnection(state({ disconnected: [{ color: 'RED', deadline }] }));
    await renderAs(RED, conn);
    expect(screen.queryByTestId('opponent-disconnected')).not.toBeInTheDocument();
    conn.pushUpdate(
      state({ status: 'FINISHED', turn: null, result: 'RED_WIN', endReason: 'DISCONNECT', disconnected: [] }),
    );
    expect(await screen.findByText('Đỏ thắng — Mất kết nối quá thời gian chờ.')).toBeInTheDocument();
    expect(screen.queryByTestId('opponent-disconnected')).not.toBeInTheDocument();
  });

  it('mình mất kết nối → banner "đang thử kết nối lại" nhắc hạn 60 giây', async () => {
    const conn = new FakeConnection(state());
    await renderAs(RED, conn);
    act(() => conn.conn.forEach((l) => l(false)));
    expect(screen.getByRole('alert')).toHaveTextContent('Vào lại trong 60 giây');
  });
});

describe('MatchView – đồng hồ (XQA-142, giờ do server tính)', () => {
  it('hiện đồng hồ 2 bên theo số server gửi', async () => {
    const conn = new FakeConnection(state({ redTimeLeftMs: 600_000, blackTimeLeftMs: 245_000, clockRunning: 'RED' }));
    await renderAs(RED, conn);
    expect(screen.getByTestId('clock-me')).toHaveTextContent(/^(10:00|9:59)$/);
    expect(screen.getByTestId('clock-opponent')).toHaveTextContent('4:05');
  });

  it('đồng hồ máy mình về 0 thì đứng ở 0:00, KHÔNG tự kết thúc ván – chỉ server gửi game:end', async () => {
    const conn = new FakeConnection(state({ redTimeLeftMs: 300, clockRunning: 'RED' }));
    await renderAs(RED, conn);
    await waitFor(() => expect(screen.getByTestId('clock-me')).toHaveTextContent('0:00.0'), { timeout: 2000 });
    expect(screen.queryByRole('button', { name: 'Về Sảnh' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đến lượt bạn');
    expect(conn.resign).not.toHaveBeenCalled();

    act(() => conn.ends.forEach((l) => l({ matchId: '9', result: 'BLACK_WIN', endReason: 'TIMEOUT', endRule: null })));
    expect(await screen.findByText(/Hết giờ/)).toBeInTheDocument();
  });
});
