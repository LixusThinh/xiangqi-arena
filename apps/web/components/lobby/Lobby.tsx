'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AuthApiError, getStoredSession } from '@/lib/auth-api';
import {
  ROOM_ERROR_MESSAGES,
  roomApi,
  type HostColorPref,
  type RoomDetail,
  type RoomSummary,
  type RoomVisibility,
} from '@/lib/room-api';

export interface LobbyProps {
  /** Chu kỳ tải lại danh sách phòng (ms). docs/api/room.md gợi ý 3 giây cho tới khi có sự kiện socket. */
  pollIntervalMs?: number;
}

/** Hai RuleProfile có trong seed (apps/server/prisma/seed.ts). */
const TIME_OPTIONS = [
  { code: 'VN_STANDARD', label: '10 phút mỗi bên' },
  { code: 'ONLINE_RAPID', label: '5 phút + 2 giây/nước (tính hạng)' },
] as const;

const COLOR_OPTIONS: Array<{ value: HostColorPref; label: string }> = [
  { value: 'RANDOM', label: 'Bốc thăm' },
  { value: 'RED', label: 'Đỏ (đi trước)' },
  { value: 'BLACK', label: 'Đen' },
];

const COLOR_PREF_SHORT: Record<HostColorPref, string> = {
  RANDOM: 'Bốc thăm màu',
  RED: 'Chủ phòng cầm Đỏ',
  BLACK: 'Chủ phòng cầm Đen',
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError) return ROOM_ERROR_MESSAGES[error.code] ?? error.message;
  return fallback;
}

export function roomPath(code: string): string {
  return `/room/${encodeURIComponent(code)}`;
}

function timeLabel(room: RoomSummary): string {
  const minutes = Math.round(room.ruleProfile.baseTimeSec / 60);
  const inc = room.ruleProfile.incrementSec;
  return inc > 0 ? `${minutes} phút + ${inc}s` : `${minutes} phút`;
}

/**
 * Màn Sảnh (XQA-70, FR-05/FR-06).
 * - Danh sách phòng công khai đang chờ, tự tải lại định kỳ (AC1: có phòng mới thì danh sách cập nhật).
 * - Tạo phòng: tên, màu quân, công khai/riêng tư, thời gian → chuyển sang Phòng chờ.
 * - Vào phòng từ danh sách hoặc nhập mã (phòng riêng tư không hiện trong danh sách).
 * - Đang ở một phòng khác → hiện nút quay lại phòng đó thay vì cho tạo/vào phòng mới.
 */
