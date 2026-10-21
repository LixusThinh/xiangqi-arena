'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthApiError, getStoredSession } from '@/lib/auth-api';
import { ROOM_ERROR_MESSAGES, roomApi, type RoomDetail, type RoomMember } from '@/lib/room-api';

export interface WaitingRoomProps {
  code: string;
  /** Chu kỳ hỏi lại trạng thái phòng (ms). Thay bằng sự kiện socket khi gateway sẵn sàng. */
  pollIntervalMs?: number;
}

interface RoomError {
  code: string;
  message: string;
}

const COLOR_PREF_LABEL = {
  RED: 'Chủ phòng cầm quân Đỏ',
  BLACK: 'Chủ phòng cầm quân Đen',
  RANDOM: 'Bốc thăm màu quân khi đủ người',
} as const;

function toRoomError(error: unknown): RoomError {
  if (error instanceof AuthApiError) {
    return { code: error.code, message: ROOM_ERROR_MESSAGES[error.code] ?? error.message };
  }
  return { code: 'UNKNOWN', message: 'Không tải được phòng. Vui lòng thử lại.' };
}

export function playPath(code: string): string {
  return `/room/${encodeURIComponent(code)}/play`;
}

/**
 * Màn Phòng chờ (XQA-71, FR-05/FR-06).
 * - Mở bằng mã phòng hoặc link mời: chưa là thành viên mà phòng còn chờ → tự vào phòng.
 * - Hiện chủ phòng, đối thủ, trạng thái; hỏi lại định kỳ cho tới khi đủ người.
 * - Đủ 2 người (PLAYING) → cả 2 người tự chuyển sang màn ván cờ.
 * - Rời phòng được khi ván chưa bắt đầu.
 */
