import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * Hẹn giờ hết giờ cho từng ván (XQA-141). Mỗi ván có tối đa 1 hẹn giờ: lúc bên tới lượt hết thời gian.
 *
 * Hẹn giờ chỉ là cái chuông báo: khi chuông kêu, GameService đọc lại DB và tự tính xem đã hết giờ thật chưa,
 * nên lệch vài mili giây hay chuông kêu sớm cũng không sai kết quả. Server khởi động lại (Render free ngủ)
 * thì mất hẹn giờ → gateway hẹn lại cho mọi ván ACTIVE lúc khởi động, và GameService còn kiểm lại mỗi khi
 * có người đi quân / tải ván, nên không ván nào bị "treo giờ".
 */
@Injectable()
export class ClockService implements OnModuleDestroy {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /** Hẹn `onFlag` chạy sau `delayMs`; hẹn giờ cũ của ván (nếu có) bị thay. */
  schedule(matchId: string, delayMs: number, onFlag: () => void): void {
    this.clear(matchId);
    const timer = setTimeout(() => {
      this.timers.delete(matchId);
      onFlag();
    }, Math.max(0, delayMs));
    timer.unref?.();
    this.timers.set(matchId, timer);
  }

  clear(matchId: string): void {
    const timer = this.timers.get(matchId);
    if (timer) clearTimeout(timer);
    this.timers.delete(matchId);
  }

  has(matchId: string): boolean {
    return this.timers.has(matchId);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
