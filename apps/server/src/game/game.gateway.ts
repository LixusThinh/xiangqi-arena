import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { GameService } from './game.service';
import { GameStateView, PlayerColor } from './game.types';

/** Ack trả về cho client qua callback của socket.emit(event, payload, ack). */
export type WsAck<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

interface SocketData {
  userId: string;
  sessionId: string;
}

type GameSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

const DIGITS = /^\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}

/** Trạng thái ván theo góc nhìn của một user (chỉ khác nhau ở yourColor). */
export function viewFor(state: GameStateView, userId: string): GameStateView {
  const yourColor: PlayerColor | null =
    state.red.id === userId ? 'RED' : state.black.id === userId ? 'BLACK' : null;
  return { ...state, yourColor };
}

/**
 * XQA-75: Socket.IO gateway cho ván cờ. Contract: docs/api/socket.md.
 *
 * - Kết nối phải mang access JWT (handshake.auth.token); kiểm bằng cùng luật với REST (AuthJwtGuard),
 *   gồm cả phiên đã logout (XQA-66). Không có / sai token → connect_error, socket bị ngắt.
 * - game:join → chỉ người chơi của ván được vào phòng socket `match:<id>`.
 * - game:move → chỉ socket đã join ván đó; luật đi quân, lượt, expectedPly do GameService quyết (XQA-74).
 *   Thành công → game:update cho mọi socket trong phòng (mỗi người nhận yourColor của mình),
 *   ván kết thúc → thêm game:end.
 * - Chưa có: xin thua / xin hòa (XQA-91), mất kết nối giữ ván 60s (XQA-93), đồng hồ (XQA-141).
 */
@WebSocketGateway()
export class GameGateway implements OnGatewayInit {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly authGuard: AuthJwtGuard,
  ) {}

  afterInit(server: Server): void {
    // Middleware chạy trước khi socket được coi là connected → không có event nào lọt vào trước khi xác thực xong.
    server.use((socket, next) => {
      const token: unknown = isRecord(socket.handshake.auth) ? socket.handshake.auth.token : undefined;
      if (typeof token !== 'string' || token.length === 0) {
        next(this.connectError('AUTH_TOKEN_MISSING', 'Access token is required'));
        return;
      }
      this.authGuard.verifyAccessToken(token).then(
        (user) => {
          const data = socket.data as SocketData;
          data.userId = user.sub;
          data.sessionId = user.sid;
          next();
        },
        (error: unknown) => {
          const { code, message } = this.toError(error);
          next(this.connectError(code, message));
        },
      );
    });
  }

  @SubscribeMessage('game:join')
  async join(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Promise<WsAck<GameStateView>> {
    try {
      const userId = socket.data.userId;
      const matchId = await this.resolveMatchId(body);
      const state = await this.gameService.getState(matchId, userId);
      if (!state.yourColor) {
        return this.fail('GAME_NOT_PLAYER', 'You are not a player in this match');
      }
      await socket.join(matchRoom(matchId));
      return { ok: true, data: state };
    } catch (error) {
      return { ok: false, error: this.toError(error) };
    }
  }

  @SubscribeMessage('game:move')
  async move(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Promise<WsAck<GameStateView>> {
    try {
      if (
        !isRecord(body) ||
        typeof body.matchId !== 'string' ||
        !DIGITS.test(body.matchId) ||
        typeof body.from !== 'string' ||
        typeof body.to !== 'string' ||
        typeof body.expectedPly !== 'number' ||
        !Number.isInteger(body.expectedPly) ||
        body.expectedPly < 0
      ) {
        return this.fail('VALIDATION_ERROR', 'Payload must be { matchId, from, to, expectedPly }');
      }
      const room = matchRoom(body.matchId);
      if (!socket.rooms.has(room)) {
        return this.fail('GAME_NOT_JOINED', 'Join the match with game:join before moving');
      }
      const state = await this.gameService.makeMove(body.matchId, socket.data.userId, {
        from: body.from,
        to: body.to,
        expectedPly: body.expectedPly,
      });
      await this.broadcast(state);
      return { ok: true, data: state };
    } catch (error) {
      return { ok: false, error: this.toError(error) };
    }
  }

  /** Phát trạng thái mới cho mọi socket trong phòng ván, mỗi socket nhận yourColor của chính nó. */
  private async broadcast(state: GameStateView): Promise<void> {
    const sockets = await this.server.in(matchRoom(state.matchId)).fetchSockets();
    for (const s of sockets) {
      s.emit('game:update', viewFor(state, (s.data as SocketData).userId));
    }
    if (state.status === 'FINISHED' || state.status === 'ABORTED') {
      this.server.to(matchRoom(state.matchId)).emit('game:end', {
        matchId: state.matchId,
        result: state.result,
        endReason: state.endReason,
        endRule: state.endRule,
      });
    }
  }

  private async resolveMatchId(body: unknown): Promise<string> {
    if (isRecord(body) && typeof body.matchId === 'string' && DIGITS.test(body.matchId)) {
      return body.matchId;
    }
    if (isRecord(body) && typeof body.roomCode === 'string' && body.roomCode.trim().length > 0) {
      return this.gameService.findMatchIdByRoom(body.roomCode);
    }
    throw new WsPayloadError('Payload must be { matchId } or { roomCode }');
  }

  private fail(code: string, message: string): WsAck<never> {
    return { ok: false, error: { code, message } };
  }

  private toError(error: unknown): { code: string; message: string } {
    if (error instanceof WsPayloadError) {
      return { code: 'VALIDATION_ERROR', message: error.message };
    }
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (isRecord(response) && typeof response.code === 'string') {
        return {
          code: response.code,
          message: typeof response.message === 'string' ? response.message : error.message,
        };
      }
      return { code: 'ERROR', message: error.message };
    }
    this.logger.error('Unhandled socket error', error instanceof Error ? error.stack : String(error));
    return { code: 'INTERNAL_ERROR', message: 'Unexpected server error' };
  }

  private connectError(code: string, message: string): Error {
    const error = new Error(message) as Error & { data: { code: string } };
    error.data = { code };
    return error;
  }
}

class WsPayloadError extends Error {}
