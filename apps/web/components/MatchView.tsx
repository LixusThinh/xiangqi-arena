'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { algebraicToSquare, Position, squareToAlgebraic } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/Board';
import Modal from '@/components/Modal';
import { AuthApiError, getStoredSession } from '@/lib/auth-api';
import {
  connectGame,
  END_REASON_LABELS,
  GAME_ERROR_MESSAGES,
  GameSocketError,
  type ConnectGame,
  type GameConnection,
  type GameEnd,
  type GameState,
} from '@/lib/game-socket';
import { ROOM_ERROR_MESSAGES, roomApi, type RoomDetail, type RoomMember } from '@/lib/room-api';
import { getAccessToken } from '@/lib/session';

/**
 * Màn ván cờ khi phòng đủ 2 người.
 * - XQA-71: vào ván, xoay bàn cờ theo màu của người đang xem.
 * - XQA-76: đi quân online qua socket (docs/api/socket.md). Bàn cờ CHỈ đổi theo state server gửi về:
 *   nước bị từ chối thì bàn cờ giữ nguyên + báo lỗi; nước của đối thủ tới qua game:update.
 * - XQA-92: nút Xin hòa / Xin thua. Xin thua có bước xác nhận; đề nghị hòa của đối thủ hiện popup
 *   Đồng ý / Từ chối. Popup dựa vào state.drawOffer của server nên reload trang vẫn thấy.
 */
