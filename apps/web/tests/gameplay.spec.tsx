import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ArenaPage from '../app/page';

describe('Xiangqi Arena Game Room Page', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders 3-column layout with 2 player cards, board, and chat box', () => {
    render(<ArenaPage />);
    expect(screen.getByText(/Xiangqi Arena/i)).toBeInTheDocument();
    expect(screen.getByText(/Kỳ Vương Đối Thủ/i)).toBeInTheDocument();
    expect(screen.getByText(/Bạn/i)).toBeInTheDocument();
    expect(screen.getByText(/Trò chuyện phòng đấu/i)).toBeInTheDocument();
  });

  it('selects piece on click and deselects on clicking the same piece', () => {
    render(<ArenaPage />);
    // Initial Red King is at sq 85
    const redKing = screen.getByTestId('piece-85');
    fireEvent.click(redKing);

    // Selected mask is rendered
    expect(screen.getByTestId('selected-mask')).toBeInTheDocument();

    // Re-clicking deselects
    fireEvent.click(redKing);
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();
  });

  it('switches selection when clicking another friendly piece without moving', () => {
    render(<ArenaPage />);
    const redKing = screen.getByTestId('piece-85');
    const redAdvisor = screen.getByTestId('piece-84');

    fireEvent.click(redKing);
    expect(screen.getByTestId('selected-mask')).toHaveAttribute('y', '730');

    // Click friendly piece 84
    fireEvent.click(redAdvisor);
    expect(screen.getByTestId('selected-mask')).toHaveAttribute('x', expect.stringContaining('250'));
  });

  it('moves piece to empty square, updates lastMove, and switches turn', () => {
    render(<ArenaPage />);
    // Select Red Cannon at sq 64 (b2 in starting fen)
    const redCannon = screen.getByTestId('piece-64');
    fireEvent.click(redCannon);

    // Click empty destination sq 55 (b3)
    const emptyCell = screen.getByTestId('cell-55');
    fireEvent.click(emptyCell);

    // Piece has moved to 55
    expect(screen.getByTestId('piece-55')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-64')).not.toBeInTheDocument();
  });

  it('captures opponent piece when clicking opponent piece with piece selected', () => {
    render(<ArenaPage />);
    // Select Red Cannon at 64
    const redCannon = screen.getByTestId('piece-64');
    fireEvent.click(redCannon);

    // Free movement test: click Black Rook at sq 0
    const blackRook = screen.getByTestId('piece-0');
    fireEvent.click(blackRook);

    // Cannon is now at sq 0, old piece at 0 was captured
    expect(screen.getByTestId('piece-0')).toHaveAttribute('data-piece', 'rc');
  });

  it('toggles board perspective when side is selected', () => {
    render(<ArenaPage />);
    // Click Phe Đen
    fireEvent.click(screen.getByRole('button', { name: /Phe Đen/i }));

    // King coordinates are now inverted
    const redKing = screen.getByTestId('piece-85');
    expect(redKing).toHaveAttribute('y', '10');
  });

  it('counts down turn timer by 1s every 1000ms for active player', () => {
    render(<ArenaPage />);
    expect(screen.getAllByText('00:60').length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText('00:58')).toBeInTheDocument();
  });

  it('stops timer ticking when timer reaches 0', () => {
    render(<ArenaPage />);
    act(() => {
      jest.advanceTimersByTime(65000);
    });

    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('Hết giờ!')).toBeInTheDocument();
  });

  it('handles chat messages and quick chips', () => {
    render(<ArenaPage />);
    const quickChip = screen.getByRole('button', { name: 'Xin chào!' });
    fireEvent.click(quickChip);
    expect(screen.getAllByText('Xin chào!').length).toBeGreaterThanOrEqual(2);

    const input = screen.getByPlaceholderText('Nhập tin nhắn...');
    fireEvent.change(input, { target: { value: 'Chúc bạn may mắn' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText('Chúc bạn may mắn')).toBeInTheDocument();
  });

  it('handles modals for new game, offer draw, and leave room', () => {
    render(<ArenaPage />);

    // Offer Draw modal
    fireEvent.click(screen.getByRole('button', { name: /Xin hòa/i }));
    expect(screen.getByText(/Bạn đã gửi yêu cầu xin hòa/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }));
    expect(screen.queryByText(/Bạn đã gửi yêu cầu xin hòa/i)).not.toBeInTheDocument();

    // New Game modal
    fireEvent.click(screen.getByRole('button', { name: /Ván mới/i }));
    expect(screen.getByText(/Bắt đầu ván mới/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận/i }));
    expect(screen.queryByText(/Bắt đầu ván mới/i)).not.toBeInTheDocument();

    // Leave Room modal
    fireEvent.click(screen.getByRole('button', { name: /Thoát/i }));
    expect(screen.getByText(/Thoát phòng đấu/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hủy/i }));
    expect(screen.queryByText(/Thoát phòng đấu/i)).not.toBeInTheDocument();
  });

  it('enables undo button after a move, rolls back move on click, and restores previous state', () => {
    render(<ArenaPage />);
    const undoButton = screen.getByRole('button', { name: /Quay lại/i });
    expect(undoButton).toBeDisabled();

    // Red Cannon moves: 64 -> 55
    fireEvent.click(screen.getByTestId('piece-64'));
    fireEvent.click(screen.getByTestId('cell-55'));

    expect(screen.getByTestId('piece-55')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-64')).not.toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    // Click Undo
    fireEvent.click(undoButton);

    // Verify move is rolled back
    expect(screen.getByTestId('piece-64')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-55')).not.toBeInTheDocument();
    expect(undoButton).toBeDisabled();
    expect(screen.getByText('Đã quay lại nước đi.')).toBeInTheDocument();
  });

  it('restores captured piece upon undoing a capture move', () => {
    render(<ArenaPage />);
    const undoButton = screen.getByRole('button', { name: /Quay lại/i });

    // Red Cannon at 64 captures Black Rook at 0
    fireEvent.click(screen.getByTestId('piece-64'));
    fireEvent.click(screen.getByTestId('piece-0'));

    expect(screen.getByTestId('piece-0')).toHaveAttribute('data-piece', 'rc');
    expect(screen.queryByTestId('piece-64')).not.toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    // Click Undo
    fireEvent.click(undoButton);

    // Red Cannon is back at 64, Black Rook is back at 0
    expect(screen.getByTestId('piece-64')).toHaveAttribute('data-piece', 'rc');
    expect(screen.getByTestId('piece-0')).toHaveAttribute('data-piece', 'br');
    expect(undoButton).toBeDisabled();
  });

  it('clears undo history when starting a new game', () => {
    render(<ArenaPage />);
    const undoButton = screen.getByRole('button', { name: /Quay lại/i });

    // Make a move
    fireEvent.click(screen.getByTestId('piece-64'));
    fireEvent.click(screen.getByTestId('cell-55'));
    expect(undoButton).toBeEnabled();

    // Start New Game
    fireEvent.click(screen.getByRole('button', { name: /Ván mới/i }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận/i }));

    // History is cleared and undo button disabled
    expect(undoButton).toBeDisabled();
    expect(screen.getByTestId('piece-64')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-55')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-55')).not.toBeInTheDocument();
  });
});

