'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Position,
  RepetitionJudge,
  type AiLevel,
  type Move,
  type Piece,
  type Side,
} from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/board/Board';
import Modal from '@/components/common/Modal';
import { createAiClient, type AiClient } from '@/lib/ai/ai-client';
import { formatVietnameseMove } from '@/lib/ai/vietnamese-notation';
import AiLevelSelector, { AI_LEVEL_DESCRIPTIONS } from './AiLevelSelector';
import AiMoveList, { type MoveHistoryItem } from './AiMoveList';

export interface GameHistoryEntry {
  ply: number;
  move: Move;
  notation: string;
  side: Side;
}

export interface AiGameResult {
  winner: Side | null;
  reason: 'checkmate' | 'no_moves' | 'repetition' | 'resignation';
  rule?: string;
}

export interface PlayAiViewProps {
  initialLevel?: AiLevel;
  initialSide?: Side;
  aiClient?: AiClient;
}

export default function PlayAiView({
  initialLevel = 'MEDIUM',
  initialSide = 'r',
  aiClient: injectedAiClient,
}: PlayAiViewProps) {
  const [level, setLevel] = useState<AiLevel>(initialLevel);
  const [playerSide, setPlayerSide] = useState<Side>(initialSide);
  const [gameState, setGameState] = useState<'SELECTING' | 'PLAYING'>('SELECTING');

  const [position, setPosition] = useState<Position>(() => Position.initial());
  const [board, setBoard] = useState<(Piece | null)[]>(() => Position.initial().board);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);

  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gameResult, setGameResult] = useState<AiGameResult | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  // Client Web Worker
  const clientRef = useRef<AiClient | null>(null);
  // Repetition judge ref
  const judgeRef = useRef<RepetitionJudge>(new RepetitionJudge(Position.initial()));

  useEffect(() => {
    const client = injectedAiClient ?? createAiClient();
    clientRef.current = client;
    return () => {
      client.terminate();
    };
  }, [injectedAiClient]);

  const aiSide: Side = playerSide === 'r' ? 'b' : 'r';
  const isPlayerTurn = gameState === 'PLAYING' && !gameResult && position.sideToMove === playerSide;
  const isCheck = position.isCheck(position.sideToMove);

  // Khởi động ván cờ mới
  const handleStartGame = useCallback(
    (selectedLevel = level, selectedSide = playerSide) => {
      const initialPos = Position.initial();
      setPosition(initialPos);
      setBoard([...initialPos.board]);
      setSelectedSquare(null);
      setValidMoves([]);
      setLastMove(null);
      setHistory([]);
      setGameResult(null);
      setIsResultModalOpen(false);
      setConfirmResign(false);
      setConfirmNewGame(false);
      setGameState('PLAYING');

      const judge = new RepetitionJudge(initialPos);
      judgeRef.current = judge;

      // Nếu người chơi chọn Đen thì máy (Đỏ) đi trước
      if (selectedSide === 'b') {
        setIsAiThinking(true);
        const client = clientRef.current ?? injectedAiClient ?? createAiClient();
        clientRef.current = client;

        client
          .computeMove(initialPos.toFen(), selectedLevel)
          .then((aiMove) => {
            if (!aiMove) return;
            const posCopy = initialPos.clone();
            const notation = formatVietnameseMove(posCopy, aiMove);
            posCopy.applyMove(aiMove);
            judge.play(aiMove);

            setPosition(posCopy);
            setBoard([...posCopy.board]);
            setLastMove(aiMove);
            setHistory([
              {
                ply: 1,
                move: aiMove,
                notation,
                side: 'r',
              },
            ]);
            setIsAiThinking(false);
          })
          .catch(() => {
            setIsAiThinking(false);
          });
      } else {
        setIsAiThinking(false);
      }
    },
    [injectedAiClient, level, playerSide],
  );

  // Máy suy nghĩ và đi nước cờ
  const triggerAiTurn = useCallback(
    (currentPos: Position, currentHistory: GameHistoryEntry[]) => {
      if (!clientRef.current) return;
      setIsAiThinking(true);

      clientRef.current
        .computeMove(currentPos.toFen(), level)
        .then((move) => {
          setIsAiThinking(false);
          if (!move) {
            // Máy không tìm được nước đi (hết nước)
            const result: AiGameResult = {
              winner: playerSide,
              reason: 'no_moves',
            };
            setGameResult(result);
            setIsResultModalOpen(true);
            return;
          }

          if (!currentPos.isLegalMove(move)) {
            return;
          }

          const notation = formatVietnameseMove(currentPos, move);
          const nextPos = currentPos.clone();
          nextPos.applyMove(move);

          const verdict = judgeRef.current.play(move);
          const nextHistory: GameHistoryEntry[] = [
            ...currentHistory,
            {
              ply: currentHistory.length + 1,
              move,
              notation,
              side: aiSide,
            },
          ];

          setPosition(nextPos);
          setBoard([...nextPos.board]);
          setLastMove(move);
          setHistory(nextHistory);

          // Kiểm tra kết quả sau nước đi của máy
          if (verdict.repeated && verdict.result && verdict.result.kind !== 'undetermined') {
            if (verdict.result.kind === 'loss') {
              const res: AiGameResult = {
                winner: verdict.result.winner,
                reason: 'repetition',
                rule: verdict.result.rule,
              };
              setGameResult(res);
              setIsResultModalOpen(true);
              return;
            } else if (verdict.result.kind === 'draw') {
              const res: AiGameResult = {
                winner: null,
                reason: 'repetition',
                rule: verdict.result.rule,
              };
              setGameResult(res);
              setIsResultModalOpen(true);
              return;
            }
          }

          const status = nextPos.getGameStatus();
          if (status.result) {
            const res: AiGameResult = {
              winner: status.result.winner,
              reason: status.result.reason,
            };
            setGameResult(res);
            setIsResultModalOpen(true);
          }
        })
        .catch(() => {
          setIsAiThinking(false);
        });
    },
    [aiSide, level, playerSide],
  );

  // Xử lý khi người chơi click trên bàn cờ
  const handleSquareClick = (sq: number) => {
    // Không tới lượt hoặc máy đang nghĩ hoặc ván đã kết thúc: không làm gì
    if (!isPlayerTurn || isAiThinking || gameResult) return;

    const clickedPiece = position.board[sq];

    // 1. Nếu chưa chọn ô nào
    if (selectedSquare === null) {
      if (clickedPiece && clickedPiece.color === playerSide) {
        setSelectedSquare(sq);
        const legalDests = position.generatePieceMoves(sq).map((m) => m.to);
        setValidMoves(legalDests);
      }
      return;
    }

    // 2. Click lại chính ô đang chọn: bỏ chọn
    if (sq === selectedSquare) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    // 3. Click vào quân khác của phe mình: đổi quân được chọn
    if (clickedPiece && clickedPiece.color === playerSide) {
      setSelectedSquare(sq);
      const legalDests = position.generatePieceMoves(sq).map((m) => m.to);
      setValidMoves(legalDests);
      return;
    }

    // 4. Click ô đích: kiểm tra nước đi hợp lệ
    const move: Move = { from: selectedSquare, to: sq };
    if (!position.isLegalMove(move)) {
      return;
    }

    const notation = formatVietnameseMove(position, move);
    const nextPos = position.clone();
    nextPos.applyMove(move);

    const verdict = judgeRef.current.play(move);
    const nextHistory: GameHistoryEntry[] = [
      ...history,
      {
        ply: history.length + 1,
        move,
        notation,
        side: playerSide,
      },
    ];

    setPosition(nextPos);
    setBoard([...nextPos.board]);
    setLastMove(move);
    setSelectedSquare(null);
    setValidMoves([]);
    setHistory(nextHistory);

    // Kiểm tra kết quả sau nước đi của người chơi
    if (verdict.repeated && verdict.result && verdict.result.kind !== 'undetermined') {
      if (verdict.result.kind === 'loss') {
        const res: AiGameResult = {
          winner: verdict.result.winner,
          reason: 'repetition',
          rule: verdict.result.rule,
        };
        setGameResult(res);
        setIsResultModalOpen(true);
        return;
      } else if (verdict.result.kind === 'draw') {
        const res: AiGameResult = {
          winner: null,
          reason: 'repetition',
          rule: verdict.result.rule,
        };
        setGameResult(res);
        setIsResultModalOpen(true);
        return;
      }
    }

    const status = nextPos.getGameStatus();
    if (status.result) {
      const res: AiGameResult = {
        winner: status.result.winner,
        reason: status.result.reason,
      };
      setGameResult(res);
      setIsResultModalOpen(true);
      return;
    }

    // Nếu ván tiếp tục: chuyển lượt cho máy
    triggerAiTurn(nextPos, nextHistory);
  };

  // Đi lại (Undo 1 cặp nước của người + máy)
  const canUndo =
    gameState === 'PLAYING' &&
    !isAiThinking &&
    !gameResult &&
    history.length >= (playerSide === 'r' ? 2 : 2) &&
    position.sideToMove === playerSide;

  const handleUndo = () => {
    if (!canUndo) return;

    // Rút 2 nước gần nhất (1 nước của máy + 1 nước của người chơi)
    const nextHistory = history.slice(0, -2);

    // Tái thiết lập thế cờ từ đầu theo lịch sử còn lại
    const newPos = Position.initial();
    const newJudge = new RepetitionJudge(Position.initial());
    let newLastMove: { from: number; to: number } | null = null;

    for (const entry of nextHistory) {
      newPos.applyMove(entry.move);
      newJudge.play(entry.move);
      newLastMove = entry.move;
    }

    setPosition(newPos);
    setBoard([...newPos.board]);
    setLastMove(newLastMove);
    setSelectedSquare(null);
    setValidMoves([]);
    setHistory(nextHistory);
    judgeRef.current = newJudge;
  };

  // Xác nhận đầu hàng
  const handleConfirmResign = () => {
    setConfirmResign(false);
    const res: AiGameResult = {
      winner: aiSide,
      reason: 'resignation',
    };
    setGameResult(res);
    setIsResultModalOpen(true);
  };

  // Thông báo kết thúc ván
  const endMessage = () => {
    if (!gameResult) return '';
    const isDraw = gameResult.winner === null;
    const isPlayerWinner = gameResult.winner === playerSide;
    const title = isDraw ? 'Hòa' : isPlayerWinner ? 'Bạn đã thắng' : 'Máy đã thắng';

    let reasonStr = '';
    switch (gameResult.reason) {
      case 'checkmate':
        reasonStr = 'Chiếu bí';
        break;
      case 'no_moves':
        reasonStr = `${gameResult.winner === 'r' ? 'Đen' : 'Đỏ'} hết nước đi`;
        break;
      case 'repetition':
        reasonStr = gameResult.rule ? `Vi phạm ${gameResult.rule}` : 'Lặp nước theo Điều 23';
        break;
      case 'resignation':
        reasonStr = 'Người chơi đầu hàng';
        break;
    }
    return `${title} — ${reasonStr}.`;
  };

  const moveHistoryItems: MoveHistoryItem[] = history.map((h) => ({
    ply: h.ply,
    notation: h.notation,
    side: h.side,
  }));

  if (gameState === 'SELECTING') {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <AiLevelSelector
          level={level}
          onSelectLevel={setLevel}
          playerSide={playerSide}
          onSelectSide={setPlayerSide}
          onStartGame={() => handleStartGame(level, playerSide)}
        />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] max-w-6xl mx-auto px-3 py-4 sm:px-4 sm:py-6 flex flex-col gap-4">
      {/* Thanh thông tin trên cùng */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                position.sideToMove === 'r' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-400'
              }`}
            />
            <span className="text-sm sm:text-base font-bold text-slate-100">
              {gameResult
                ? 'Ván đấu đã kết thúc'
                : isPlayerTurn
                ? `Đến lượt bạn (${playerSide === 'r' ? 'Đỏ' : 'Đen'})`
                : `Đến lượt máy (${aiSide === 'r' ? 'Đỏ' : 'Đen'})`}
            </span>
          </div>

          {isCheck && !gameResult && (
            <span
              data-testid="in-check-badge"
              className="rounded-md border border-red-500/60 bg-red-950/80 px-2 py-0.5 text-xs font-extrabold tracking-wider text-red-300 animate-pulse"
            >
              CHIẾU
            </span>
          )}

          {isAiThinking && (
            <span
              data-testid="ai-thinking-indicator"
              className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300"
            >
              <svg
                className="h-3.5 w-3.5 animate-spin text-amber-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Máy đang nghĩ…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="rounded bg-slate-800 px-2 py-1 font-medium text-slate-300">
            Mức: {AI_LEVEL_DESCRIPTIONS[level].label}
          </span>
          <span className="rounded bg-slate-800 px-2 py-1 font-medium text-slate-300">
            Phe: {playerSide === 'r' ? 'Đỏ (Đi trước)' : 'Đen (Đi sau)'}
          </span>
        </div>
      </div>

      {/* Khu vực trung tâm: Bàn cờ và Bảng điều khiển */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Bàn cờ 2.5D */}
        <div className="lg:col-span-8 flex justify-center">
          <div className="w-full max-w-[560px]">
            <Board
              board={board}
              orientation={playerSide}
              selectedSquare={selectedSquare}
              lastMove={lastMove}
              validMoves={validMoves}
              onSquareClick={handleSquareClick}
              className="w-full drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Khung chức năng bên phải */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Danh sách nước đã đi */}
          <AiMoveList moves={moveHistoryItems} />

          {/* Các nút thao tác */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400/60 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶ Đi lại
            </button>

            <button
              type="button"
              disabled={isAiThinking}
              onClick={() => setConfirmNewGame(true)}
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400/60 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ván mới
            </button>

            <button
              type="button"
              disabled={isAiThinking || !!gameResult}
              onClick={() => setConfirmResign(true)}
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-rose-500/40 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🏳️ Đầu hàng
            </button>
          </div>
        </div>
      </div>

      {/* Modal xác nhận đầu hàng */}
      <Modal
        isOpen={confirmResign}
        title="Đầu hàng?"
        message="Bạn chắc chắn muốn đầu hàng? Máy sẽ được xử thắng và không thể hoàn tác."
        confirmText="Đầu hàng"
        cancelText="Chơi tiếp"
        onConfirm={handleConfirmResign}
        onCancel={() => setConfirmResign(false)}
      />

      {/* Modal xác nhận ván mới */}
      <Modal
        isOpen={confirmNewGame}
        title="Bắt đầu ván mới?"
        message="Ván đấu hiện tại sẽ kết thúc và quay lại màn hình chọn mức độ khó."
        confirmText="Đồng ý"
        cancelText="Ở lại"
        onConfirm={() => {
          setConfirmNewGame(false);
          setGameState('SELECTING');
        }}
        onCancel={() => setConfirmNewGame(false)}
      />

      {/* Modal kết thúc ván đấu */}
      <Modal
        isOpen={isResultModalOpen && gameResult !== null}
        title="Ván đấu kết thúc"
        message={endMessage()}
        confirmText="Ván mới"
        cancelText="Xem bàn cờ"
        onConfirm={() => {
          setIsResultModalOpen(false);
          setGameState('SELECTING');
        }}
        onCancel={() => {
          setIsResultModalOpen(false);
        }}
      />
    </main>
  );
}