export default function MatchView({
  code,
  connect = connectGame,
}: {
  code: string;
  /** Cho test thay kết nối thật bằng bản giả. */
  connect?: ConnectGame;
}) {
  const router = useRouter();
  const [myId] = useState(() => getStoredSession()?.user.id ?? null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [ended, setEnded] = useState<GameEnd | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const connRef = useRef<GameConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    roomApi
      .get(code)
      .then((detail) => {
        if (cancelled) return;
        const isMember = detail.members.some((m) => m.id === myId);
        // Chưa đủ người hoặc không phải người chơi của phòng → quay lại màn Phòng chờ
        if (detail.status === 'WAITING' || !isMember) {
          router.replace(`/room/${encodeURIComponent(detail.code)}`);
          return;
        }
        setRoom(detail);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof AuthApiError
            ? (ROOM_ERROR_MESSAGES[err.code] ?? err.message)
            : 'Không tải được ván cờ.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [code, myId, router]);

  // Kết nối socket sau khi biết chắc mình là người chơi của phòng.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let conn: GameConnection | null = null;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        setError(GAME_ERROR_MESSAGES.AUTH_SESSION_REVOKED);
        return;
      }
      conn = connect(token);
      connRef.current = conn;
      conn.onUpdate((state) => {
        setGame(state);
        setSelected(null);
      });
      conn.onEnd(setEnded);
      conn.onDrawRejected(() => setNotice('Đối thủ đã từ chối đề nghị hòa.'));
      conn.onConnectionChange(setConnected);
      const state = await conn.join(room.code);
      if (!cancelled) setGame(state);
    })().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof GameSocketError ? (GAME_ERROR_MESSAGES[err.code] ?? err.message) : 'Không kết nối được ván đấu.');
    });
    return () => {
      cancelled = true;
      conn?.close();
      connRef.current = null;
    };
  }, [room, connect]);

  const position = useMemo(() => (game ? Position.fromFen(game.fen) : Position.initial()), [game]);
  const myTurn =
    !!game && game.status === 'ACTIVE' && game.turn !== null && game.turn === game.yourColor && !pending;
  const mySide = game?.yourColor === 'BLACK' ? 'b' : 'r';

  const validMoves = useMemo(() => {
    if (selected === null || !myTurn) return [];
    return position
      .generateLegalMoves()
      .filter((m) => m.from === selected)
      .map((m) => m.to);
  }, [position, selected, myTurn]);

  const sendMove = useCallback(
    async (from: number, to: number) => {
      const conn = connRef.current;
      if (!conn || !game) return;
      setPending(true);
      setNotice(null);
      try {
        const state = await conn.move({
          matchId: game.matchId,
          from: squareToAlgebraic(from),
          to: squareToAlgebraic(to),
          expectedPly: game.ply,
        });
        setGame(state);
      } catch (err) {
        const codeOf = err instanceof GameSocketError ? err.code : 'SOCKET_TIMEOUT';
        setNotice(GAME_ERROR_MESSAGES[codeOf] ?? (err as Error).message);
        // Thế cờ ở máy đã cũ (hoặc socket rớt phòng) → lấy lại state chuẩn từ server
        if (codeOf === 'GAME_STALE_STATE' || codeOf === 'GAME_NOT_JOINED') {
          conn.join(game.roomCode).then(setGame, () => undefined);
        }
      } finally {
        setPending(false);
        setSelected(null);
      }
    },
    [game],
  );

  /** Xin thua / xin hòa: giống đi quân, chỉ đổi màn hình theo state server trả về. */
  const runAction = useCallback(
    async (action: (conn: GameConnection, matchId: string) => Promise<GameState>) => {
      const conn = connRef.current;
      if (!conn || !game) return;
      setPending(true);
      setNotice(null);
      try {
        setGame(await action(conn, game.matchId));
      } catch (err) {
        const codeOf = err instanceof GameSocketError ? err.code : 'SOCKET_TIMEOUT';
        setNotice(GAME_ERROR_MESSAGES[codeOf] ?? (err as Error).message);
        // State ở máy đã cũ (đề nghị hết hạn, ván đã xong, socket rớt phòng) → lấy lại từ server
        if (codeOf !== 'SOCKET_TIMEOUT') {
          conn.join(game.roomCode).then(setGame, () => undefined);
        }
      } finally {
        setPending(false);
      }
    },
    [game],
  );

  const handleSquareClick = (sq: number) => {
    if (!myTurn) return;
    const piece = position.board[sq];
    if (selected === null || sq === selected) {
      setSelected(sq === selected ? null : piece && piece.color === mySide ? sq : null);
      return;
    }
    if (piece && piece.color === mySide) {
      setSelected(sq);
      return;
    }
    if (!validMoves.includes(sq)) {
      // Kiểm ở máy chỉ để báo nhanh; server vẫn là bên quyết định (BR-03)
      setNotice(GAME_ERROR_MESSAGES.GAME_ILLEGAL_MOVE);
      setSelected(null);
      return;
    }
    void sendMove(selected, sq);
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <p role="alert" className="text-rose-200">{error}</p>
        <Link href="/lobby" className="text-sm text-amber-300 underline">Về Sảnh</Link>
      </main>
    );
  }
  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Đang vào ván…
      </main>
    );
  }

  const me = room.members.find((m) => m.id === myId) ?? null;
  const opponent = room.members.find((m) => m.id !== myId) ?? null;
  const orientation = (game?.yourColor ?? me?.color) === 'BLACK' ? 'b' : 'r';
  const lastMove = game?.lastMove
    ? { from: algebraicToSquare(game.lastMove.from), to: algebraicToSquare(game.lastMove.to) }
    : null;
  const endInfo = ended ?? (game && game.status !== 'ACTIVE' && game.status !== 'WAITING' ? game : null);
  const active = game?.status === 'ACTIVE' && endInfo === null;
  const offer = active ? (game?.drawOffer ?? null) : null;
  const myOffer = offer !== null && offer.by === game?.yourColor;
  const incomingOffer = offer !== null && !myOffer;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
        <header className="text-center">
          <h1 className="text-xl font-extrabold text-amber-300">{room.name}</h1>
          <p className="text-xs text-slate-400">Phòng {room.code}</p>
        </header>
        {!connected && (
          <p role="alert" className="w-full max-w-[560px] rounded-lg bg-amber-900/60 px-3 py-2 text-center text-sm text-amber-100">
            Mất kết nối máy chủ, đang thử kết nối lại…
          </p>
        )}
        <PlayerBadge member={opponent} />
        <Board
          position={position}
          orientation={orientation}
          selectedSquare={selected}
          validMoves={validMoves}
          lastMove={lastMove}
          onSquareClick={handleSquareClick}
          className="w-full max-w-[560px]"
        />
        <PlayerBadge member={me} isMe />
        <p role="status" className="text-sm text-slate-300">
          {statusText(game, me)}
          {me?.color ? ` · Bạn cầm quân ${me.color === 'RED' ? 'Đỏ' : 'Đen'}` : ''}
        </p>
        {notice && (
          <p data-testid="move-notice" className="text-sm text-rose-300">
            {notice}
          </p>
        )}
        {active && (
          <div className="flex w-full max-w-[560px] items-center justify-end gap-2">
            {myOffer && (
              <span data-testid="draw-offer-sent" className="mr-auto text-xs text-slate-400">
                Đã gửi đề nghị hòa, chờ đối thủ trả lời…
              </span>
            )}
            <button
              type="button"
              disabled={pending || offer !== null}
              onClick={() => void runAction((conn, id) => conn.offerDraw(id))}
              className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🤝 Xin hòa
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmResign(true)}
              className="rounded-lg border border-red-800/50 bg-red-950/60 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🏳️ Xin thua
            </button>
          </div>
        )}
      </div>
      <Modal
        isOpen={active && confirmResign}
        title="Xin thua?"
        message="Bạn chắc chắn muốn xin thua? Đối thủ sẽ được xử thắng và không thể hoàn tác."
        confirmText="Xin thua"
        cancelText="Chơi tiếp"
        onConfirm={() => {
          setConfirmResign(false);
          void runAction((conn, id) => conn.resign(id));
        }}
        onCancel={() => setConfirmResign(false)}
      />
      <Modal
        isOpen={incomingOffer && !confirmResign && !pending}
        title="Đối thủ đề nghị hòa"
        message="Đồng ý thì ván kết thúc với kết quả Hòa. Từ chối thì ván tiếp tục."
        confirmText="Đồng ý hòa"
        cancelText="Từ chối"
        onConfirm={() => void runAction((conn, id) => conn.answerDraw(id, true))}
        onCancel={() => void runAction((conn, id) => conn.answerDraw(id, false))}
      />
      <Modal
        isOpen={endInfo !== null}
        title="Ván đấu kết thúc"
        message={endInfo ? endMessage(endInfo) : ''}
        confirmText="Về Sảnh"
        onConfirm={() => router.push('/lobby')}
      />
    </main>
  );
}

