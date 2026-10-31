import { io, type Socket } from 'socket.io-client';

/** Kiểu dữ liệu theo contract docs/api/game.md (XQA-74, XQA-90) và docs/api/socket.md (XQA-75, XQA-91). */
export type PlayerColor = 'RED' | 'BLACK';
export type MatchStatus = 'WAITING' | 'ACTIVE' | 'FINISHED' | 'ABORTED';
export type MatchResult = 'RED_WIN' | 'BLACK_WIN' | 'DRAW';

export interface GamePlayer {
  id: string;
  username: string;
  displayName: string;
  rating: number;
}

export interface GameMoveView {
  ply: number;
  from: string;
  to: string;
  piece: string;
  captured: string | null;
  isCheck: boolean;
}

export interface DrawOffer {
  by: PlayerColor;
  atPly: number;
}

/** Người chơi đang mất kết nối, ván được giữ tới `deadline` (XQA-93). */
export interface DisconnectedPlayer {
  color: PlayerColor;
  /** ISO time hết hạn chờ. */
  deadline: string;
}

export interface GameState {
  matchId: string;
  roomCode: string;
  status: MatchStatus;
  fen: string;
  ply: number;
  turn: PlayerColor | null;
  inCheck: boolean;
  result: MatchResult | null;
  endReason: string | null;
  endRule: string | null;
  red: GamePlayer;
  black: GamePlayer;
  yourColor: PlayerColor | null;
  lastMove: GameMoveView | null;
  moves: GameMoveView[];
  /** Đề nghị hòa đang chờ trả lời (XQA-91); null nếu không có. */
  drawOffer: DrawOffer | null;
  /** Người chơi đang mất kết nối (XQA-93); rỗng nếu cả hai đang kết nối. */
  disconnected: DisconnectedPlayer[];
  /** Thời gian còn lại (ms) tại lúc server gửi (XQA-141). Chỉ để hiển thị – server tự xử hết giờ. */
  redTimeLeftMs: number;
  blackTimeLeftMs: number;
  /** Bên đang chạy giờ; null khi ván chưa chạy / đã kết thúc. */
  clockRunning: PlayerColor | null;
  incrementMs: number;
  serverTime: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface GameEnd {
  matchId: string;
  result: MatchResult | null;
  endReason: string | null;
  endRule: string | null;
}

export interface DrawOffered extends DrawOffer {
  matchId: string;
}

export interface DrawRejected {
  matchId: string;
  /** Người từ chối. */
  by: PlayerColor | null;
}

export interface PlayerDisconnected extends DisconnectedPlayer {
  matchId: string;
  graceSec: number;
}

export interface PlayerReconnected {
  matchId: string;
  color: PlayerColor;
}

export interface MoveRequest {
  matchId: string;
  from: string;
  to: string;
  expectedPly: number;
}

type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export class GameSocketError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameSocketError';
  }
}

/** Thông báo tiếng Việt cho mã lỗi Game/Socket (contract mục lỗi của game.md + socket.md). */
export const GAME_ERROR_MESSAGES: Record<string, string> = {
  GAME_NOT_YOUR_TURN: 'Chưa tới lượt bạn.',
  GAME_ILLEGAL_MOVE: 'Nước đi không hợp lệ.',
  GAME_STALE_STATE: 'Bàn cờ vừa thay đổi, đã tải lại thế cờ mới.',
  GAME_NOT_ACTIVE: 'Ván đấu đã kết thúc.',
  GAME_NOT_PLAYER: 'Bạn không phải người chơi của ván này.',
  GAME_NOT_JOINED: 'Mất liên kết với ván, đang vào lại…',
  GAME_NOT_FOUND: 'Không tìm thấy ván đấu.',
  GAME_DRAW_OFFER_PENDING: 'Đang có một đề nghị hòa chờ trả lời.',
  GAME_DRAW_OFFER_TOO_SOON: 'Đề nghị hòa vừa bị từ chối. Đi thêm một nước rồi hãy đề nghị lại.',
  GAME_NO_DRAW_OFFER: 'Đề nghị hòa không còn hiệu lực.',
  GAME_DRAW_OFFER_OWN: 'Không thể tự trả lời đề nghị hòa của mình.',
  AUTH_TOKEN_MISSING: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
  AUTH_TOKEN_INVALID: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
  AUTH_TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.',
  AUTH_SESSION_REVOKED: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
  SOCKET_TIMEOUT: 'Máy chủ không phản hồi, kiểm tra kết nối mạng.',
};

