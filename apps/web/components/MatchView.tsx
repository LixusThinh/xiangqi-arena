'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Position } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/Board';
import { AuthApiError, getStoredSession } from '@/lib/auth-api';
import { ROOM_ERROR_MESSAGES, roomApi, type RoomDetail, type RoomMember } from '@/lib/room-api';

/**
 * Màn ván cờ khi phòng đủ 2 người (XQA-71: "đủ 2 người cả 2 vào ván").
 * Hiện bàn cờ thế khởi đầu, xoay theo màu quân của người đang xem, và 2 người chơi.
 * Đi quân trực tuyến (gửi/nhận nước qua socket) do XQA-76 bổ sung vào màn này.
 */
export default function MatchView({ code }: { code: string }) {
  const router = useRouter();
  const [myId] = useState(() => getStoredSession()?.user.id ?? null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position] = useState(() => Position.initial());

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
  const orientation = me?.color === 'BLACK' ? 'b' : 'r';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
        <header className="text-center">
          <h1 className="text-xl font-extrabold text-amber-300">{room.name}</h1>
          <p className="text-xs text-slate-400">Phòng {room.code}</p>
        </header>
        <PlayerBadge member={opponent} />
        <Board position={position} orientation={orientation} className="w-full max-w-[560px]" />
        <PlayerBadge member={me} isMe />
        <p role="status" className="text-sm text-slate-300">
          Ván đã sẵn sàng · Quân Đỏ đi trước
          {me?.color ? ` · Bạn cầm quân ${me.color === 'RED' ? 'Đỏ' : 'Đen'}` : ''}
        </p>
      </div>
    </main>
  );
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
