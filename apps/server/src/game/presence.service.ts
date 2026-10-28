import { Injectable, OnModuleDestroy } from '@nestjs/common';

/** Người chơi đang mất kết nối khỏi một ván (XQA-93). */
export interface DisconnectInfo {
  userId: string;
  /** Thời điểm hết hạn chờ; quá mốc này mà chưa vào lại thì bị xử thua (FR-22). */
  deadline: Date;
}

interface Entry {
  /** Số socket đang mở của user này trong ván (nhiều tab = nhiều socket). */
  sockets: number;
  disconnect: (DisconnectInfo & { timer: NodeJS.Timeout }) | null;
}

/**
 * Theo dõi ai đang kết nối vào ván nào, giữ ván trong thời gian chờ khi một người rớt mạng.
 *
 * Lưu trong RAM của tiến trình server: đủ cho 1 instance (phạm vi đồ án). Chạy nhiều instance cần chuyển
 * sang Redis (docs/api/socket.md mục giới hạn). Server khởi động lại thì mất đồng hồ chờ: ván ACTIVE
 * đang chờ sẽ không tự xử thua, người chơi vào lại vẫn chơi tiếp được.
 */
@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly matches = new Map<string, Map<string, Entry>>();

  /** Một socket của user vào ván. Trả về true nếu user đang trong thời gian chờ và vừa vào lại. */
  connect(matchId: string, userId: string): boolean {
    const entry = this.entry(matchId, userId);
    entry.sockets++;
    if (!entry.disconnect) return false;
    clearTimeout(entry.disconnect.timer);
    entry.disconnect = null;
    return true;
  }

  /**
   * Một socket của user rời ván. Nếu đó là socket cuối cùng thì bắt đầu đếm ngược `graceMs`;
   * hết giờ mà chưa vào lại thì gọi `onExpire`. Trả về thông tin chờ, hoặc null nếu user còn socket khác.
   */
  disconnect(
    matchId: string,
    userId: string,
    graceMs: number,
    onExpire: () => void,
  ): DisconnectInfo | null {
    const entry = this.entry(matchId, userId);
    entry.sockets = Math.max(0, entry.sockets - 1);
    if (entry.sockets > 0 || entry.disconnect) return null;
    const deadline = new Date(Date.now() + graceMs);
    const timer = setTimeout(() => {
      entry.disconnect = null;
      onExpire();
    }, graceMs);
    timer.unref?.();
    entry.disconnect = { userId, deadline, timer };
    return { userId, deadline };
  }

  /** Những người chơi đang mất kết nối của một ván (dùng để dựng GameState). */
  disconnected(matchId: string): DisconnectInfo[] {
    const players = this.matches.get(matchId);
    if (!players) return [];
    const list: DisconnectInfo[] = [];
    for (const entry of players.values()) {
      if (entry.disconnect) list.push({ userId: entry.disconnect.userId, deadline: entry.disconnect.deadline });
    }
    return list;
  }

  isDisconnected(matchId: string, userId: string): boolean {
    return this.matches.get(matchId)?.get(userId)?.disconnect != null;
  }

  /** Ván kết thúc: hủy mọi đồng hồ chờ, quên ván. */
  clear(matchId: string): void {
    const players = this.matches.get(matchId);
    if (!players) return;
    for (const entry of players.values()) {
      if (entry.disconnect) clearTimeout(entry.disconnect.timer);
    }
    this.matches.delete(matchId);
  }

  onModuleDestroy(): void {
    for (const matchId of [...this.matches.keys()]) this.clear(matchId);
  }

  private entry(matchId: string, userId: string): Entry {
    let players = this.matches.get(matchId);
    if (!players) {
      players = new Map();
      this.matches.set(matchId, players);
    }
    let entry = players.get(userId);
    if (!entry) {
      entry = { sockets: 0, disconnect: null };
      players.set(userId, entry);
    }
    return entry;
  }
}
