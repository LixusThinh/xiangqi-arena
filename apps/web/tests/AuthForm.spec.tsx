import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthForm from '../components/AuthForm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('AuthForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('validates the minimum password length before submitting', async () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByText('Mật khẩu phải có ít nhất 8 ký tự.'),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the API 401 login error', async () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Tên đăng nhập/email hoặc mật khẩu không chính xác.');
  });

  it('shows the API 409 duplicate-account error', async () => {
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Another Player' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'another@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Tên đăng nhập hoặc email đã được đăng ký.');
  });

  it('navigates to Home after mock login succeeds', async () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), {
      target: { value: 'player1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'arena1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });
});
