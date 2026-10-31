/**
 * XQA-107: layout UI video call (dữ liệu giả). AC1 theo wireframe, AC2 không che bàn cờ ở 1366×768
 * (AC2 kiểm bằng ảnh chụp Playwright – xem mô tả PR; jsdom không tính layout).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import VideoCallPanel, { type VideoCallPanelProps } from '../components/VideoCallPanel';

function setup(overrides: Partial<VideoCallPanelProps> = {}) {
  const props: VideoCallPanelProps = {
    opponentName: 'Kỳ Vương',
    selfName: 'Nhân Nguyễn',
    status: 'connected',
    micOn: true,
    camOn: true,
    onToggleMic: jest.fn(),
    onToggleCam: jest.fn(),
    onEndCall: jest.fn(),
    onStartCall: jest.fn(),
    ...overrides,
  };
  render(<VideoCallPanel {...props} />);
  return props;
}

describe('<VideoCallPanel /> (XQA-107)', () => {
  it('2 khung video: đối thủ + mình; chưa có stream thì hiện chữ viết tắt tên', () => {
    setup();
    expect(screen.getByTestId('video-opponent')).toHaveTextContent('Kỳ Vương');
    expect(screen.getByTestId('video-opponent')).toHaveTextContent('KV');
    expect(screen.getByTestId('video-self')).toHaveTextContent('NN');
    expect(screen.getByTestId('call-status')).toHaveTextContent('Đang trò chuyện');
  });

  it('nút mic / cam / kết thúc gọi đúng callback', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tắt mic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tắt camera' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    expect(props.onToggleMic).toHaveBeenCalledTimes(1);
    expect(props.onToggleCam).toHaveBeenCalledTimes(1);
    expect(props.onEndCall).toHaveBeenCalledTimes(1);
  });

  it('mic / cam đang tắt → nút đổi nhãn, khung của mình ghi "tắt cam"', () => {
    setup({ micOn: false, camOn: false });
    expect(screen.getByRole('button', { name: 'Bật mic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bật camera' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('video-self')).toHaveTextContent('tắt cam');
  });

  it('chưa gọi / đã kết thúc → nút Gọi, mic/cam bị khóa', () => {
    const props = setup({ status: 'ended' });
    expect(screen.getByTestId('call-status')).toHaveTextContent('Cuộc gọi đã kết thúc');
    expect(screen.getByRole('button', { name: 'Tắt mic' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Gọi' }));
    expect(props.onStartCall).toHaveBeenCalledTimes(1);
  });

  it('không dùng fixed / absolute ra ngoài khung (khung nằm trong cột, không đè bàn cờ)', () => {
    setup();
    const panel = screen.getByRole('region', { name: 'Gọi video' });
    expect(panel.className).not.toMatch(/\bfixed\b/);
    expect(panel.className).not.toMatch(/\babsolute\b/);
  });
  it('XQA-124: cuộc gọi đến → nút Nhận / Từ chối gọi đúng callback, ẩn nút mic/cam', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    setup({ status: 'incoming', onAccept, onDecline });
    expect(screen.getByTestId('call-status')).toHaveTextContent('Đối thủ đang gọi');
    expect(screen.queryByRole('button', { name: 'Tắt mic' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nhận cuộc gọi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('XQA-124: đang kết nối vẫn kết thúc được; có lỗi thì hiện thông báo', () => {
    const props = setup({ status: 'connecting', error: 'Đối thủ đã từ chối cuộc gọi.' });
    expect(screen.getByTestId('call-status')).toHaveTextContent('Đang kết nối…');
    expect(screen.getByRole('alert')).toHaveTextContent('Đối thủ đã từ chối cuộc gọi.');
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    expect(props.onEndCall).toHaveBeenCalledTimes(1);
  });
});
