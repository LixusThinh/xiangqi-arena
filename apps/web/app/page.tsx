'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Position, Side, Piece, MoveUndo } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/Board';
import PlayerCard from '@/components/PlayerCard';
import MatchControls from '@/components/MatchControls';
import ChatBox, { ChatMessage } from '@/components/ChatBox';
import Modal, { ModalProps } from '@/components/Modal';
import GameStatusPanel, { GameResult } from '@/components/GameStatusPanel';

interface UndoRecord {
  undo: MoveUndo;
  prevLastMove: { from: number; to: number } | null;
}

type MockScenarioId =
  | 'live'
  | 'red-turn'
  | 'black-in-check'
  | 'red-wins-checkmate'
  | 'black-wins-red-no-moves';

interface PanelGameState {
  sideToMove: Side | null;
  isCheck: boolean;
  result: GameResult | null;
}

// Dữ liệu giả cho XQA-50 (4 trạng thái theo AC). 'live' = lấy lượt từ bàn cờ thật;
// XQA-51 sẽ thay phần này bằng trạng thái do engine (XQA-49) trả về.
const MOCK_GAME_STATES: Record<Exclude<MockScenarioId, 'live'>, PanelGameState> = {
  'red-turn': { sideToMove: 'r', isCheck: false, result: null },
  'black-in-check': { sideToMove: 'b', isCheck: true, result: null },
  'red-wins-checkmate': {
    sideToMove: null,
    isCheck: false,
    result: { winner: 'r', reason: 'checkmate' },
  },
  'black-wins-red-no-moves': {
    sideToMove: null,
    isCheck: false,
    result: { winner: 'b', reason: 'no-legal-moves' },
  },
};

export interface ArenaPageProps {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[] | undefined> & { fen?: string };
}

export default function ArenaPage({ searchParams }: ArenaPageProps) {
  const initialFen = typeof searchParams?.fen === 'string' ? searchParams.fen : undefined;
  const [position, setPosition] = useState<Position>(() =>
    initialFen ? Position.fromFen(initialFen) : Position.initial()
  );
  const [board, setBoard] = useState<(Piece | null)[]>(() =>
    initialFen ? Position.fromFen(initialFen).board : Position.initial().board
  );
  const [undoHistory, setUndoHistory] = useState<UndoRecord[]>([]);
  const [playerSide, setPlayerSide] = useState<Side>('r');
  const [sideToMove, setSideToMove] = useState<Side>(() =>
    initialFen ? Position.fromFen(initialFen).sideToMove : 'r'
  );
  const [mockScenario, setMockScenario] = useState<MockScenarioId>('live');
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);
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

  const updateValidMovesForPiece = (sq: number | null) => {
    if (sq === null) {
      setValidMoves([]);
      return;
    }
    const moves = position.generatePieceMoves(sq);
    setValidMoves(moves.map((m) => m.to));
  };

  // Click-to-move logic
  const handleSquareClick = (sq: number) => {
    const clickedPiece = board[sq];

    // 1. If no piece selected: selecting any square with a piece of the active side selects it
    if (selectedSquare === null) {
      if (clickedPiece && clickedPiece.color === sideToMove) {
        setSelectedSquare(sq);
        updateValidMovesForPiece(sq);
      }
      return;
    }

    const currentPiece = board[selectedSquare];
    if (!currentPiece) {
      if (clickedPiece && clickedPiece.color === sideToMove) {
        setSelectedSquare(sq);
        updateValidMovesForPiece(sq);
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    // 2. Re-clicking the selected piece: deselects it
    if (sq === selectedSquare) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    // 3. Clicking another friendly piece: switches selection without moving
    if (clickedPiece && clickedPiece.color === currentPiece.color) {
      setSelectedSquare(sq);
      updateValidMovesForPiece(sq);
      return;
    }

    // 4. Clicking destination square: validate legal move
    const move = { from: selectedSquare, to: sq };
    if (!position.isLegalMove(move)) {
      // Invalid move according to piece movement rules: ignore
      return;
    }

    const undoInfo = position.applyMove(move);
    setUndoHistory((prev) => [...prev, { undo: undoInfo, prevLastMove: lastMove }]);
    setBoard([...position.board]);
    setLastMove(move);
    setSelectedSquare(null);
    setValidMoves([]);

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
    setValidMoves([]);

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
    setMockScenario('live');
    setSelectedSquare(null);
    setValidMoves([]);
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
  // Panel chỉ nhận dữ liệu từ ngoài (XQA-50 AC3). 'live' lấy lượt từ bàn cờ thật;
  // chiếu / kết thúc ván chờ engine XQA-49, tới XQA-51 sẽ thay bằng trạng thái engine.
  const panelState: PanelGameState =
    mockScenario === 'live'
      ? { sideToMove, isCheck: false, result: null }
      : MOCK_GAME_STATES[mockScenario];

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

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="mr-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Đăng nhập
          </Link>
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Lượt: <span className="font-bold text-amber-300">{sideToMove === 'r' ? 'Đỏ (Đi trước)' : 'Đen'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-400">Đang trực tuyến</span>
          </div>
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
          <GameStatusPanel
            sideToMove={panelState.sideToMove}
            isCheck={panelState.isCheck}
            result={panelState.result}
            onNewGame={handleConfirmNewGame}
          />
          <label className="flex w-full max-w-[560px] flex-col gap-1 text-[11px] font-medium text-slate-400">
            Tình huống dữ liệu giả
            <select
              aria-label="Tình huống dữ liệu giả"
              value={mockScenario}
              onChange={(event) => {
                setModalConfig((prev) => ({ ...prev, isOpen: false }));
                setMockScenario(event.target.value as MockScenarioId);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="live">Theo bàn cờ thật</option>
              <option value="red-turn">Đỏ tới lượt, không bị chiếu</option>
              <option value="black-in-check">Đen tới lượt, đang bị chiếu</option>
              <option value="red-wins-checkmate">Đỏ thắng do chiếu bí</option>
              <option value="black-wins-red-no-moves">Đen thắng do Đỏ hết nước đi</option>
            </select>
          </label>
          <Board
            board={board}
            orientation={playerSide}
            selectedSquare={selectedSquare}
            lastMove={lastMove}
            validMoves={validMoves}
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
