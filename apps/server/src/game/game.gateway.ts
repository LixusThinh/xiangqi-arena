import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { GameService } from './game.service';
import { GameStateView, PlayerColor } from './game.types';
import { PresenceService } from './presence.service';

/** Ack trả về cho client qua callback của socket.emit(event, payload, ack). */
export type WsAck<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

interface SocketData {
  userId: string;
  sessionId: string;
  /** Các ván socket này đã game:join (để biết rời ván nào khi mất kết nối – XQA-93). */
  matches?: string[];
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
 * - game:resign, game:draw-offer / draw-accept / draw-reject (XQA-91) → cùng luật join như game:move;
 *   thành công → game:update (+ game:end nếu ván kết thúc). Đề nghị hòa → thêm game:draw-offered,
 *   bị từ chối → thêm game:draw-rejected, để FE bật popup / toast.
 * - Mất kết nối (XQA-93): socket cuối cùng của một người chơi rời ván ACTIVE → giữ ván
 *   RuleProfile.reconnectGraceSec (60s), phát player:disconnected { matchId, color, deadline, graceSec }.
 *   game:join lại trong hạn → player:reconnected; quá hạn → GameService.forfeitByDisconnect, phát game:update + game:end.
 * - Chưa có: đồng hồ (XQA-141).
 */
@WebSocketGateway()
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly authGuard: AuthJwtGuard,
    private readonly presence: PresenceService,
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
      let state = await this.gameService.getState(matchId, userId);
      if (!state.yourColor) {
        return this.fail('GAME_NOT_PLAYER', 'You are not a player in this match');
      }
      await socket.join(matchRoom(matchId));
      const joined = (socket.data.matches ??= []);
      if (!joined.includes(matchId)) {
        joined.push(matchId);
        if (this.presence.connect(matchId, userId)) {
          // Vào lại trong thời gian chờ: báo đối thủ tắt banner, trả state không còn mình trong `disconnected`
          this.server.to(matchRoom(matchId)).emit('player:reconnected', { matchId, color: state.yourColor });
          state = await this.gameService.getState(matchId, userId);
        }
      }
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

  @SubscribeMessage('game:resign')
  resign(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<WsAck<GameStateView>> {
    return this.matchAction(socket, body, (matchId, userId) => this.gameService.resign(matchId, userId));
  }

  @SubscribeMessage('game:draw-offer')
  offerDraw(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<WsAck<GameStateView>> {
    return this.matchAction(socket, body, async (matchId, userId) => {
      const state = await this.gameService.offerDraw(matchId, userId);
      if (state.drawOffer) {
        this.server.to(matchRoom(matchId)).emit('game:draw-offered', { matchId, ...state.drawOffer });
      }
      return state;
    });
  }

  @SubscribeMessage('game:draw-accept')
  acceptDraw(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<WsAck<GameStateView>> {
    return this.matchAction(socket, body, (matchId, userId) =>
      this.gameService.respondDraw(matchId, userId, true),
    );
  }

  @SubscribeMessage('game:draw-reject')
  rejectDraw(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<WsAck<GameStateView>> {
    return this.matchAction(socket, body, async (matchId, userId) => {
      const state = await this.gameService.respondDraw(matchId, userId, false);
      this.server.to(matchRoom(matchId)).emit('game:draw-rejected', { matchId, by: state.yourColor });
      return state;
    });
  }

  /** Khung chung cho event chỉ mang { matchId }: kiểm payload, đã join, gọi service, phát state. */
  private async matchAction(
    socket: GameSocket,
    body: unknown,
    action: (matchId: string, userId: string) => Promise<GameStateView>,
  ): Promise<WsAck<GameStateView>> {
    try {
      if (!isRecord(body) || typeof body.matchId !== 'string' || !DIGITS.test(body.matchId)) {
        return this.fail('VALIDATION_ERROR', 'Payload must be { matchId }');
      }
      if (!socket.rooms.has(matchRoom(body.matchId))) {
        return this.fail('GAME_NOT_JOINED', 'Join the match with game:join first');
      }
      const state = await action(body.matchId, socket.data.userId);
      await this.broadcast(state);
      return { ok: true, data: state };
    } catch (error) {
      return { ok: false, error: this.toError(error) };
    }
  }

  /** XQA-93: socket đóng (rớt mạng, reload, tắt tab) → giữ ván cho những ván nó đang chơi. */
  async handleDisconnect(socket: GameSocket): Promise<void> {
    const userId = socket.data.userId;
    for (const matchId of socket.data.matches ?? []) {
      try {
        const target = await this.gameService.presenceTarget(matchId, userId);
        if (!target.active || !target.color) {
          this.presence.clear(matchId);
          continue;
        }
        const info = this.presence.disconnect(matchId, userId, target.graceMs, () => {
          void this.expire(matchId, userId);
        });
        if (info) {
          this.server.to(matchRoom(matchId)).emit('player:disconnected', {
            matchId,
            color: target.color,
            deadline: info.deadline.toISOString(),
            graceSec: Math.round(target.graceMs / 1000),
          });
        }
      } catch (error) {
        this.logger.error(`disconnect handling failed for match ${matchId}`, error instanceof Error ? error.stack : String(error));
      }
    }
  }

  /** Hết thời gian chờ mà chưa vào lại → xử thua (hoặc ABORTED nếu cả hai cùng vắng – BR-RECON-01). */
  private async expire(matchId: string, userId: string): Promise<void> {
    try {
      const state = await this.gameService.forfeitByDisconnect(matchId, userId);
      if (state) await this.broadcast(state);
    } catch (error) {
      this.logger.error(`reconnect timeout failed for match ${matchId}`, error instanceof Error ? error.stack : String(error));
    }
  }

  /** Phát trạng thái mới cho mọi socket trong phòng ván, mỗi socket nhận yourColor của chính nó. */
  private async broadcast(state: GameStateView): Promise<void> {
    const sockets = await this.server.in(matchRoom(state.matchId)).fetchSockets();
    for (const s of sockets) {
      s.emit('game:update', viewFor(state, (s.data as SocketData).userId));
    }
    if (state.status === 'FINISHED' || state.status === 'ABORTED') {
      this.presence.clear(state.matchId);
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
