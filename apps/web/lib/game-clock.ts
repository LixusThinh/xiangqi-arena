'use client';

import { useEffect, useState } from 'react';
import type { GameState, PlayerColor } from './game-socket';

/**
 * Đồng hồ hiển thị (XQA-142). Server là nơi DUY NHẤT tính giờ và xử hết giờ (XQA-141):
 * mỗi GameState mang thời gian còn lại của 2 bên tại lúc server gửi + bên đang chạy giờ.
 * Client chỉ trừ dần số đó theo thời gian thực để kim chạy mượt; về 0 thì đứng ở 0:00 và chờ
 * server gửi game:end. Không có đường nào để client kết thúc ván hay gửi thời gian lên server.
 */

export interface ClockSnapshot {
  redMs: number;
  blackMs: number;
  running: PlayerColor | null;
}

/** Thời gian hiển thị sau `elapsedMs` kể từ lúc nhận snapshot từ server. */
export function displayClock(snapshot: ClockSnapshot, elapsedMs: number): ClockSnapshot {
  const tick = (color: PlayerColor, ms: number) =>
    snapshot.running === color ? Math.max(0, ms - Math.max(0, elapsedMs)) : ms;
  return {
    redMs: tick('RED', snapshot.redMs),
    blackMs: tick('BLACK', snapshot.blackMs),
    running: snapshot.running,
  };
}

/** 754 321 → "12:35"; dưới 10 giây hiện thêm phần mười: 9 450 → "0:09.4". Làm tròn xuống để không báo dư giờ. */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = String(totalSec % 60).padStart(2, '0');
  if (safe < 10_000) return `${minutes}:${seconds}.${Math.floor((safe % 1000) / 100)}`;
  return `${minutes}:${seconds}`;
}

/** Đồng hồ hiển thị cho state hiện tại; chạy lại mỗi 100ms khi có bên đang chạy giờ. */
export function useDisplayClock(game: GameState | null): ClockSnapshot | null {
  const [base, setBase] = useState<{ snapshot: ClockSnapshot; receivedAt: number } | null>(null);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!game) {
      setBase(null);
      return;
    }
    // Mốc tính theo đồng hồ của máy client lúc nhận (không dùng serverTime) → lệch giờ giữa 2 máy không ảnh hưởng
    const receivedAt = performance.now();
    setBase({
      snapshot: { redMs: game.redTimeLeftMs, blackMs: game.blackTimeLeftMs, running: game.clockRunning },
      receivedAt,
    });
    setNow(receivedAt);
  }, [game]);

  useEffect(() => {
    if (!base?.snapshot.running) return;
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [base]);

  return base ? displayClock(base.snapshot, now - base.receivedAt) : null;
}
