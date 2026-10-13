import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