function statusText(game: GameState | null, me: RoomMember | null): string {
  if (!game) return 'Đang kết nối ván…';
  if (game.status !== 'ACTIVE') return 'Ván đấu đã kết thúc';
  const turnName = game.turn === 'RED' ? 'Đỏ' : 'Đen';
  const check = game.inCheck ? ' · CHIẾU!' : '';
  return game.turn === (game.yourColor ?? me?.color) ? `Đến lượt bạn (${turnName})${check}` : `Đến lượt đối thủ (${turnName})${check}`;
}

function endMessage(end: Pick<GameEnd, 'result' | 'endReason' | 'endRule'>): string {
  const who =
    end.result === 'RED_WIN' ? 'Đỏ thắng' : end.result === 'BLACK_WIN' ? 'Đen thắng' : end.result === 'DRAW' ? 'Hòa' : 'Ván kết thúc';
  const reason = end.endReason ? (END_REASON_LABELS[end.endReason] ?? end.endReason) : null;
  return [who, reason, end.endRule].filter(Boolean).join(' — ') + '.';
}

function PlayerBadge({ member, isMe = false }: { member: RoomMember | null; isMe?: boolean }) {
  if (!member) return null;
  const colorLabel = member.color === 'RED' ? 'Đỏ' : member.color === 'BLACK' ? 'Đen' : '—';
  return (
    <div
      data-testid={isMe ? 'player-me' : 'player-opponent'}
      className={`flex w-full max-w-[560px] items-center justify-between rounded-xl px-4 py-2 ${
        member.color === 'RED' ? 'bg-rose-900/40' : 'bg-slate-800/80'
      }`}
    >
      <span className="font-semibold">
        {member.displayName}
        {isMe ? ' (bạn)' : ''}
      </span>
      <span className="text-sm text-slate-300">Quân {colorLabel} · Elo {member.rating}</span>
    </div>
  );
}
