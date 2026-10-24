/**
 * XQA-67 AC1: chưa đăng nhập vào /lobby bị đưa về /login.
 */
import { act, render, screen } from '@testing-library/react';
import AuthGuard, { isProtectedPath } from '../components/AuthGuard';
import { clearSession, saveSession } from '../lib/auth-api';

const mockReplace = jest.fn();
let mockPathname = '/lobby';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const user = {
  id: '42',
  username: 'player1',
  email: 'player1@example.com',
  displayName: 'Player One',
  role: 'PLAYER' as const,
  rating: 1200,
  createdAt: '2026-10-12T10:00:00.000Z',
};

function signIn(accessExpiresInSec = 900) {
  saveSession(
    { accessToken: 'a', expiresIn: accessExpiresInSec, refreshToken: 'r'.repeat(43), refreshExpiresIn: 3600 },
    user,
  );
}

function renderAt(path: string) {
  mockPathname = path;
  window.history.replaceState(null, '', path);
  return render(
    <AuthGuard>
      <p>Nội dung bảo vệ</p>
    </AuthGuard>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockReplace.mockClear();
});

afterAll(() => window.history.replaceState(null, '', '/'));

describe('AuthGuard', () => {
  it('AC1: chưa đăng nhập vào /lobby → chuyển về /login?next=/lobby, không hiện nội dung', () => {
    renderAt('/lobby');
    expect(mockReplace).toHaveBeenCalledWith('/login?next=%2Flobby');
    expect(screen.queryByText('Nội dung bảo vệ')).not.toBeInTheDocument();
  });

  it('giữ nguyên đường dẫn và query trong ?next= (link mời vào phòng)', () => {
    renderAt('/room/K7MPQ2XA?invite=1');
    expect(mockReplace).toHaveBeenCalledWith('/login?next=%2Froom%2FK7MPQ2XA%3Finvite%3D1');
  });

  it('đã đăng nhập → hiện nội dung', () => {
    signIn();
    renderAt('/lobby');
    expect(screen.getByText('Nội dung bảo vệ')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('AC2: access token hết hạn nhưng phiên còn refresh được → KHÔNG bị đá ra', () => {
    signIn(-1);
    renderAt('/lobby');
    expect(screen.getByText('Nội dung bảo vệ')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('đang ở trang bảo vệ mà phiên bị xóa (đăng xuất) → chuyển về /login', () => {
    signIn();
    renderAt('/lobby');
    act(() => clearSession());
    expect(mockReplace).toHaveBeenCalledWith('/login?next=%2Flobby');
  });

  it('trang công khai (/, /login) không cần đăng nhập', () => {
    renderAt('/login');
    expect(screen.getByText('Nội dung bảo vệ')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('isProtectedPath', () => {
  it.each([
    ['/lobby', true],
    ['/room/K7MPQ2XA', true],
    ['/history', true],
    ['/', false],
    ['/login', false],
    ['/register', false],
    ['/lobbyx', false],
    ['/flow', false],
  ])('%s → %s', (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});
