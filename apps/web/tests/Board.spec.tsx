import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Board from '../components/board/Board';
import { FEN_PRESETS } from '../components/board/fen-presets';
import { Position, STARTING_FEN } from '@xiangqi-arena/xiangqi-core';

describe('<Board />', () => {
  it('renders starting FEN with exactly 32 pieces', () => {
    render(<Board fen={STARTING_FEN} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });

  it('renders directly with a raw board array prop', () => {
    const initialBoard = Position.fromFen().board;
    render(<Board board={initialBoard} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });

  it('renders a custom board array prop correctly', () => {
    const customBoard = new Array(90).fill(null);
    customBoard[0] = { color: 'r', type: 'r' };
    render(<Board board={customBoard} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(1);
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

    // Đỏ ở dưới: Tướng Đỏ ở hàng hiển thị 9 (gần), Tướng Đen ở hàng 0 (xa)
    expect(redKingR).toHaveAttribute('data-row', '9');
    expect(blackKingR).toHaveAttribute('data-row', '0');

    // Flip to Black perspective
    rerender(<Board fen={STARTING_FEN} orientation="b" />);
    const redKingB = screen.getByTestId('piece-85');
    const blackKingB = screen.getByTestId('piece-4');

    expect(redKingB).toHaveAttribute('data-row', '0');
    expect(blackKingB).toHaveAttribute('data-row', '9');
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
    expect(mask.tagName.toLowerCase()).toBe('polygon');
    // Ô e0 (Tướng Đỏ) nằm giữa mép dưới: tâm tứ giác có x = 0 trong hệ toạ độ chiếu
    const xs = (mask.getAttribute('points') ?? '').split(' ').map((pt) => Number(pt.split(',')[0]));
    expect(xs).toHaveLength(4);
    expect(xs.reduce((a, b) => a + b, 0) / 4).toBeCloseTo(0, 1);
  });

  it('renders lastMove highlight masks for origin and destination', () => {
    render(<Board fen={STARTING_FEN} lastMove={{ from: 70, to: 43 }} />);
    const fromMask = screen.getByTestId('last-move-from');
    const toMask = screen.getByTestId('last-move-to');

    expect(fromMask).toBeInTheDocument();
    expect(toMask).toBeInTheDocument();
    expect(fromMask.getAttribute('points')).not.toBe(toMask.getAttribute('points'));
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

  it('draws pieces far-to-near so nearer pieces overlap farther ones', () => {
    render(<Board fen={STARTING_FEN} />);
    const rows = screen.getAllByTestId(/^piece-/).map((el) => Number(el.getAttribute('data-row')));
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
  });

  it('marks the selected piece so it is lifted, and slides the piece that just moved', () => {
    render(<Board fen={STARTING_FEN} selectedSquare={85} lastMove={{ from: 70, to: 85 }} onSquareClick={() => {}} />);
    const king = screen.getByTestId('piece-85');
    expect(king).toHaveClass('xq-piece--selected');
    expect(king.querySelector('.xq-arrive')).not.toBeNull();
    expect(screen.getByTestId('piece-4').querySelector('.xq-arrive')).toBeNull();
  });

  it('shows Chinese glyphs and Vietnamese labels on pieces', () => {
    render(<Board fen={STARTING_FEN} />);
    expect(screen.getByTestId('piece-85')).toHaveTextContent('帥');
    expect(screen.getByTestId('piece-4')).toHaveTextContent('將');
    expect(screen.getByTestId('piece-85')).toHaveAttribute('aria-label', 'Tướng Đỏ');
  });

  it('renders move hints when validMoves prop is provided', () => {
    // Square 63 is empty, square 67 is occupied by enemy piece in custom FEN
    const customFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2n4/9/RNBAKAB1R r - - 4 10';
    render(
      <Board
        fen={customFen}
        selectedSquare={82}
        validMoves={[63, 67]}
      />
    );

    const hint63 = screen.getByTestId('hint-sq-63');
    expect(hint63).toBeInTheDocument();
    expect(hint63.getAttribute('data-hint-type')).toBe('peaceful');

    const hint67 = screen.getByTestId('hint-sq-67');
    expect(hint67).toBeInTheDocument();
    expect(hint67.getAttribute('data-hint-type')).toBe('capture');
  });

  it('renders no move hints when validMoves is empty or not provided', () => {
    render(<Board selectedSquare={82} validMoves={[]} />);
    expect(screen.queryByTestId(/hint-sq-/)).not.toBeInTheDocument();
  });

  it('renders a valid-move dot for each square in validMoves', () => {
    render(<Board fen={STARTING_FEN} validMoves={[40, 49]} />);
    expect(screen.getByTestId('valid-move-40')).toBeInTheDocument();
    expect(screen.getByTestId('valid-move-49')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^valid-move-/)).toHaveLength(2);
  });

  it('renders no valid-move dots by default', () => {
    render(<Board fen={STARTING_FEN} />);
    expect(screen.queryAllByTestId(/^valid-move-/)).toHaveLength(0);
  });

  it('draws capture hints above pieces so capture targets stay visible', () => {
    const { container } = render(<Board fen={STARTING_FEN} validMoves={[0]} />);
    const nodes = Array.from(container.querySelectorAll('[data-testid]'));
    const dotIdx = nodes.findIndex((n) => n.getAttribute('data-testid') === 'valid-move-0');
    const pieceIdx = nodes.findIndex((n) => n.getAttribute('data-testid') === 'piece-0');
    expect(pieceIdx).toBeGreaterThanOrEqual(0);
    expect(dotIdx).toBeGreaterThan(pieceIdx);
  });
});