export const END_REASON_LABELS: Record<string, string> = {
  CHECKMATE: 'Chiếu bí',
  STALEMATE: 'Hết nước đi',
  REPETITION: 'Lặp nước (Điều 23)',
  RESIGNATION: 'Xin thua',
  DRAW_AGREEMENT: 'Hai bên đồng ý hòa',
  TIMEOUT: 'Hết giờ',
  DISCONNECT: 'Mất kết nối quá thời gian chờ',
};

/** Kết nối realtime tới một ván. MatchView chỉ dùng interface này → test thay bằng bản giả. */
export interface GameConnection {
  /** Vào ván theo mã phòng; tự vào lại khi socket kết nối lại. */
  join(roomCode: string): Promise<GameState>;
  move(input: MoveRequest): Promise<GameState>;
  /** XQA-91: xin thua / đề nghị hòa / trả lời đề nghị hòa. */
  resign(matchId: string): Promise<GameState>;
  offerDraw(matchId: string): Promise<GameState>;
  answerDraw(matchId: string, accept: boolean): Promise<GameState>;
  onUpdate(listener: (state: GameState) => void): void;
  onEnd(listener: (end: GameEnd) => void): void;
  onDrawOffered(listener: (offer: DrawOffered) => void): void;
  onDrawRejected(listener: (info: DrawRejected) => void): void;
  /** XQA-94: đối thủ (hoặc chính mình ở tab khác) mất kết nối / vào lại. */
  onPlayerDisconnected(listener: (info: PlayerDisconnected) => void): void;
  onPlayerReconnected(listener: (info: PlayerReconnected) => void): void;
  onConnectionChange(listener: (connected: boolean) => void): void;
  close(): void;
}

export type ConnectGame = (token: string) => GameConnection;

const ACK_TIMEOUT_MS = 5000;

function socketUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Chưa cấu hình NEXT_PUBLIC_API_BASE_URL cho ứng dụng web.');
  }
  return baseUrl.replace(/\/+$/, '');
}

async function request<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  let ack: Ack<T>;
  try {
    ack = (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<T>;
  } catch {
    throw new GameSocketError('SOCKET_TIMEOUT', GAME_ERROR_MESSAGES.SOCKET_TIMEOUT);
  }
  if (!ack.ok) {
    throw new GameSocketError(ack.error.code, ack.error.message);
  }
  return ack.data;
}

/** Kết nối thật qua Socket.IO, access token gửi trong handshake `auth.token`. */
export const connectGame: ConnectGame = (token) => {
  const socket = io(socketUrl(), { auth: { token }, transports: ['websocket'] });
  const updateListeners: Array<(state: GameState) => void> = [];
  let joinedRoom: string | null = null;
  let firstConnect = true;

  // Lần kết nối đầu: chờ handshake xong để lỗi xác thực ra đúng mã (AUTH_*) thay vì timeout.
  const ready = new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code ?? 'SOCKET_TIMEOUT';
      reject(new GameSocketError(code, GAME_ERROR_MESSAGES[code] ?? err.message));
    });
  });
  ready.catch(() => undefined);

  socket.on('game:update', (state: GameState) => updateListeners.forEach((l) => l(state)));

  // Socket mới sau khi rớt mạng chưa ở trong phòng nào → join lại và đẩy state mới cho màn hình.
  socket.on('connect', () => {
    if (firstConnect) {
      firstConnect = false;
      return;
    }
    if (!joinedRoom) return;
    request<GameState>(socket, 'game:join', { roomCode: joinedRoom }).then(
      (state) => updateListeners.forEach((l) => l(state)),
      () => undefined,
    );
  });

  return {
    async join(roomCode) {
      joinedRoom = roomCode;
      await ready;
      return request<GameState>(socket, 'game:join', { roomCode });
    },
    move(input) {
      return request<GameState>(socket, 'game:move', input);
    },
    resign(matchId) {
      return request<GameState>(socket, 'game:resign', { matchId });
    },
    offerDraw(matchId) {
      return request<GameState>(socket, 'game:draw-offer', { matchId });
    },
    answerDraw(matchId, accept) {
      return request<GameState>(socket, accept ? 'game:draw-accept' : 'game:draw-reject', { matchId });
    },
    onUpdate(listener) {
      updateListeners.push(listener);
    },
    onEnd(listener) {
      socket.on('game:end', listener);
    },
    onDrawOffered(listener) {
      socket.on('game:draw-offered', listener);
    },
    onDrawRejected(listener) {
      socket.on('game:draw-rejected', listener);
    },
    onPlayerDisconnected(listener) {
      socket.on('player:disconnected', listener);
    },
    onPlayerReconnected(listener) {
      socket.on('player:reconnected', listener);
    },
    onConnectionChange(listener) {
      socket.on('connect', () => listener(true));
      socket.on('disconnect', () => listener(false));
    },
    close() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
};
