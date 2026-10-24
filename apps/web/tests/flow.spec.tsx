import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ScreenFlowPage from '../app/flow/page';

function enterLobby() {
  fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), { target: { value: 'player1' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'demo-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('XQA-61 screen flow prototype', () => {
  it('navigates from login through lobby, waiting room, and game', () => {
    render(<ScreenFlowPage />);

    enterLobby();
    expect(screen.getByRole('heading', { name: 'Chào buổi chiều, Nhân!' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tạo phòng/ }));
    expect(screen.getByRole('heading', { name: 'Sẵn sàng cho ván đấu?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ván đấu' }));
    expect(screen.getByRole('heading', { name: 'Ván đấu đang diễn ra' })).toBeInTheDocument();
    expect(screen.getByText(/trò chuyện phòng đấu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📷 Bật Camera' })).toBeInTheDocument();
  });

  it.each([
    ['Chọn AI', 'Chọn đối thủ AI'],
    ['Lịch sử', 'Lịch sử thi đấu'],
    ['Admin', 'Tổng quan'],
    ['Report', 'Gửi báo cáo'],
  ])('opens the %s screen', (screenName, heading) => {
    render(<ScreenFlowPage />);
    enterLobby();
    fireEvent.click(screen.getByRole('button', { name: screenName }));

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('submits a report and shows its confirmation state', () => {
    render(<ScreenFlowPage />);
    enterLobby();
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    fireEvent.change(screen.getByLabelText('Loại vi phạm'), { target: { value: 'Gian lận' } });
    fireEvent.change(screen.getByLabelText('Người dùng hoặc phòng liên quan'), { target: { value: 'MinhKhai' } });
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'Hành vi bất thường trong ván đấu.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    expect(screen.getByRole('status')).toHaveTextContent('Đã ghi nhận báo cáo');
  });

  it('resigns from the game and shows the end-of-game dialog', () => {
    render(<ScreenFlowPage />);
    enterLobby();
    fireEvent.click(screen.getByRole('button', { name: 'Ván cờ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đầu hàng' }));

    expect(screen.getByRole('dialog', { name: 'Đen thắng' })).toHaveTextContent('Đỏ đầu hàng');
    fireEvent.click(screen.getByRole('button', { name: 'Về sảnh' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
