'use client';

import React, { useState, useEffect } from 'react';
import { Position, Side, Piece, MoveUndo } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/Board';
import PlayerCard from '@/components/PlayerCard';
import MatchControls from '@/components/MatchControls';
import ChatBox, { ChatMessage } from '@/components/ChatBox';
import Modal, { ModalProps } from '@/components/Modal';

interface UndoRecord {
  undo: MoveUndo;
  prevLastMove: { from: number; to: number } | null;
}

export default function ArenaPage() {
  const [position, setPosition] = useState<Position>(() => Position.initial());
  const [board, setBoard] = useState<(Piece | null)[]>(() => Position.initial().board);
  const [undoHistory, setUndoHistory] = useState<UndoRecord[]>([]);
  const [playerSide, setPlayerSide] = useState<Side>('r');
  const [sideToMove, setSideToMove] = useState<Side>('r');
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);

  const [redTimer, setRedTimer] = useState<number>(60);
  const [blackTimer, setBlackTimer] = useState<number>(60);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'system',
      senderName: 'Hệ thống',
      text: 'Chào mừng kỳ thủ đến với phòng thi đấu!',
      time: '12:00',
    },
  ]);

  const [modalConfig, setModalConfig] = useState<ModalProps>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Turn timer countdown (60s turn timer for active sideToMove)
  useEffect(() => {
    const activeTimer = sideToMove === 'r' ? redTimer : blackTimer;
    if (activeTimer <= 0) return;

    const timer = setInterval(() => {
      if (sideToMove === 'r') {
        setRedTimer((prev) => (prev > 0 ? prev - 1 : 0));
      } else {
        setBlackTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sideToMove, redTimer, blackTimer]);

  // Click-to-move logic
  const handleSquareClick = (sq: number) => {
    const clickedPiece = board[sq];

    // 1. If no piece selected: selecting any square with a piece of the active side selects it
    if (selectedSquare === null) {
      if (clickedPiece && clickedPiece.color === sideToMove) {
        setSelectedSquare(sq);
      }
      return;
    }

    const currentPiece = board[selectedSquare];
    if (!currentPiece) {
      if (clickedPiece && clickedPiece.color === sideToMove) {
        setSelectedSquare(sq);
      } else {
        setSelectedSquare(null);
      }
      return;
    }

    // 2. Re-clicking the selected piece: deselects it
    if (sq === selectedSquare) {
      setSelectedSquare(null);
      return;
    }

    // 3. Clicking another friendly piece: switches selection without moving
    if (clickedPiece && clickedPiece.color === currentPiece.color) {
      setSelectedSquare(sq);
      return;
    }

    // 4. Clicking empty square or opponent piece: moves/captures, updates lastMove, toggles turn
    const move = { from: selectedSquare, to: sq };
    const undoInfo = position.applyMove(move);
    setUndoHistory((prev) => [...prev, { undo: undoInfo, prevLastMove: lastMove }]);
    setBoard([...position.board]);
    setLastMove(move);
    setSelectedSquare(null);

    const nextSide = position.sideToMove;
    setSideToMove(nextSide);
    if (nextSide === 'r') {
      setRedTimer(60);
    } else {
      setBlackTimer(60);
    }
  };

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      sender: 'you',
      senderName: 'Bạn',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleUndoMove = () => {
    if (undoHistory.length === 0) return;

    const nextHistory = [...undoHistory];
    const lastRecord = nextHistory.pop()!;
    position.undoMove(lastRecord.undo);

    setUndoHistory(nextHistory);
    setBoard([...position.board]);
    setSideToMove(position.sideToMove);
    setLastMove(lastRecord.prevLastMove);
    setSelectedSquare(null);

    if (position.sideToMove === 'r') {
      setRedTimer(60);
    } else {
      setBlackTimer(60);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        sender: 'system',
        senderName: 'Hệ thống',
        text: 'Đã quay lại nước đi.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleConfirmNewGame = () => {
    const newPos = Position.initial();
    setPosition(newPos);
    setBoard([...newPos.board]);
    setSideToMove('r');
    setSelectedSquare(null);
    setLastMove(null);
    setRedTimer(60);
    setBlackTimer(60);
    setUndoHistory([]);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        sender: 'system',
        senderName: 'Hệ thống',
        text: 'Ván cờ mới đã bắt đầu! Đỏ đi trước.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const handleOpenNewGame = () => {
    setModalConfig({
      isOpen: true,
      title: 'Bắt đầu ván mới',
      message: 'Bạn có chắc chắn muốn cài lại trạng thái bàn cờ từ đầu không?',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      isNotice: false,
      onConfirm: handleConfirmNewGame,
      onCancel: () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleOpenOfferDraw = () => {
    setModalConfig({
      isOpen: true,
      title: 'Cầu hòa',
      message: 'Bạn đã gửi yêu cầu xin hòa đến đối thủ. Vui lòng chờ phản hồi.',
      isNotice: true,
      onConfirm: () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleOpenLeaveRoom = () => {
    setModalConfig({
      isOpen: true,
      title: 'Thoát phòng đấu',
      message: 'Bạn có chắc chắn muốn rời khỏi phòng đấu không?',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      isNotice: false,
      onConfirm: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            senderName: 'Hệ thống',
            text: 'Bạn đã thoát phòng đấu.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const opponentSide: Side = playerSide === 'r' ? 'b' : 'r';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-base shadow-sm">
            象棋
          </div>
          <div>
            <h1 className="text-base font-extrabold text-amber-400 tracking-tight">
              Xiangqi Arena — Phòng Đấu Cờ Tướng
            </h1>
            <p className="text-[11px] text-slate-400">
              Phòng #01 • Tiêu chuẩn 60s/lượt • Đấu trường trực tuyến
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-400">Đang trực tuyến</span>
        </div>
      </header>

      {/* 3-Column Arena Layout */}
      <div className="w-full max-w-[1520px] p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Player Cards */}
        <section className="lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1">
          {/* Đối thủ */}
          <PlayerCard
            name="Kỳ Vương Đối Thủ"
            title="Đại Sư • Elo 2150"
            side={opponentSide}
            timeRemaining={opponentSide === 'r' ? redTimer : blackTimer}
            isActive={sideToMove === opponentSide}
            isLocalPlayer={false}
          />

          {/* Người chơi */}
          <PlayerCard
            name="Bạn"
            title="Kiện Tướng • Elo 1980"
            side={playerSide}
            timeRemaining={playerSide === 'r' ? redTimer : blackTimer}
            isActive={sideToMove === playerSide}
            isLocalPlayer={true}
          />
        </section>

        {/* Center Column: Board and Match Controls */}
        <section className="lg:col-span-6 flex flex-col items-center gap-4 order-1 lg:order-2">
          <Board
            board={board}
            orientation={playerSide}
            selectedSquare={selectedSquare}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
          />

          <MatchControls
            playerSide={playerSide}
            onSelectSide={setPlayerSide}
            onNewGame={handleOpenNewGame}
            onOfferDraw={handleOpenOfferDraw}
            onLeaveRoom={handleOpenLeaveRoom}
            onUndoMove={handleUndoMove}
            canUndo={undoHistory.length > 0}
          />
        </section>

        {/* Right Column: Chat Box */}
        <section className="lg:col-span-3 flex flex-col h-[600px] order-3">
          <ChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            className="h-full"
          />
        </section>
      </div>

      {/* Confirmation & Notice Modal */}
      <Modal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        isNotice={modalConfig.isNotice}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </main>
  );
}
