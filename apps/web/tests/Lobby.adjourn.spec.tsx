import { render, screen } from '@testing-library/react';
import Lobby from '../components/lobby/Lobby';
import { saveSession } from '../lib/auth-api';
import type { AdjournedMatch } from '../lib/room-api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/lobby',
}));

const originalApi = process.env.NEXT_PUBLIC_API_BASE_URL;

describe('Lobby: Khối ván đang hoãn của bạn', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    localStorage.clear();
    saveSession(
      { accessToken: 'access', expiresIn: 900, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
      { id: '1', username: 'red', email: 'red@x.vn', displayName: 'Red', role: 'PLAYER', rating: 1200, createdAt: '2026-10-01T00:00:00.000Z' },
    );
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalApi;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hiển thị khối "Ván đang hoãn của bạn" với đối thủ, số nước, hoãn lúc và nút Vào tiếp', async () => {
    const mockAdjourned: AdjournedMatch[] = [
      {
        matchId: '10',
        roomCode: 'ABCD1234',
        opponent: { id: '2', username: 'opponent', displayName: 'Cao Thủ', rating: 1350 },
        myColor: 'RED',
        plyCount: 15,
        adjournedAt: '2026-11-02T07:00:00.000Z',
      },
    ];

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/me/adjourned-matches')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockAdjourned) });
      }
      if (url.includes('/rooms/current')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ room: null }) });
      }
      if (url.includes('/rooms')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });

    render(<Lobby pollIntervalMs={10000} />);

    expect(await screen.findByText('Ván đang hoãn của bạn')).toBeInTheDocument();
    expect(screen.getByText(/Cao Thủ/)).toBeInTheDocument();
    expect(screen.getByText(/Số nước: 15/)).toBeInTheDocument();

    const resumeLink = screen.getByRole('link', { name: 'Vào tiếp' });
    expect(resumeLink).toHaveAttribute('href', '/room/ABCD1234/play');
  });
});
