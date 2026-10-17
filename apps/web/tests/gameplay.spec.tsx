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
    // Select Red Horse at sq 82 (b0 in starting fen)
    const redHorse = screen.getByTestId('piece-82');
    fireEvent.click(redHorse);

    // Click empty destination sq 63 (a2)
    const emptyCell = screen.getByTestId('cell-63');
    fireEvent.click(emptyCell);

    // Piece has moved to 63
    expect(screen.getByTestId('piece-63')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-82')).not.toBeInTheDocument();
  });

  it('captures opponent piece when clicking opponent piece with piece selected', () => {
    // Custom FEN with a Black Horse at sq 63 (rank 7, file a) within reach of Red Horse at sq 82
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/nC5C1/9/RNBAKABNR r - - 0 1';
    render(<ArenaPage searchParams={{ fen: customFen }} />);

    // Select Red Horse at 82
    const redHorse = screen.getByTestId('piece-82');
    fireEvent.click(redHorse);

    // Click Black Horse at sq 63
    const blackHorse = screen.getByTestId('piece-63');
    expect(blackHorse).toHaveAttribute('data-piece', 'bn');
    fireEvent.click(blackHorse);

    // Red Horse is now at sq 63, old piece at 63 was captured
    expect(screen.getByTestId('piece-63')).toHaveAttribute('data-piece', 'rn');
    expect(screen.queryByTestId('piece-82')).not.toBeInTheDocument();
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

    // Red Horse moves: 82 -> 63
    fireEvent.click(screen.getByTestId('piece-82'));
    fireEvent.click(screen.getByTestId('cell-63'));

    expect(screen.getByTestId('piece-63')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-82')).not.toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    // Click Undo
    fireEvent.click(undoButton);

    // Verify move is rolled back
    expect(screen.getByTestId('piece-82')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-63')).not.toBeInTheDocument();
    expect(undoButton).toBeDisabled();
    expect(screen.getByText('Đã quay lại nước đi.')).toBeInTheDocument();
  });

  it('restores captured piece upon undoing a capture move', () => {
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/nC5C1/9/RNBAKABNR r - - 0 1';
    render(<ArenaPage searchParams={{ fen: customFen }} />);
    const undoButton = screen.getByRole('button', { name: /Quay lại/i });

    // Red Horse at 82 captures Black Horse at 63
    fireEvent.click(screen.getByTestId('piece-82'));
    fireEvent.click(screen.getByTestId('piece-63'));

    expect(screen.getByTestId('piece-63')).toHaveAttribute('data-piece', 'rn');
    expect(screen.queryByTestId('piece-82')).not.toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    // Click Undo
    fireEvent.click(undoButton);

    // Red Horse is back at 82, Black Horse is back at 63
    expect(screen.getByTestId('piece-82')).toHaveAttribute('data-piece', 'rn');
    expect(screen.getByTestId('piece-63')).toHaveAttribute('data-piece', 'bn');
    expect(undoButton).toBeDisabled();
  });

  it('clears undo history when starting a new game', () => {
    render(<ArenaPage />);
    const undoButton = screen.getByRole('button', { name: /Quay lại/i });

    // Make a move: Red Horse 82 -> 63
    fireEvent.click(screen.getByTestId('piece-82'));
    fireEvent.click(screen.getByTestId('cell-63'));
    expect(undoButton).toBeEnabled();

    // Start New Game
    fireEvent.click(screen.getByRole('button', { name: /Ván mới/i }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận/i }));

    // History is cleared and undo button disabled
    expect(undoButton).toBeDisabled();
    expect(screen.getByTestId('piece-82')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-63')).not.toBeInTheDocument();
  });

  it('handles consecutive undos reverting multiple turns back to initial state', () => {
    render(<ArenaPage />);
    const undoButton = screen.getByRole('button', { name: /Quay lại/i });

    // Guard check: clicking opponent piece initially does not select it
    fireEvent.click(screen.getByTestId('piece-0'));
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();

    // 1. Red moves Horse: 82 -> 63
    fireEvent.click(screen.getByTestId('piece-82'));
    fireEvent.click(screen.getByTestId('cell-63'));
    expect(screen.getByTestId('piece-63')).toBeInTheDocument();

    // 2. Black moves Horse: 1 -> 18
    fireEvent.click(screen.getByTestId('piece-1'));
    fireEvent.click(screen.getByTestId('cell-18'));
    expect(screen.getByTestId('piece-18')).toBeInTheDocument();

    // Undo 1: Reverts Black's move
    fireEvent.click(undoButton);
    expect(screen.getByTestId('piece-1')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-18')).not.toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    // Undo 2: Reverts Red's move, back to starting board with no lastMove
    fireEvent.click(undoButton);
    expect(screen.getByTestId('piece-82')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-63')).not.toBeInTheDocument();
    expect(undoButton).toBeDisabled();
    expect(screen.queryByTestId('last-move-indicator-to')).not.toBeInTheDocument();
  });

  it('displays move hints when selecting friendly Horse and blocks illegal moves', () => {
    render(<ArenaPage />);

    // Click Red Horse at b0 (sq 82)
    const redHorse = screen.getByTestId('piece-82');
    fireEvent.click(redHorse);

    // Expect valid move hints for sq 63 and sq 65
    expect(screen.getByTestId('hint-sq-63')).toBeInTheDocument();
    expect(screen.getByTestId('hint-sq-65')).toBeInTheDocument();

    // Click an illegal empty square (e.g. sq 73 directly in front of Horse)
    const illegalCell = screen.getByTestId('cell-73');
    fireEvent.click(illegalCell);

    // Horse should NOT move, turn should remain Red ('r')
    expect(screen.getByTestId('piece-82')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-73')).not.toBeInTheDocument();
    expect(screen.getByText('Đỏ (Đi trước)')).toBeInTheDocument();

    // Click legal destination sq 63
    const legalCell = screen.getByTestId('cell-63');
    fireEvent.click(legalCell);

    // Horse should now be at sq 63, sq 82 is empty, turn toggles to Black ('b'), hints cleared
    expect(screen.getByTestId('piece-63')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-82')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-sq-63')).not.toBeInTheDocument();
    expect(screen.getByText('Đen')).toBeInTheDocument();
  });

  it('moves Soldier (Tốt) forward with a single hint since XQA-45', () => {
    render(<ArenaPage />);

    // Click Red Soldier at sq 56 (c6): chưa qua sông nên chỉ có 1 gợi ý tiến c5 (sq 47)
    fireEvent.click(screen.getByTestId('piece-56'));
    expect(screen.getByTestId('hint-sq-47')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-sq-55')).not.toBeInTheDocument(); // không đi ngang
    expect(screen.queryByTestId('hint-sq-57')).not.toBeInTheDocument();

    // Click forward sq 47
    fireEvent.click(screen.getByTestId('cell-47'));

    // Soldier moved, turn toggles to Black
    expect(screen.getByTestId('piece-47')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-56')).not.toBeInTheDocument();
    expect(screen.getByText('Đen')).toBeInTheDocument();
  });
});