export default function Lobby({ pollIntervalMs = 3000 }: LobbyProps) {
  const router = useRouter();
  const [myId] = useState(() => getStoredSession()?.user.id ?? null);
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [current, setCurrent] = useState<RoomDetail | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState<HostColorPref>('RANDOM');
  const [visibility, setVisibility] = useState<RoomVisibility>('PUBLIC');
  const [ruleProfileCode, setRuleProfileCode] = useState<string>(TIME_OPTIONS[0].code);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    roomApi
      .current()
      .then(({ room }) => {
        if (!cancelled) setCurrent(room);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await roomApi.list();
        if (cancelled) return;
        setRooms(list);
        setListError(null);
      } catch (error) {
        if (!cancelled) setListError(errorMessage(error, 'Không tải được danh sách phòng. Đang thử lại…'));
      }
    };
    void load();
    const timer = setInterval(() => void load(), pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollIntervalMs]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const trimmed = name.trim();
      const room = await roomApi.create({
        ...(trimmed ? { name: trimmed } : {}),
        hostColorPref: color,
        visibility,
        ruleProfileCode,
      });
      router.push(roomPath(room.code));
    } catch (error) {
      setCreateError(errorMessage(error, 'Không tạo được phòng. Vui lòng thử lại.'));
      setCreating(false);
    }
  }

  function onJoinByCode(event: FormEvent) {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) router.push(roomPath(code));
  }

  const inOtherRoom = current !== null;

  return (
    <main className="py-8 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4">
        <header>
          <h1 className="text-3xl font-extrabold text-amber-300">Sảnh</h1>
          <p className="mt-1 text-sm text-slate-400">Vào một phòng đang chờ, tạo phòng mới hoặc nhập mã phòng bạn được mời.</p>
        </header>

        {current && (
          <div
            role="status"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4"
          >
            <p className="text-sm text-amber-100">
              Bạn đang ở phòng <span className="font-semibold">{current.name}</span> (
              <span className="font-mono">{current.code}</span>). Rời phòng đó trước khi tạo hoặc vào phòng khác.
            </p>
            <Link
              href={roomPath(current.code)}
              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950"
            >
              Quay lại phòng
            </Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
          <section aria-labelledby="room-list-title" className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between">
              <h2 id="room-list-title" className="text-lg font-bold text-slate-100">
                Phòng đang chờ
              </h2>
              <span className="text-xs text-slate-500">Tự cập nhật</span>
            </div>

            {listError && (
              <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {listError} <span className="text-rose-200/80">Trang tự thử lại mỗi vài giây.</span>
              </p>
            )}

            {rooms === null && !listError && <p className="mt-6 text-sm text-slate-400">Đang tải danh sách phòng…</p>}

            {rooms !== null && rooms.length === 0 && (
              <p className="mt-6 rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                Chưa có phòng nào đang chờ. Tạo phòng mới để mời đối thủ.
              </p>
            )}

            {rooms !== null && rooms.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-800">
                {rooms.map((room) => {
                  const mine = room.host.id === myId;
                  return (
                    <li key={room.code} data-testid={`room-${room.code}`} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-100">{room.name}</p>
                        <p className="text-xs text-slate-400">
                          {room.host.displayName} · {room.host.rating} · {timeLabel(room)} ·{' '}
                          {COLOR_PREF_SHORT[room.hostColorPref]}
                          {room.ruleProfile.isRanked ? ' · Tính hạng' : ''}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-slate-500">{room.code}</span>
                      {mine ? (
                        <Link
                          href={roomPath(room.code)}
                          className="rounded-xl border border-amber-400/60 px-3 py-1.5 text-sm font-semibold text-amber-200"
                        >
                          Phòng của bạn
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={inOtherRoom}
                          onClick={() => router.push(roomPath(room.code))}
                          aria-label={`Vào phòng ${room.name}`}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Vào
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-6">
            <form
              onSubmit={onCreate}
              aria-labelledby="create-room-title"
              className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <h2 id="create-room-title" className="text-lg font-bold text-slate-100">
                Tạo phòng
              </h2>

              <label className="mt-4 block text-sm text-slate-300">
                Tên phòng
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Bỏ trống để dùng tên mặc định"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-amber-400"
                />
              </label>

              <fieldset className="mt-4">
                <legend className="text-sm text-slate-300">Màu quân của bạn</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm ${
                        color === opt.value
                          ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                          : 'border-slate-700 text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="color"
                        value={opt.value}
                        checked={color === opt.value}
                        onChange={() => setColor(opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block text-sm text-slate-300">
                Thời gian
                <select
                  value={ruleProfileCode}
                  onChange={(e) => setRuleProfileCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={visibility === 'PRIVATE'}
                  onChange={(e) => setVisibility(e.target.checked ? 'PRIVATE' : 'PUBLIC')}
                />
                Phòng riêng tư (chỉ vào bằng mã / link mời)
              </label>

              {createError && (
                <p role="alert" className="mt-3 text-sm text-rose-300">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={creating || inOtherRoom}
                className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Đang tạo…' : 'Tạo phòng'}
              </button>
            </form>

            <form
              onSubmit={onJoinByCode}
              aria-labelledby="join-code-title"
              className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <h2 id="join-code-title" className="text-lg font-bold text-slate-100">
                Vào bằng mã phòng
              </h2>
              <div className="mt-3 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  aria-label="Mã phòng"
                  placeholder="VD: K7MPQ2XA"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase text-slate-100 outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim() || inOtherRoom}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
                >
                  Vào
                </button>
              </div>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
