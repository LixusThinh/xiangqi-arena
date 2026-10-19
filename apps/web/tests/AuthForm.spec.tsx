import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthForm from '../components/AuthForm';
import {
  ACCESS_TOKEN_KEY,
  CURRENT_USER_KEY,
  EXPIRES_AT_KEY,
  getStoredSession,
} from '../lib/auth-api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const user = {
  id: '42',
  username: 'player1',
  email: 'player1@example.com',
  displayName: 'Player One',
  role: 'PLAYER',
  rating: 1200,
  createdAt: '2026-10-12T10:00:00.000Z',
};
const session = {
  accessToken: 'real-access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user,
};
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('AuthForm', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    localStorage.clear();
    mockPush.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
  });

  it('shows the API 401 error without leaving the login page', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse(
        {
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Username/email or password is incorrect',
        },
        401,
      ),
    );
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('shows the API 409 duplicate username/email error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse(
        {
          statusCode: 409,
          code: 'AUTH_IDENTIFIER_TAKEN',
          message: 'Username or email is already registered',
        },
        409,
      ),
    );
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'New Player' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'new_player' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên đăng nhập hoặc email này đã được sử dụng.',
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('registers with the backend, verifies /me, and navigates home', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(mockResponse(session, 201))
      .mockResolvedValueOnce(mockResponse(user));
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Player One' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'player1@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/auth/register',
    );
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(session.accessToken);
  });

  it('stores the token, verifies /me, and navigates home after login', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(mockResponse(session))
      .mockResolvedValueOnce(mockResponse(user));
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(session.accessToken);
    expect(JSON.parse(localStorage.getItem(CURRENT_USER_KEY) ?? 'null')).toEqual(
      user,
    );
    expect(Number(localStorage.getItem(EXPIRES_AT_KEY))).toBeGreaterThan(Date.now());
    const [, meRequest] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toBe(
      'http://localhost:3000/auth/me',
    );
    expect(new Headers(meRequest?.headers).get('Authorization')).toBe(
      `Bearer ${session.accessToken}`,
    );
  });

  it('does not keep a token when /me rejects it', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(session))
      .mockResolvedValueOnce(
        mockResponse({ statusCode: 401, code: 'AUTH_TOKEN_INVALID', message: 'x' }, 401),
      );
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiên đăng nhập không hợp lệ',
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('shows a Vietnamese message when the backend is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không kết nối được với máy chủ',
    );
  });

  it('marks fields rejected by backend validation (400 details)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse(
        {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'email', message: 'email must be an email' }],
        },
        400,
      ),
    );
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'P' } });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'player1' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Thông tin chưa hợp lệ');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks submit when password is shorter than 8 characters (XQA-53 AC1)', () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Mật khẩu phải có ít nhất 8 ký tự.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('getStoredSession', () => {
  beforeEach(() => localStorage.clear());

  it('returns null and clears storage when the session has expired', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token');
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() - 1));

    expect(getStoredSession()).toBeNull();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('returns the session while it is still valid', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token');
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + 60_000));

    expect(getStoredSession()?.user.username).toBe('player1');
  });
});
