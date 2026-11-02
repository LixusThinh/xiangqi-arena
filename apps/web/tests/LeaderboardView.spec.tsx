import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LeaderboardView from '@/components/leaderboard/LeaderboardView';
import { leaderboardApi, type LeaderboardPage } from '@/lib/leaderboard-api';
import { saveSession } from '@/lib/auth-api';

jest.mock('@/lib/leaderboard-api');

const mockPage: LeaderboardPage = {
  items: [
    { rank: 1, id: '10', username: 'player1', displayName: 'Player One', rating: 1500, gamesPlayed: 20 },
    { rank: 2, id: '20', username: 'player2', displayName: 'Player Two', rating: 1400, gamesPlayed: 15 },
    { rank: 3, id: '30', username: 'player3', displayName: 'Player Three', rating: 1300, gamesPlayed: 10 },
  ],
  page: 1,
  pageSize: 20,
  total: 3,
  totalPages: 1,
};

describe('<LeaderboardView />', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('hiển thị tiêu đề và danh sách bảng xếp hạng', async () => {
    (leaderboardApi.getLeaderboard as jest.Mock).mockResolvedValue(mockPage);

    render(<LeaderboardView />);
    expect(screen.getByText('Đang tải bảng xếp hạng…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Bảng xếp hạng')).toBeInTheDocument();
      expect(screen.getByText('Player One')).toBeInTheDocument();
      expect(screen.getByText('@player1')).toBeInTheDocument();
      expect(screen.getByText('1500')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  it('tô dòng của chính mình nếu đã đăng nhập', async () => {
    saveSession(
      { accessToken: 'tok', expiresIn: 900, refreshToken: 'ref', refreshExpiresIn: 604800 },
      { id: '20', username: 'player2', email: 'p2@test.com', displayName: 'Player Two', role: 'PLAYER', rating: 1400, createdAt: '' },
    );
    (leaderboardApi.getLeaderboard as jest.Mock).mockResolvedValue(mockPage);

    render(<LeaderboardView />);
    await waitFor(() => {
      const myRow = screen.getByTestId('current-user-row');
      expect(myRow).toBeInTheDocument();
      expect(myRow).toHaveTextContent('Player Two');
      expect(myRow).toHaveTextContent('Bạn');
    });
  });

  it('chuyển trang bằng nút phân trang', async () => {
    const multiPage: LeaderboardPage = {
      ...mockPage,
      totalPages: 2,
    };
    (leaderboardApi.getLeaderboard as jest.Mock).mockResolvedValue(multiPage);

    render(<LeaderboardView />);
    await waitFor(() => expect(screen.getByText('Trang 1/2')).toBeInTheDocument());

    const nextBtn = screen.getByRole('button', { name: 'Trang sau →' });
    expect(nextBtn).toBeEnabled();

    (leaderboardApi.getLeaderboard as jest.Mock).mockResolvedValue({
      ...mockPage,
      page: 2,
      totalPages: 2,
    });

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith(2);
  });

  it('hiển thị thông báo lỗi khi API thất bại', async () => {
    (leaderboardApi.getLeaderboard as jest.Mock).mockRejectedValue(new Error('Lỗi máy chủ'));

    render(<LeaderboardView />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    });
  });
});
