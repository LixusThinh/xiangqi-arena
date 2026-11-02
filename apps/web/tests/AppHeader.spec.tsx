import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import AppHeader, { hidesAppHeader } from '@/components/layout/AppHeader';
import HomePage from '../app/page';
import { saveSession } from '@/lib/auth-api';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

const user = {
  id: '42',
  username: 'player1',
  email: 'player1@example.com',
  displayName: 'Kỳ Thủ Một',
  role: 'PLAYER' as const,
  rating: 1200,
  createdAt: '2026-10-21T08:00:00.000Z',
};

function signIn() {
  saveSession(
    { accessToken: 'a', expiresIn: 900, refreshToken: 'r', refreshExpiresIn: 604800 },
    user,
  );
}

describe('<AppHeader /> – điều hướng chung', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname = '/';
  });

  it('có đủ các trang chính và tô trang hiện tại', () => {
    mockPathname = '/history';
    render(<AppHeader />);
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(nav).toHaveTextContent('Trang chủ');
    expect(nav).toHaveTextContent('Sảnh');
    expect(nav).toHaveTextContent('Chơi thử');
    expect(screen.getByRole('link', { name: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Sảnh' })).not.toHaveAttribute('aria-current');
  });

  it('phòng chờ được tính là thuộc mục Sảnh', () => {
    mockPathname = '/room/K7MPQ2XA';
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Sảnh' })).toHaveAttribute('aria-current', 'page');
  });

  it('chưa đăng nhập → nút Đăng nhập / Đăng ký; đã đăng nhập → tên + Đăng xuất', () => {
    const { unmount } = render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('href', '/register');
    unmount();
    signIn();
    render(<AppHeader />);
    expect(screen.getByText('Kỳ Thủ Một')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it.each([
    ['/login', true],
    ['/register', true],
    ['/room/ABC/play', true],
    ['/practice', true],
    ['/room/ABC', false],
    ['/lobby', false],
    ['/', false],
  ])('hidesAppHeader(%s) = %s', (path, hidden) => {
    expect(hidesAppHeader(path)).toBe(hidden);
  });
});

describe('Trang chủ', () => {
  beforeEach(() => window.localStorage.clear());

  it('giới thiệu sản phẩm, chưa đăng nhập thì mời tạo tài khoản và có lối vào Chơi thử', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Đấu cờ tướng');
    expect(screen.getByRole('link', { name: 'Tạo tài khoản' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /Chơi thử 2 người 1 máy/ })).toHaveAttribute('href', '/practice');
    expect(screen.getByText('Đồng hồ do máy chủ tính')).toBeInTheDocument();
    expect(screen.getByText('Gọi video trong ván')).toBeInTheDocument();
  });

  it('đã đăng nhập → nút chính dẫn vào Sảnh', () => {
    signIn();
    render(<HomePage />);
    act(() => undefined);
    expect(screen.getByRole('link', { name: 'Vào Sảnh chơi online' })).toHaveAttribute('href', '/lobby');
  });
});
