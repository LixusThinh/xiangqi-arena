import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Board from '../components/Board';
import { FEN_PRESETS } from '../components/fen-presets';
import { Position, STARTING_FEN } from '@xiangqi-arena/xiangqi-core';

describe('<Board />', () => {
  it('renders starting FEN with exactly 32 pieces', () => {
    render(<Board fen={STARTING_FEN} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });

  it('renders correctly with a Position instance', () => {
    const pos = Position.fromFen(STARTING_FEN);
    render(<Board position={pos} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });

  it('renders all 3 midgame and endgame presets without throwing', () => {
    FEN_PRESETS.slice(1).forEach((preset) => {
      const { unmount } = render(<Board fen={preset.fen} />);
      const pieces = screen.getAllByTestId(/^piece-/);
      expect(pieces.length).toBeGreaterThan(0);
      expect(pieces.length).toBeLessThanOrEqual(32);
      unmount();
    });
  });

  it('correctly flips piece coordinates between Red and Black orientation', () => {
    // Red King is at sq 85 (e0), Black King is at sq 4 (e9)
    const { rerender } = render(<Board fen={STARTING_FEN} orientation="r" />);
    const redKingR = screen.getByTestId('piece-85');
    const blackKingR = screen.getByTestId('piece-4');

    expect(redKingR).toHaveAttribute('y', '730');
    expect(blackKingR).toHaveAttribute('y', '10');

    // Flip to Black perspective
    rerender(<Board fen={STARTING_FEN} orientation="b" />);
    const redKingB = screen.getByTestId('piece-85');
    const blackKingB = screen.getByTestId('piece-4');

    expect(redKingB).toHaveAttribute('y', '10');
    expect(blackKingB).toHaveAttribute('y', '730');
  });

  it('triggers onSquareClick callback when square is clicked', () => {
    const handleClick = jest.fn();
    render(<Board fen={STARTING_FEN} onSquareClick={handleClick} />);

    // Click on Red King (sq 85)
    const redKing = screen.getByTestId('piece-85');
    fireEvent.click(redKing);
    expect(handleClick).toHaveBeenCalledWith(85);

    // Click on empty square 40
    const cell40 = screen.getByTestId('cell-40');
    fireEvent.click(cell40);
    expect(handleClick).toHaveBeenCalledWith(40);
  });

  it('displays error banner when given an invalid FEN', () => {
    render(<Board fen="invalid-fen-string" />);
    expect(screen.getByText(/FEN không hợp lệ/i)).toBeInTheDocument();
  });

  it('renders selected-mask when valid selectedSquare is provided', () => {
    render(<Board fen={STARTING_FEN} selectedSquare={85} />);
    const mask = screen.getByTestId('selected-mask');
    expect(mask).toBeInTheDocument();
    expect(mask).toHaveAttribute('href', '/ChessImage/mask.png');
    expect(mask).toHaveAttribute('x', '330');
    expect(mask).toHaveAttribute('y', '730');
  });

  it('renders lastMove highlight masks for origin and destination', () => {
    render(<Board fen={STARTING_FEN} lastMove={{ from: 70, to: 43 }} />);
    const fromMask = screen.getByTestId('last-move-from');
    const toMask = screen.getByTestId('last-move-to');

    expect(fromMask).toBeInTheDocument();
    expect(fromMask).toHaveAttribute('href', '/ChessImage/mask2.png');
    expect(toMask).toBeInTheDocument();
    expect(toMask).toHaveAttribute('href', '/ChessImage/mask2.png');
  });

  it('does not crash and does not render mask when selectedSquare is out of bounds', () => {
    const { rerender } = render(<Board fen={STARTING_FEN} selectedSquare={-1} />);
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();

    rerender(<Board fen={STARTING_FEN} selectedSquare={90} />);
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();

    rerender(<Board fen={STARTING_FEN} selectedSquare={99} />);
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();
  });

  it('does not crash and does not render lastMove masks when squares are invalid or out of bounds', () => {
    const { rerender } = render(
      <Board fen={STARTING_FEN} lastMove={{ from: -1, to: 43 }} />,
    );
    expect(screen.queryByTestId('last-move-from')).not.toBeInTheDocument();
    expect(screen.queryByTestId('last-move-to')).not.toBeInTheDocument();

    rerender(<Board fen={STARTING_FEN} lastMove={{ from: 70, to: 99 }} />);
    expect(screen.queryByTestId('last-move-from')).not.toBeInTheDocument();
    expect(screen.queryByTestId('last-move-to')).not.toBeInTheDocument();
  });

  it('applies SVG transform-box:fill-box and origin-center to piece elements', () => {
    render(<Board fen={STARTING_FEN} />);
    const piece = screen.getByTestId('piece-85');
    expect(piece).toHaveClass('[transform-box:fill-box]');
    expect(piece).toHaveClass('origin-center');
  });
});
