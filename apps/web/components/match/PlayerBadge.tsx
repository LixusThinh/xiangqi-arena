import { formatClock, type ClockSnapshot } from '@/lib/game-clock';
import type { PlayerColor } from '@/lib/game-socket';
import type { RoomMember } from '@/lib/room-api';

/** Thời gian hiển thị của một màu trong ván (đếm theo số server gửi – XQA-142). */
export function clockFor(clock: ClockSnapshot | null, color: PlayerColor | null): number | null {
  if (!clock || !color) return null;
  return color === 'RED' ? clock.redMs : clock.blackMs;
}

export default function PlayerBadge({
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
