'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  algebraicToSquare,
  Position,
  RepetitionJudge,
  squareToAlgebraic,
  type AiLevel,
  type Move,
  type Piece,
  type Side,
} from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/board/Board';
import Modal from '@/components/common/Modal';
import { createAiClient, type AiClient } from '@/lib/ai/ai-client';
import {
  createAiGame,
  deleteAiGame,
  getAiGame,
  listSavedAiGames,
  updateAiGame,
  type AiGameSummary,
} from '@/lib/ai-game-api';
import { formatVietnameseMove } from '@/lib/ai/vietnamese-notation';
import { getStoredSession, SESSION_CHANGED_EVENT } from '@/lib/auth-api';
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

function formatResult(res: AiGameResult | null, playerSide: Side): string | null {
  if (!res) return null;
  const outcome = res.winner === null ? 'DRAW' : res.winner === playerSide ? 'WIN' : 'LOSS';
  return `${outcome}:${res.reason}`;
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

  // Trạng thái đăng nhập & lưu ván
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedGames, setSavedGames] = useState<AiGameSummary[]>([]);
  const [loadingSavedGames, setLoadingSavedGames] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<AiGameSummary | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const activeGameIdRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setGameId = useCallback((id: string | null) => {
    activeGameIdRef.current = id;
  }, []);

  // Sync login status
  useEffect(() => {
    const sync = () => setIsLoggedIn(getStoredSession() !== null);
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, sync);
  }, []);

  // Tải danh sách ván đã lưu
  const loadSavedGames = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoadingSavedGames(true);
    try {
      const list = await listSavedAiGames('IN_PROGRESS');
      setSavedGames(list);
    } catch {
      // non-blocking
    } finally {
      setLoadingSavedGames(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (gameState === 'SELECTING' && isLoggedIn) {
      loadSavedGames();
    }
  }, [gameState, isLoggedIn, loadSavedGames]);

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

  // Tự động lưu ván
  const autoSave = useCallback(
    async (
      currentHistory: GameHistoryEntry[],
      status?: 'IN_PROGRESS' | 'FINISHED',
      result?: string | null,
    ) => {
      if (!isLoggedIn) return;
      try {
        let gId = activeGameIdRef.current;
        if (!gId) {
          const created = await createAiGame(level, playerSide);
          gId = created.id;
          setGameId(gId);
        }
        const moveDtos = currentHistory.map((h) => ({
          from: squareToAlgebraic(h.move.from),
          to: squareToAlgebraic(h.move.to),
        }));
        await updateAiGame(gId, {
          moves: moveDtos,
          status,
          result,
        });
        setSaveError(null);
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        setSaveStatus(`Đã lưu lúc ${hh}:${mm}`);
      } catch {
        setSaveError('Chưa lưu được, sẽ thử lại');
      }
    },
    [isLoggedIn, level, playerSide, setGameId],
  );

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
      setSaveStatus(null);
      setSaveError(null);
      setGameId(null);
      setGameState('PLAYING');

      const judge = new RepetitionJudge(initialPos);
      judgeRef.current = judge;

      // Nếu đã đăng nhập, tạo ván trên server ngay
      if (isLoggedIn) {
        createAiGame(selectedLevel, selectedSide)
          .then((game) => {
            setGameId(game.id);
          })
          .catch(() => {
            // không chặn ván
          });
      }

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

            const nextHist: GameHistoryEntry[] = [
              {
                ply: 1,
                move: aiMove,
                notation,
                side: 'r',
              },
            ];

            setPosition(posCopy);
            setBoard([...posCopy.board]);
            setLastMove(aiMove);
            setHistory(nextHist);
            setIsAiThinking(false);

            // Tự lưu sau khi máy đi xong
            autoSave(nextHist, 'IN_PROGRESS');
          })
          .catch(() => {
            setIsAiThinking(false);
          });
      } else {
        setIsAiThinking(false);
      }
    },
    [autoSave, injectedAiClient, isLoggedIn, level, playerSide, setGameId],
  );

  // Máy suy nghĩ và đi nước cờ
  const triggerAiTurn = useCallback(
    (
      currentPos: Position,
      currentHistory: GameHistoryEntry[],
      currentLevel = level,
      currentPlayerSide = playerSide,
    ) => {
      const client = clientRef.current ?? injectedAiClient ?? createAiClient();
      clientRef.current = client;
      setIsAiThinking(true);

      const currentAiSide: Side = currentPlayerSide === 'r' ? 'b' : 'r';

      client
        .computeMove(currentPos.toFen(), currentLevel)
        .then((move) => {
          setIsAiThinking(false);
          if (!move) {
            // Máy không tìm được nước đi (hết nước)
            const result: AiGameResult = {
              winner: currentPlayerSide,
              reason: 'no_moves',
            };
            setGameResult(result);
            setIsResultModalOpen(true);
            autoSave(currentHistory, 'FINISHED', formatResult(result, currentPlayerSide));
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
              side: currentAiSide,
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
              autoSave(nextHistory, 'FINISHED', formatResult(res, currentPlayerSide));
              return;
            } else if (verdict.result.kind === 'draw') {
              const res: AiGameResult = {
                winner: null,
                reason: 'repetition',
                rule: verdict.result.rule,
              };
              setGameResult(res);
              setIsResultModalOpen(true);
              autoSave(nextHistory, 'FINISHED', formatResult(res, currentPlayerSide));
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
            autoSave(nextHistory, 'FINISHED', formatResult(res, currentPlayerSide));
            return;
          }

          // Ván tiếp tục: tự lưu sau mỗi lượt của máy
          autoSave(nextHistory, 'IN_PROGRESS');
        })
        .catch(() => {
          setIsAiThinking(false);
        });
    },
    [autoSave, injectedAiClient, level, playerSide],
  );

  // Tiếp tục ván đã lưu
  const handleResumeGame = useCallback(
    async (gameSummary: AiGameSummary) => {
      try {
        const detail = await getAiGame(gameSummary.id);
        const newPos = Position.fromFen(detail.initialFen);
        const newJudge = new RepetitionJudge(Position.fromFen(detail.initialFen));
        let newLastMove: { from: number; to: number } | null = null;
        const reconstructedHistory: GameHistoryEntry[] = [];

        for (const m of detail.moves) {
          const move: Move = {
            from: algebraicToSquare(m.from),
            to: algebraicToSquare(m.to),
          };
          const notation = formatVietnameseMove(newPos, move);
          const side = newPos.sideToMove;
          newPos.applyMove(move);
          newJudge.play(move);
          newLastMove = move;
          reconstructedHistory.push({
            ply: reconstructedHistory.length + 1,
            move,
            notation,
            side,
          });
        }

        setLevel(detail.level);
        setPlayerSide(detail.playerColor);
        setGameId(detail.id);
        setPosition(newPos);
        setBoard([...newPos.board]);
        setLastMove(newLastMove);
        setSelectedSquare(null);
        setValidMoves([]);
        setHistory(reconstructedHistory);
        setGameResult(null);
        setIsResultModalOpen(false);
        setConfirmResign(false);
        setConfirmNewGame(false);
        setSaveStatus(null);
        setSaveError(null);
        judgeRef.current = newJudge;
        setGameState('PLAYING');

        // Nếu tới lượt máy thì cho máy đi luôn
        const aiColor: Side = detail.playerColor === 'r' ? 'b' : 'r';
        if (newPos.sideToMove === aiColor) {
          triggerAiTurn(newPos, reconstructedHistory, detail.level, detail.playerColor);
        }
      } catch {
        // lỗi tải ván
      }
    },
    [setGameId, triggerAiTurn],
  );

  // Xoá ván đã lưu
  const handleConfirmDelete = useCallback(async () => {
    if (!gameToDelete) return;
    try {
      await deleteAiGame(gameToDelete.id);
      setGameToDelete(null);
      await loadSavedGames();
    } catch {
      setGameToDelete(null);
    }
  }, [gameToDelete, loadSavedGames]);

  // Xử lý khi người chơi click trên bàn cờ
  const handleSquareClick = (sq: number) => {
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
        autoSave(nextHistory, 'FINISHED', formatResult(res, playerSide));
        return;
      } else if (verdict.result.kind === 'draw') {
        const res: AiGameResult = {
          winner: null,
          reason: 'repetition',
          rule: verdict.result.rule,
        };
        setGameResult(res);
        setIsResultModalOpen(true);
        autoSave(nextHistory, 'FINISHED', formatResult(res, playerSide));
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
      autoSave(nextHistory, 'FINISHED', formatResult(res, playerSide));
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
    history.length >= 2 &&
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

    // Tự lưu sau khi Đi lại
    autoSave(nextHistory, 'IN_PROGRESS');
  };

  // Lưu ván thủ công
  const handleManualSave = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    try {
      let gId = activeGameIdRef.current;
      if (!gId) {
        const created = await createAiGame(level, playerSide);
        gId = created.id;
        setGameId(gId);
      }
      const moveDtos = history.map((h) => ({
        from: squareToAlgebraic(h.move.from),
        to: squareToAlgebraic(h.move.to),
      }));
      await updateAiGame(gId, {
        moves: moveDtos,
        status: gameResult ? 'FINISHED' : 'IN_PROGRESS',
        result: gameResult ? formatResult(gameResult, playerSide) : null,
      });
      setSaveError(null);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setSaveStatus(`Đã lưu lúc ${hh}:${mm}`);
    } catch {
      setSaveError('Chưa lưu được, sẽ thử lại');
    }
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
    autoSave(history, 'FINISHED', formatResult(res, playerSide));
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
          isLoggedIn={isLoggedIn}
          savedGames={savedGames}
          loadingSavedGames={loadingSavedGames}
          onResumeGame={handleResumeGame}
          onDeleteGame={(g) => setGameToDelete(g)}
        />

        {/* Modal xác nhận xoá ván cờ đã lưu */}
        <Modal
          isOpen={gameToDelete !== null}
          title="Xoá ván đã lưu?"
          message="Bạn chắc chắn muốn xoá ván chơi này? Hành động này không thể hoàn tác."
          confirmText="Xoá"
          cancelText="Huỷ"
          onConfirm={handleConfirmDelete}
          onCancel={() => setGameToDelete(null)}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              onClick={handleManualSave}
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:border-amber-400/60 hover:text-amber-200"
            >
              💾 Lưu ván
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

          {/* Trạng thái lưu */}
          {(saveStatus || saveError) && (
            <div className="flex items-center justify-between text-xs px-2 py-1 rounded bg-slate-900/40 border border-slate-800">
              {saveStatus && (
                <span className="text-emerald-400 font-medium" data-testid="save-status">
                  {saveStatus}
                </span>
              )}
              {saveError && (
                <span className="text-amber-400 font-medium ml-auto" data-testid="save-error">
                  {saveError}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal nhắc đăng nhập để lưu ván */}
      {showLoginModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-100 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-amber-400">Đăng nhập để lưu ván</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Bạn cần đăng nhập để lưu ván cờ lên tài khoản và chơi tiếp sau trên mọi thiết bị.
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="flex min-h-[40px] items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-xs font-semibold text-slate-300 transition"
              >
                Đóng
              </button>
              <Link
                href="/login?next=%2Fplay-ai"
                onClick={() => setShowLoginModal(false)}
                className="flex min-h-[40px] items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition shadow-lg shadow-amber-500/20"
              >
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      )}

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
