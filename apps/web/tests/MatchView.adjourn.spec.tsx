import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MatchView from '../components/match/MatchView';
import { saveSession } from '../lib/auth-api';
import type { GameConnection, GameState } from '../lib/game-socket';
import type { RoomDetail, RoomMember } from '../lib/room-api';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRouter = { replace: mockReplace, push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/room/K7MPQ2XA/play',
}));

const CODE = 'K7MPQ2XA';
const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1';

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

function initialGame(status: 'ACTIVE' | 'ADJOURNED' = 'ACTIVE'): GameState {
  return {
    matchId: '9',
    roomCode: CODE,
    status,
    fen: START,
    ply: 0,
    turn: 'RED',
    inCheck: false,
    result: null,
    endReason: null,
    endRule: null,
    red: { id: '1', username: 'red', displayName: 'Red', rating: 1200 },
    black: { id: '2', username: 'black', displayName: 'Black', rating: 1200 },
    yourColor: 'RED',
    lastMove: null,
    moves: [],
    drawOffer: null,
    disconnected: [],
    redTimeLeftMs: 600000,
    blackTimeLeftMs: 600000,
    clockRunning: status === 'ACTIVE' ? 'RED' : null,
    incrementMs: 0,
    serverTime: '2026-10-21T08:00:00.000Z',
    startedAt: '2026-10-21T08:00:00.000Z',
    endedAt: null,
  };
}

const originalApi = process.env.NEXT_PUBLIC_API_BASE_URL;

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

describe('MatchView: Hoãn ván và trạng thái ADJOURNED', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    localStorage.clear();
    saveSession(
      { accessToken: 'access', expiresIn: 900, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
      { id: '1', username: 'red', email: 'red@x.vn', displayName: 'Red', role: 'PLAYER', rating: 1200, createdAt: '2026-10-01T00:00:00.000Z' },
    );
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes(`/rooms/${CODE}`)) {
        return Promise.resolve(ok(playingRoom));
      }
      return Promise.resolve(ok([]));
    });
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalApi;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('khi đối thủ mất kết nối, hiện nút "Lưu ván & hoãn", có hộp xác nhận trước khi hoãn', async () => {
    const game = initialGame('ACTIVE');
    game.disconnected = [{ color: 'BLACK', deadline: new Date(Date.now() + 60000).toISOString() }];

    const mockAdjourn = jest.fn().mockResolvedValue({
      ...game,
      status: 'ADJOURNED',
      clockRunning: null,
      disconnected: [],
    });

    const mockConn: GameConnection = {
      join: jest.fn().mockResolvedValue(game),
      move: jest.fn(),
      resign: jest.fn(),
      offerDraw: jest.fn(),
      answerDraw: jest.fn(),
      adjourn: mockAdjourn,
      onUpdate: jest.fn(),
      onEnd: jest.fn(),
      onDrawOffered: jest.fn(),
      onDrawRejected: jest.fn(),
      onPlayerDisconnected: jest.fn(),
      onPlayerReconnected: jest.fn(),
      onConnectionChange: jest.fn(),
      signal: jest.fn(),
      onSignal: jest.fn(),
      sendChat: jest.fn(),
      onChatMessage: jest.fn(),
      close: jest.fn(),
    };

    render(<MatchView code={CODE} connect={() => mockConn} />);

    expect(await screen.findByTestId('opponent-disconnected')).toBeInTheDocument();
    const adjournBtn = screen.getByRole('button', { name: 'Lưu ván & hoãn' });
    expect(adjournBtn).toBeInTheDocument();

    // Bấm nút -> hiện Modal xác nhận
    fireEvent.click(adjournBtn);
    expect(await screen.findByText('Hoãn ván đấu?')).toBeInTheDocument();

    // Bấm nút xác nhận trong Modal
    const confirmBtn = screen.getAllByRole('button', { name: 'Lưu ván & hoãn' })[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockAdjourn).toHaveBeenCalledWith('9');
    });
  });

  it('ván ở trạng thái ADJOURNED: hiện thông báo hoãn, khóa đi quân, vẫn xin thua được', async () => {
    const game = initialGame('ADJOURNED');

    const mockResign = jest.fn().mockResolvedValue({
      ...game,
      status: 'FINISHED',
      result: 'BLACK_WIN',
      endReason: 'RESIGNATION',
    });

    const mockConn: GameConnection = {
      join: jest.fn().mockResolvedValue(game),
      move: jest.fn(),
      resign: mockResign,
      offerDraw: jest.fn(),
      answerDraw: jest.fn(),
      adjourn: jest.fn(),
      onUpdate: jest.fn(),
      onEnd: jest.fn(),
      onDrawOffered: jest.fn(),
      onDrawRejected: jest.fn(),
      onPlayerDisconnected: jest.fn(),
      onPlayerReconnected: jest.fn(),
      onConnectionChange: jest.fn(),
      signal: jest.fn(),
      onSignal: jest.fn(),
      sendChat: jest.fn(),
      onChatMessage: jest.fn(),
      close: jest.fn(),
    };

    render(<MatchView code={CODE} connect={() => mockConn} />);

    // Banner hoãn ván
    expect(await screen.findByText('Ván đang hoãn – chờ đối thủ vào để đánh tiếp')).toBeInTheDocument();

    // Nút xin hòa bị disable
    const drawBtn = screen.getByRole('button', { name: /Xin hòa/ });
    expect(drawBtn).toBeDisabled();

    // Nút xin thua vẫn bấm được
    const resignBtn = screen.getByRole('button', { name: /Xin thua/ });
    expect(resignBtn).toBeEnabled();

    fireEvent.click(resignBtn);
    expect(await screen.findByText('Xin thua?')).toBeInTheDocument();

    const confirmResignBtn = screen.getByRole('button', { name: 'Xin thua' });
    fireEvent.click(confirmResignBtn);

    await waitFor(() => {
      expect(mockResign).toHaveBeenCalledWith('9');
    });
  });
});
