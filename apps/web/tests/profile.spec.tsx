import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import ProfileView from '@/components/profile/ProfileView';
import * as profileApi from '@/lib/profile-api';
import * as authApi from '@/lib/auth-api';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/profile',
}));

describe('ProfileAvatar (FR-04)', () => {
  it('hiển thị chữ cái đầu khi không có avatarUrl', () => {
    render(<ProfileAvatar displayName="Alice Kỳ Thủ" username="alice" />);
    const avatar = screen.getByRole('img', { name: 'Ảnh đại diện của Alice Kỳ Thủ' });
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent('A');
  });

  it('lấy chữ cái đầu của username nếu displayName rỗng', () => {
    render(<ProfileAvatar displayName="" username="bob" />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('hiển thị thẻ img khi avatarUrl hợp lệ https://', () => {
    render(
      <ProfileAvatar
        displayName="Charlie"
        username="charlie"
        avatarUrl="https://example.com/avatar.jpg"
      />,
    );
    const img = screen.getByRole('img', { name: 'Ảnh đại diện của Charlie' });
    expect(img.tagName.toLowerCase()).toBe('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('fallback về chữ cái đầu khi ảnh bị lỗi (onError)', () => {
    render(
      <ProfileAvatar
        displayName="David"
        username="david"
        avatarUrl="https://example.com/broken.jpg"
      />,
    );
    const img = screen.getByRole('img', { name: 'Ảnh đại diện của David' });
    fireEvent.error(img);

    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('không dùng dangerouslySetInnerHTML và hiển thị ký tự nguy hiểm an toàn', () => {
    const maliciousName = '<script>alert("xss")</script>';
    render(<ProfileAvatar displayName={maliciousName} username="hacker" />);
    // Chữ cái đầu lấy ký tự đầu tiên '<'
    expect(screen.getByText('<')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});

describe('ProfileView (FR-04)', () => {
  const mockProfile: profileApi.UserProfileResponse = {
    username: 'kythuviet',
    displayName: 'Kỳ Thủ Việt Nam',
    avatarUrl: null,
    bio: 'Đam mê khai cuộc Pháo đầu đối Bình phong Mã.',
    rating: 1350,
    totalMatches: 42,
    wins: 25,
    losses: 12,
    draws: 5,
    winRate: 59.5,
    createdAt: '2026-05-15T10:00:00.000Z',
  };

  const mockSession: authApi.StoredSession = {
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600_000,
    refreshToken: 'test-refresh',
    refreshExpiresAt: Date.now() + 86400_000,
    user: {
      id: '1',
      username: 'kythuviet',
      displayName: 'Kỳ Thủ Việt Nam',
      email: 'kythuviet@example.com',
      role: 'PLAYER',
      rating: 1350,
      createdAt: '2026-05-15T10:00:00.000Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('hiển thị thông tin hồ sơ và thống kê chiến tích', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(mockSession);
    jest.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfile);

    render(<ProfileView />);

    expect(screen.getByText('Đang tải thông tin hồ sơ…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Kỳ Thủ Việt Nam')).toBeInTheDocument();
    });

    expect(screen.getByText('@kythuviet')).toBeInTheDocument();
    expect(screen.getByText('1350 ELO')).toBeInTheDocument();
    expect(screen.getByText('Đam mê khai cuộc Pháo đầu đối Bình phong Mã.')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('59.5%')).toBeInTheDocument();
  });

  it('báo lỗi khi không tìm thấy người chơi', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(null);
    jest.spyOn(profileApi, 'getProfile').mockRejectedValue(
      new authApi.AuthApiError('Không tìm thấy người chơi.', 404, 'USER_NOT_FOUND'),
    );

    render(<ProfileView username="nonexistent" />);

    await waitFor(() => {
      expect(screen.getByText("Không tìm thấy người chơi 'nonexistent'.")).toBeInTheDocument();
    });

    expect(screen.getByText('Không tìm thấy hồ sơ')).toBeInTheDocument();
  });

  it('cho phép chỉnh sửa hồ sơ khi xem hồ sơ của chính mình', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(mockSession);
    jest.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfile);
    const updateSpy = jest.spyOn(profileApi, 'updateProfile').mockResolvedValue({
      id: '1',
      username: 'kythuviet',
      displayName: 'Đại Sư Kỳ Thủ',
      bio: 'Tiểu sử mới cập nhật.',
      avatarUrl: 'https://example.com/avatar-new.jpg',
      rating: 1350,
      createdAt: '2026-05-15T10:00:00.000Z',
    });

    render(<ProfileView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));

    expect(screen.getByText('Chỉnh sửa thông tin cá nhân')).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Tên hiển thị/);
    const bioInput = screen.getByLabelText(/Giới thiệu bản thân/);
    const avatarInput = screen.getByLabelText(/Đường dẫn ảnh đại diện/);

    expect(nameInput).toHaveValue('Kỳ Thủ Việt Nam');
    expect(bioInput).toHaveValue('Đam mê khai cuộc Pháo đầu đối Bình phong Mã.');

    // Sửa thông tin
    fireEvent.change(nameInput, { target: { value: '  Đại Sư Kỳ Thủ  ' } });
    fireEvent.change(bioInput, { target: { value: 'Tiểu sử mới cập nhật.' } });
    fireEvent.change(avatarInput, { target: { value: 'https://example.com/avatar-new.jpg' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        displayName: 'Đại Sư Kỳ Thủ',
        bio: 'Tiểu sử mới cập nhật.',
        avatarUrl: 'https://example.com/avatar-new.jpg',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Đã cập nhật thông tin hồ sơ thành công!')).toBeInTheDocument();
      expect(screen.getByText('Đại Sư Kỳ Thủ')).toBeInTheDocument();
      expect(screen.getByText('Tiểu sử mới cập nhật.')).toBeInTheDocument();
    });
  });

  it('kiểm tra ràng buộc client-side khi sửa hồ sơ', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(mockSession);
    jest.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfile);

    render(<ProfileView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));

    const nameInput = screen.getByLabelText(/Tên hiển thị/);
    const avatarInput = screen.getByLabelText(/Đường dẫn ảnh đại diện/);

    // 1. Tên chỉ toàn khoảng trắng
    fireEvent.change(nameInput, { target: { value: '    ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByText(/Tên hiển thị phải từ 1 đến 80 ký tự/)).toBeInTheDocument();

    // 2. Avatar không có https://
    fireEvent.change(nameInput, { target: { value: 'Tên Hợp Lệ' } });
    fireEvent.change(avatarInput, { target: { value: 'http://insecure.com/pic.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByText(/Đường dẫn ảnh đại diện phải bắt đầu bằng https:\/\//)).toBeInTheDocument();
  });

  it('không hiển thị nút Chỉnh sửa hồ sơ khi xem hồ sơ người khác', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(mockSession);
    jest.spyOn(profileApi, 'getProfile').mockResolvedValue({
      ...mockProfile,
      username: 'otheruser',
      displayName: 'Kỳ Thủ Khác',
    });

    render(<ProfileView username="otheruser" />);

    await waitFor(() => {
      expect(screen.getByText('Kỳ Thủ Khác')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Chỉnh sửa hồ sơ' })).toBeNull();
  });

  it('render bio có mã html độc hại dạng văn bản thuần túy (escape an toàn)', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(mockSession);
    jest.spyOn(profileApi, 'getProfile').mockResolvedValue({
      ...mockProfile,
      bio: '<b id="evil-tag">Đậm</b><img src=x onerror=alert(1)>',
    });

    render(<ProfileView />);

    await waitFor(() => {
      expect(screen.getByText('<b id="evil-tag">Đậm</b><img src=x onerror=alert(1)>')).toBeInTheDocument();
    });

    // Không render thành element thật trong DOM
    expect(document.getElementById('evil-tag')).toBeNull();
  });
});
