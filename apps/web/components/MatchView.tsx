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
  type PlayerColor,
} from '@/lib/game-socket';
import VideoCallPanel from '@/components/VideoCallPanel';
import { formatClock, useDisplayClock, type ClockSnapshot } from '@/lib/game-clock';
import { useVideoCall } from '@/lib/use-video-call';
import { ROOM_ERROR_MESSAGES, roomApi, type RoomDetail, type RoomMember } from '@/lib/room-api';
import { getAccessToken } from '@/lib/session';

/**
 * Màn ván cờ khi phòng đủ 2 người.
 * - XQA-71: vào ván, xoay bàn cờ theo màu của người đang xem.
 * - XQA-76: đi quân online qua socket (docs/api/socket.md). Bàn cờ CHỈ đổi theo state server gửi về:
 *   nước bị từ chối thì bàn cờ giữ nguyên + báo lỗi; nước của đối thủ tới qua game:update.
 * - XQA-92: nút Xin hòa / Xin thua. Xin thua có bước xác nhận; đề nghị hòa của đối thủ hiện popup
 *   Đồng ý / Từ chối. Popup dựa vào state.drawOffer của server nên reload trang vẫn thấy.
 * - XQA-94: reload / rớt mạng → tự vào lại ván (connectGame join lại khi socket nối lại); đối thủ mất kết nối
 *   → banner đếm ngược tới hạn chờ của server (state.disconnected, player:disconnected / player:reconnected).
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
  const [now, setNow] = useState(() => Date.now());
  const connRef = useRef<GameConnection | null>(null);
  // Bản state của kết nối để hook video call đăng ký nhận tín hiệu khi kết nối sẵn sàng
  const [connection, setConnection] = useState<GameConnection | null>(null);

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
      setConnection(conn);
      conn.onUpdate((state) => {
        setGame(state);
        setSelected(null);
      });
      conn.onEnd(setEnded);
      conn.onDrawRejected(() => setNotice('Đối thủ đã từ chối đề nghị hòa.'));
      conn.onPlayerDisconnected(({ color, deadline }) =>
        setGame((g) =>
          g ? { ...g, disconnected: [...g.disconnected.filter((d) => d.color !== color), { color, deadline }] } : g,
        ),
      );
      conn.onPlayerReconnected(({ color }) =>
        setGame((g) => (g ? { ...g, disconnected: g.disconnected.filter((d) => d.color !== color) } : g)),
      );
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
      setConnection(null);
    };
  }, [room, connect]);

  // Hạn chờ của đối thủ (nếu đang mất kết nối) → đồng hồ đếm ngược chạy mỗi giây
  const opponentGone =
    game?.status === 'ACTIVE' ? (game.disconnected.find((d) => d.color !== game.yourColor) ?? null) : null;
  useEffect(() => {
    if (!opponentGone) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [opponentGone]);

  const clock = useDisplayClock(game);
  const call = useVideoCall(connection, game?.matchId ?? null, game?.yourColor ?? null);

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

  // Lấy màu từ state socket (game.yourColor), cùng nguồn với statusText và orientation, không lấy room.members.
  const opponentColor: PlayerColor | null =
    game?.yourColor === 'RED' ? 'BLACK' : game?.yourColor === 'BLACK' ? 'RED' : null;
  const meToMove = active && game?.turn != null && game.turn === game.yourColor;
  const opponentToMove = active && game?.turn != null && game.yourColor != null && game.turn !== game.yourColor;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto w-full max-w-6xl lg:w-fit">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-400">Xiangqi Arena · Phòng {room.code}</p>
            <h1 className="truncate text-2xl font-extrabold text-amber-300">{room.name}</h1>
          </div>
          {!active && (
            <nav className="flex gap-4 text-sm">
              <Link href="/lobby" className="text-slate-300 underline hover:text-amber-200">
                Về Sảnh
              </Link>
              <Link href="/history" className="text-slate-300 underline hover:text-amber-200">
                Lịch sử ván
              </Link>
            </nav>
          )}
        </header>

        <div className="mt-4 flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center">
          {/* Bàn cờ co theo chiều cao màn hình để không phải cuộn (tỉ lệ ảnh bàn 741×821) */}
          <div className="w-full max-w-[560px] lg:w-[clamp(20rem,calc((100dvh-6.5rem)*741/821),560px)]">
            <Board
              position={position}
              orientation={orientation}
              selectedSquare={selected}
              validMoves={validMoves}
              lastMove={lastMove}
              onSquareClick={handleSquareClick}
              className="w-full"
            />
          </div>

          {/* Màn hẹp: cột thông tin lên trên bàn cờ để cảnh báo mất kết nối không bị khuất dưới bàn */}
          <aside className="order-first flex w-full max-w-[560px] flex-col gap-3 lg:order-none lg:w-80 lg:shrink-0 lg:self-stretch">
            <PlayerBadge member={opponent} toMove={opponentToMove} clockMs={clockFor(clock, opponentColor)} />

            <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Trạng thái ván</p>
              <div role="status" className="mt-1">
                <span className={`block text-base font-semibold ${game?.inCheck && active ? 'text-rose-300' : 'text-slate-100'}`}>
                  {statusText(game, me)}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {me?.color ? `Bạn cầm quân ${me.color === 'RED' ? 'Đỏ' : 'Đen'}` : ''}
                  {me?.color && game ? ' · ' : ''}
                  {game ? `Đã đi ${game.ply} nửa nước` : ''}
                </span>
              </div>
              {notice && (
                <p data-testid="move-notice" className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {notice}
                </p>
              )}
            </section>

            {!connected && (
              <p role="alert" className="rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Mất kết nối máy chủ, đang thử kết nối lại… Vào lại trong 60 giây để không bị xử thua.
              </p>
            )}
            {opponentGone && (
              <p
                data-testid="opponent-disconnected"
                aria-live="polite"
                className="rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm text-sky-100"
              >
                Đối thủ mất kết nối. Nếu không vào lại sau{' '}
                <strong>{Math.max(0, Math.ceil((Date.parse(opponentGone.deadline) - now) / 1000))} giây</strong>, bạn được xử thắng.
              </p>
            )}

            {game && (
              <VideoCallPanel
                opponentName={opponent?.displayName ?? 'Đối thủ'}
                selfName={me?.displayName ?? 'Bạn'}
                status={call.phase}
                micOn={call.micOn}
                camOn={call.camOn}
                opponentStream={call.remoteStream}
                localStream={call.localStream}
                error={call.error}
                onToggleMic={call.toggleMic}
                onToggleCam={call.toggleCam}
                onEndCall={call.hangup}
                onStartCall={() => void call.start()}
                onAccept={() => void call.accept()}
                onDecline={call.decline}
              />
            )}

            {active && (
              <div className="flex flex-col gap-2">
                {myOffer && (
                  <span data-testid="draw-offer-sent" className="text-xs text-slate-400">
                    Đã gửi đề nghị hòa, chờ đối thủ trả lời…
                  </span>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending || offer !== null}
                    onClick={() => void runAction((conn, id) => conn.offerDraw(id))}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-amber-400/60 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    🤝 Xin hòa
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirmResign(true)}
                    className="rounded-xl border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    🏳️ Xin thua
                  </button>
                </div>
              </div>
            )}

            <div className="lg:mt-auto">
              <PlayerBadge member={me} isMe toMove={meToMove} clockMs={clockFor(clock, game?.yourColor ?? null)} />
            </div>
          </aside>
        </div>
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