export default function WaitingRoom({ code, pollIntervalMs = 2000 }: WaitingRoomProps) {
  const router = useRouter();
  const [myId] = useState(() => getStoredSession()?.user.id ?? null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const [busyRoomCode, setBusyRoomCode] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isMember = (r: RoomDetail) => r.members.some((m) => m.id === myId);

  // Lần tải đầu: xem phòng, chưa là thành viên thì vào phòng.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let detail = await roomApi.get(code);
        if (!isMember(detail)) {
          if (detail.status === 'WAITING') {
            detail = await roomApi.join(code);
          } else {
            const errorCode = detail.status === 'PLAYING' ? 'ROOM_FULL' : 'ROOM_CLOSED';
            throw new AuthApiError(ROOM_ERROR_MESSAGES[errorCode], 409, errorCode);
          }
        }
        if (!cancelled) setRoom(detail);
      } catch (err) {
        if (cancelled) return;
        const roomError = toRoomError(err);
        setError(roomError);
        if (roomError.code === 'ROOM_USER_BUSY') {
          try {
            const { room: current } = await roomApi.current();
            if (!cancelled) setBusyRoomCode(current?.code ?? null);
          } catch {
            // chỉ để gợi ý đường quay lại phòng cũ; lỗi thì bỏ qua
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy lại khi đổi mã phòng
  }, [code]);

  // Hỏi lại trạng thái khi đang chờ đối thủ.
  const status = room?.status;
  useEffect(() => {
    if (status !== 'WAITING') return;
    const timer = window.setInterval(async () => {
      try {
        setRoom(await roomApi.get(code));
      } catch (err) {
        const roomError = toRoomError(err);
        // Lỗi mạng chập chờn: thử lại ở lượt sau, không làm gián đoạn màn chờ
        if (roomError.code !== 'NETWORK_ERROR' && roomError.code !== 'UNKNOWN') {
          setError(roomError);
        }
      }
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [status, code, pollIntervalMs]);

  // Đủ 2 người → vào màn ván cờ (cả chủ phòng lẫn khách đều đi qua nhánh này).
  useEffect(() => {
    if (room?.status === 'PLAYING') {
      router.replace(playPath(room.code));
    }
  }, [room, router]);

  const leave = useCallback(async () => {
    setLeaving(true);
    try {
      await roomApi.leave(code);
      router.push('/lobby');
    } catch (err) {
      setError(toRoomError(err));
      setLeaving(false);
    }
  }, [code, router]);

  const copyInvite = useCallback(async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${room.code}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [room]);

  if (error && !room) {
    return (
      <Shell>
        <div role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
          <p className="text-base font-semibold text-rose-200">{error.message}</p>
          {busyRoomCode && (
            <Link
              href={`/room/${busyRoomCode}`}
              className="mt-4 inline-block text-sm font-semibold text-amber-300 underline"
            >
              Quay lại phòng {busyRoomCode}
            </Link>
          )}
          <Link href="/lobby" className="mt-4 block text-sm text-slate-300 underline">
            Về Sảnh
          </Link>
        </div>
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <p className="text-center text-sm text-slate-400">Đang vào phòng…</p>
      </Shell>
    );
  }

  const host = room.members.find((m) => m.isHost) ?? null;
  const opponent = room.members.find((m) => !m.isHost) ?? null;
  const minutes = Math.round(room.ruleProfile.baseTimeSec / 60);
  const timeLabel =
    room.ruleProfile.incrementSec > 0
      ? `${minutes} phút + ${room.ruleProfile.incrementSec} giây/nước`
      : `${minutes} phút mỗi bên`;

  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400">
          Phòng {room.visibility === 'PRIVATE' ? 'riêng tư' : 'công khai'}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-amber-300">{room.name}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Mã phòng <span className="font-mono text-lg font-bold tracking-widest text-slate-100">{room.code}</span>
        </p>
      </header>

      <section aria-label="Người chơi" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Seat label="Chủ phòng" member={host} />
        <Seat label="Đối thủ" member={opponent} />
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-900/70 p-3">
          <dt className="text-slate-400">Thời gian</dt>
          <dd className="font-semibold text-slate-100">{timeLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-3">
          <dt className="text-slate-400">Màu quân</dt>
          <dd className="font-semibold text-slate-100">{COLOR_PREF_LABEL[room.hostColorPref]}</dd>
        </div>
      </dl>

      <p role="status" className="mt-6 text-center text-sm text-slate-300">
        {room.status === 'WAITING' && 'Đang chờ đối thủ vào phòng…'}
        {room.status === 'PLAYING' && 'Đủ người! Đang vào ván…'}
        {room.status === 'CANCELLED' && 'Phòng đã bị hủy.'}
        {room.status === 'FINISHED' && 'Ván trong phòng này đã kết thúc.'}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-rose-300">
          {error.message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {room.status === 'WAITING' && (
          <>
            <button
              type="button"
              onClick={copyInvite}
              className="rounded-xl border border-amber-400/60 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
            >
              {copied ? 'Đã sao chép link mời' : 'Sao chép link mời'}
            </button>
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-rose-400 hover:text-rose-200 disabled:opacity-50"
            >
              {leaving ? 'Đang rời phòng…' : 'Rời phòng'}
            </button>
          </>
        )}
        {(room.status === 'CANCELLED' || room.status === 'FINISHED') && (
          <Link href="/lobby" className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">
            Về Sảnh
          </Link>
        )}
      </div>
    </Shell>
  );
}

function Seat({ label, member }: { label: string; member: RoomMember | null }) {
  return (
    <div
      data-testid={`seat-${label}`}
      className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center"
    >
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      {member ? (
        <>
          <p className="mt-2 text-lg font-bold text-slate-100">{member.displayName}</p>
          <p className="text-xs text-slate-400">
            @{member.username} · Elo {member.rating}
          </p>
        </>
      ) : (
        <p className="mt-2 animate-pulse text-sm text-slate-400">Đang chờ…</p>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-2xl">
        {children}
      </div>
    </main>
  );
}
