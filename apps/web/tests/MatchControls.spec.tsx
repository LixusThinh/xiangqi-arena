import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchControls from '../components/practice/MatchControls';

describe('<MatchControls />', () => {
  it('renders side selector buttons and action buttons', () => {
    render(
      <MatchControls
        playerSide="r"
        onSelectSide={jest.fn()}
        onNewGame={jest.fn()}
        onOfferDraw={jest.fn()}
        onLeaveRoom={jest.fn()}
      />
    );

    expect(screen.getByText(/Phe Đỏ/i)).toBeInTheDocument();
    expect(screen.getByText(/Phe Đen/i)).toBeInTheDocument();
    expect(screen.getByText(/Quay lại/i)).toBeInTheDocument();
    expect(screen.getByText(/Ván mới/i)).toBeInTheDocument();
    expect(screen.getByText(/Xin hòa/i)).toBeInTheDocument();
    expect(screen.getByText(/Thoát/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Phe Đỏ/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Phe Đen/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('triggers onSelectSide when side buttons are clicked', () => {
    const handleSelectSide = jest.fn();
    render(
      <MatchControls
        playerSide="r"
        onSelectSide={handleSelectSide}
        onNewGame={jest.fn()}
        onOfferDraw={jest.fn()}
        onLeaveRoom={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Phe Đen/i));
    expect(handleSelectSide).toHaveBeenCalledWith('b');

    fireEvent.click(screen.getByText(/Phe Đỏ/i));
    expect(handleSelectSide).toHaveBeenCalledWith('r');
  });

  it('triggers match action callbacks', () => {
    const handleNewGame = jest.fn();
    const handleOfferDraw = jest.fn();
    const handleLeaveRoom = jest.fn();

    render(
      <MatchControls
        playerSide="r"
        onSelectSide={jest.fn()}
        onNewGame={handleNewGame}
        onOfferDraw={handleOfferDraw}
        onLeaveRoom={handleLeaveRoom}
      />
    );

    fireEvent.click(screen.getByText(/Ván mới/i));
    expect(handleNewGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Xin hòa/i));
    expect(handleOfferDraw).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Thoát/i));
    expect(handleLeaveRoom).toHaveBeenCalledTimes(1);
  });

  it('renders disabled undo button when canUndo is false and does not trigger onUndoMove', () => {
    const handleUndoMove = jest.fn();
    render(
      <MatchControls
        playerSide="r"
        onSelectSide={jest.fn()}
        onNewGame={jest.fn()}
        onOfferDraw={jest.fn()}
        onLeaveRoom={jest.fn()}
        onUndoMove={handleUndoMove}
        canUndo={false}
      />
    );

    const undoButton = screen.getByRole('button', { name: /Quay lại/i });
    expect(undoButton).toBeInTheDocument();
    expect(undoButton).toBeDisabled();

    fireEvent.click(undoButton);
    expect(handleUndoMove).not.toHaveBeenCalled();
  });

  it('renders enabled undo button when canUndo is true and triggers onUndoMove', () => {
    const handleUndoMove = jest.fn();
    render(
      <MatchControls
        playerSide="r"
        onSelectSide={jest.fn()}
        onNewGame={jest.fn()}
        onOfferDraw={jest.fn()}
        onLeaveRoom={jest.fn()}
        onUndoMove={handleUndoMove}
        canUndo={true}
      />
    );

    const undoButton = screen.getByRole('button', { name: /Quay lại/i });
    expect(undoButton).toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    fireEvent.click(undoButton);
    expect(handleUndoMove).toHaveBeenCalledTimes(1);
  });
});

