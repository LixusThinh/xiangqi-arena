import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PlayerCard from '../components/PlayerCard';

describe('<PlayerCard />', () => {
  it('renders player name, title, side badge, and formatted time', () => {
    render(
      <PlayerCard
        name="Kỳ Vương Đối Thủ"
        title="Đại Kiện Tướng"
        side="b"
        timeRemaining={45}
        isActive={true}
        isLocalPlayer={false}
      />
    );

    expect(screen.getByText('Kỳ Vương Đối Thủ')).toBeInTheDocument();
    expect(screen.getByText('Đại Kiện Tướng')).toBeInTheDocument();
    expect(screen.getByText('Phe Đen')).toBeInTheDocument();
    expect(screen.getByText('00:45')).toBeInTheDocument();
  });

  it('renders camera toggle button for local player', () => {
    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={60}
        isActive={false}
        isLocalPlayer={true}
      />
    );

    expect(screen.getByText(/Camera/i)).toBeInTheDocument();
  });

  it('highlights timer with red styling when time is 10 seconds or less', () => {
    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={8}
        isActive={true}
        isLocalPlayer={true}
      />
    );

    const timer = screen.getByText('00:08');
    expect(timer.className).toMatch(/text-red-400|text-red-500/);
  });

  it('displays timeout state when time is 0', () => {
    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={0}
        isActive={true}
        isLocalPlayer={true}
      />
    );

    expect(screen.getByText('Hết giờ!')).toBeInTheDocument();
  });

  it('disables camera toggle button during acquisition and updates on success', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const mockTrack = { stop: jest.fn() };
    const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream;

    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: jest.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveStream = resolve;
            })
        ),
      },
    });

    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={60}
        isActive={false}
        isLocalPlayer={true}
      />
    );

    const button = screen.getByRole('button', { name: /Bật Camera/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByText(/Đang kết nối/i)).toBeInTheDocument();

    await act(async () => {
      resolveStream(mockStream);
    });

    expect(screen.getByText(/Tắt Camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Tắt Camera/i)).not.toBeDisabled();
  });

  it('stops media tracks immediately if unmounted before getUserMedia resolves', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const mockTrack = { stop: jest.fn() };
    const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream;

    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: jest.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveStream = resolve;
            })
        ),
      },
    });

    const { unmount } = render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={60}
        isActive={false}
        isLocalPlayer={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Bật Camera/i }));

    unmount();

    await act(async () => {
      resolveStream(mockStream);
    });

    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
