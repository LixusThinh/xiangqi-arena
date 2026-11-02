import { Injectable } from '@nestjs/common';

/**
 * Rate limiter cho chat trong ván cờ (XQA-29, AC-29-04).
 * Quy tắc: tối đa 5 tin / 10 giây mỗi người chơi.
 */
@Injectable()
export class ChatRateLimiter {
  private readonly history = new Map<string, number[]>();
  readonly maxMessages = 5;
  readonly windowMs = 10_000;

  isAllowed(userId: string, now = Date.now()): boolean {
    const prev = this.history.get(userId) ?? [];
    const valid = prev.filter((t) => now - t < this.windowMs);
    if (valid.length >= this.maxMessages) {
      this.history.set(userId, valid);
      return false;
    }
    valid.push(now);
    this.history.set(userId, valid);
    return true;
  }

  reset(): void {
    this.history.clear();
  }
}