function clockFor(clock: ClockSnapshot | null, color: PlayerColor | null): number | null {
  if (!clock || !color) return null;
  return color === 'RED' ? clock.redMs : clock.blackMs;
}

function PlayerBadge({
  member,
  isMe = false,
  toMove = false,
  clockMs = null,
}: {
  member: RoomMember | null;
  isMe?: boolean;
  toMove?: boolean;
  /** Thời gian còn lại để hiển thị (đếm theo số server gửi); null khi chưa có ván. */
  clockMs?: number | null;
}) {
  if (!member) return null;
  const red = member.color === 'RED';
  const black = member.color === 'BLACK';
  const colorLabel = red ? 'Đỏ' : black ? 'Đen' : '—';
  return (
    <div
      data-testid={isMe ? 'player-me' : 'player-opponent'}
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
        toMove ? 'border-amber-400/70 bg-amber-400/10' : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
          red ? 'border-rose-400/70 bg-rose-950 text-rose-300' : 'border-slate-500 bg-slate-800 text-slate-200'
        }`}
      >
        {red ? '帥' : black ? '將' : '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-100">
          {member.displayName}
          {isMe ? ' (bạn)' : ''}
        </p>
        <p className="text-xs text-slate-400">
          Quân {colorLabel} · Elo {member.rating}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        {clockMs !== null && (
          <span
            data-testid={isMe ? 'clock-me' : 'clock-opponent'}
            aria-label={`Thời gian còn lại ${formatClock(clockMs)}`}
            className={`rounded-lg px-2 py-1 font-mono text-lg font-bold tabular-nums ${
              clockMs < 30_000
                ? 'bg-rose-500/15 text-rose-300'
                : toMove
                  ? 'bg-amber-400/15 text-amber-200'
                  : 'bg-slate-800/80 text-slate-300'
            }`}
          >
            {formatClock(clockMs)}
          </span>
        )}
        {toMove && <span className="text-xs font-semibold text-amber-300">Đang đi</span>}
      </div>
    </div>
  );
}
