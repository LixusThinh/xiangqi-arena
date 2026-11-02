import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminView from '@/components/admin/AdminView';
import { adminApi } from '@/lib/admin-api';
import { saveSession } from '@/lib/auth-api';

jest.mock('@/lib/admin-api');

const mockDashboard = {
  totalUsers: 10,
  totalMatches: 25,
  todayMatches: 5,
  openReports: 2,
  onlineUsers: 4,
};

const mockUsersPage = {
  items: [
    {
      id: '1',
      username: 'admin',
      displayName: 'Quản trị viên',
      email: 'admin@test.com',
      role: 'ADMIN' as const,
      accountStatus: 'ACTIVE' as const,
      rating: 1600,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: '2',
      username: 'player1',
      displayName: 'Kỳ thủ 1',
      email: 'p1@test.com',
      role: 'PLAYER' as const,
      accountStatus: 'ACTIVE' as const,
      rating: 1200,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
  totalPages: 1,
};

const mockMatchesPage = {
  items: [
    {
      id: 'match-1',
      red: { id: '2', username: 'player1', displayName: 'Kỳ thủ 1' },
      black: { id: '3', username: 'player2', displayName: 'Kỳ thủ 2' },
      status: 'FINISHED' as const,
      result: 'RED_WIN' as const,
      endReason: 'CHECKMATE',
      startedAt: '2026-11-02T01:00:00.000Z',
      endedAt: '2026-11-02T01:15:00.000Z',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
};

const mockMatchDetail = {
  ...mockMatchesPage.items[0],
  currentFen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1',
  moves: [
    {
      ply: 1,
      from: 'b2',
      to: 'e2',
      piece: 'C',
      captured: null,
      isCheck: false,
      fenAfter: 'test-fen',
      thinkTimeMs: 2500,
      createdAt: '2026-11-02T01:01:00.000Z',
    },
  ],
};

const mockReportsPage = {
  items: [
    {
      id: 'rep-1',
      matchId: 'match-1',
      reporter: { id: '2', username: 'player1', displayName: 'Kỳ thủ 1' },
      reportedUser: { id: '3', username: 'player2', displayName: 'Kỳ thủ 2' },
      reason: 'CHEATING' as const,
      description: 'Nghi vấn dùng phần mềm',
      status: 'OPEN' as const,
      handledBy: null,
      handledAt: null,
      createdAt: '2026-11-02T01:20:00.000Z',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
};

describe('<AdminView />', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('hiển thị thông báo từ chối truy cập nếu chưa đăng nhập hoặc role là PLAYER (AC-31-02)', async () => {
    saveSession(
      { accessToken: 'tok', expiresIn: 900, refreshToken: 'ref', refreshExpiresIn: 604800 },
      { id: '2', username: 'player1', email: 'p1@test.com', displayName: 'Player 1', role: 'PLAYER', rating: 1200, createdAt: '' },
    );

    render(<AdminView />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-forbidden-message')).toBeInTheDocument();
      expect(screen.getByText('Bạn không có quyền vào trang này.')).toBeInTheDocument();
    });
  });

  it('cho phép ADMIN truy cập và hiển thị tab Tổng quan dashboard', async () => {
    saveSession(
      { accessToken: 'tok-admin', expiresIn: 900, refreshToken: 'ref', refreshExpiresIn: 604800 },
      { id: '1', username: 'admin', email: 'admin@test.com', displayName: 'Admin Boss', role: 'ADMIN', rating: 1600, createdAt: '' },
    );
    (adminApi.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);

    render(<AdminView />);

    await waitFor(() => {
      expect(screen.getByText('Quản trị hệ thống')).toBeInTheDocument();
      expect(screen.getByTestId('admin-dashboard-tab')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // totalUsers
      expect(screen.getByText('25')).toBeInTheDocument(); // totalMatches
    });
  });

  it('chuyển sang tab Người dùng và thực hiện thao tác Khóa tài khoản', async () => {
    saveSession(
      { accessToken: 'tok-admin', expiresIn: 900, refreshToken: 'ref', refreshExpiresIn: 604800 },
      { id: '1', username: 'admin', email: 'admin@test.com', displayName: 'Admin Boss', role: 'ADMIN', rating: 1600, createdAt: '' },
    );
    (adminApi.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);
    (adminApi.getUsers as jest.Mock).mockResolvedValue(mockUsersPage);
    (adminApi.updateUserStatus as jest.Mock).mockResolvedValue({
      ...mockUsersPage.items[1],
      accountStatus: 'LOCKED',
    });

    render(<AdminView />);

    await waitFor(() => expect(screen.getByTestId('admin-tab-users')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-tab-users'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-users-tab')).toBeInTheDocument();
      expect(screen.getByText('Kỳ thủ 1')).toBeInTheDocument();
    });

    // Nút Khóa tài khoản của player1 (nút thứ 0 là của admin đang đăng nhập nên bị disabled)
    const lockButtons = screen.getAllByRole('button', { name: 'Khóa' });
    expect(lockButtons.length).toBeGreaterThan(1);
    expect(lockButtons[0]).toBeDisabled();
    expect(lockButtons[1]).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(lockButtons[1]);
    });

    // Hiện modal xác nhận khóa
    await waitFor(() => {
      expect(screen.getByText('Khóa tài khoản?')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: 'Khóa tài khoản' });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(adminApi.updateUserStatus).toHaveBeenCalledWith('2', 'LOCKED');
  });

  it('chuyển sang tab Ván đấu và xem chi tiết ván', async () => {
    saveSession(
      { accessToken: 'tok-admin', expiresIn: 900, refreshToken: 'ref', refreshExpiresIn: 604800 },
      { id: '1', username: 'admin', email: 'admin@test.com', displayName: 'Admin Boss', role: 'ADMIN', rating: 1600, createdAt: '' },
    );
    (adminApi.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);
    (adminApi.getMatches as jest.Mock).mockResolvedValue(mockMatchesPage);
    (adminApi.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<AdminView />);

    await waitFor(() => expect(screen.getByTestId('admin-tab-matches')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-tab-matches'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-matches-tab')).toBeInTheDocument();
      expect(screen.getByText('Đỏ thắng')).toBeInTheDocument();
    });

    const viewBtn = screen.getByRole('button', { name: 'Xem' });
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    await waitFor(() => {
      expect(adminApi.getMatchDetail).toHaveBeenCalledWith('match-1');
      expect(screen.getByText('Chi tiết ván đấu')).toBeInTheDocument();
      expect(screen.getByText(/b2.*e2/)).toBeInTheDocument();
    });
  });

  it('chuyển sang tab Báo cáo và tiếp nhận xử lý', async () => {
    saveSession(
      { accessToken: 'tok-admin', expiresIn: 900, refreshToken: 'ref', refreshExpiresIn: 604800 },
      { id: '1', username: 'admin', email: 'admin@test.com', displayName: 'Admin Boss', role: 'ADMIN', rating: 1600, createdAt: '' },
    );
    (adminApi.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);
    (adminApi.getReports as jest.Mock).mockResolvedValue(mockReportsPage);
    (adminApi.updateReportStatus as jest.Mock).mockResolvedValue({
      ...mockReportsPage.items[0],
      status: 'PROCESSING',
      handledBy: { id: '1', username: 'admin', displayName: 'Admin Boss' },
    });

    render(<AdminView />);

    await waitFor(() => expect(screen.getByTestId('admin-tab-reports')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-tab-reports'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-reports-tab')).toBeInTheDocument();
      expect(screen.getByText('Nghi vấn dùng phần mềm')).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole('button', { name: 'Tiếp nhận' });
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    expect(adminApi.updateReportStatus).toHaveBeenCalledWith('rep-1', 'PROCESSING');
  });
});
