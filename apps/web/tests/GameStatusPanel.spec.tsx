import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GameStatusPanel from '../components/GameStatusPanel';

describe('<GameStatusPanel />', () => {
  it('renders the turn and check warning directly from its props', () => {
    const { rerender } = render(
      <GameStatusPanel sideToMove="r" isCheck={false} result={null} onNewGame={jest.fn()} />
    );

    expect(screen.getByText('Đến lượt Đỏ')).toBeInTheDocument();
    expect(screen.queryByText('CHIẾU')).not.toBeInTheDocument();

    rerender(
      <GameStatusPanel sideToMove="b" isCheck={true} result={null} onNewGame={jest.fn()} />
    );

    expect(screen.getByText('Đến lượt Đen')).toBeInTheDocument();
    expect(screen.getByText('CHIẾU')).toBeInTheDocument();
  });

  it.each([
    [{ winner: 'r' as const, reason: 'checkmate' as const }, 'Đỏ thắng — Chiếu bí.'],
    [{ winner: 'b' as const, reason: 'no-legal-moves' as const }, 'Đen thắng — Đỏ hết nước đi.'],
    [{ winner: 'r' as const, reason: 'no-legal-moves' as const }, 'Đỏ thắng — Đen hết nước đi.'],
    [{ winner: 'b' as const, reason: 'checkmate' as const }, 'Đen thắng — Chiếu bí.'],
  ])('shows the winner and end reason with a new-game action', (result, message) => {
    const onNewGame = jest.fn();
    render(
      <GameStatusPanel sideToMove={null} isCheck={false} result={result} onNewGame={onNewGame} />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ván mới' }));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });
});
