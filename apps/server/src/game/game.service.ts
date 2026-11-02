import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DrawOfferStatus,
  MatchEndReason,
  MatchResult,
  MatchStatus,
  Prisma,
  ReportStatus,
  RoomStatus,
} from '@prisma/client';
import {
  algebraicToSquare,
  Color,
  GameStatus,
  Move,
  Piece,
  pieceToChar,
  Position,
  RepetitionJudge,
  RepetitionVerdict,
  STARTING_FEN,
} from '@xiangqi-arena/xiangqi-core';
import { PrismaService } from '../prisma/prisma.service';
import { calculateElo } from './elo';
import { ChatRateLimiter } from './chat-rate-limiter';
import { CreateReportDto } from './game.dto';
import { PresenceService } from './presence.service';
import {
  AdjournedMatchItem,
  ChatMessageView,
  DisconnectedPlayerView,
  DrawOfferView,
  GameMoveView,
  GamePlayer,
  GameStateView,
  MoveInput,
  PlayerColor,
  ReportView,
} from './game.types';

/**
 * Kết quả ván sau một nước đi. Thứ tự ưu tiên: hết nước (chiếu bí / hết nước đi – Điều 7.1)
 * trước, rồi tới phán quyết lặp nước (Điều 23). 'undetermined' của phần 1 → ván tiếp tục.
 */
export function resolveEnding(
  status: GameStatus,
  verdict: RepetitionVerdict,
): { result: MatchResult | null; endReason: MatchEndReason | null } {
  if (status.result) {
    return {
      result: status.result.winner === 'r' ? MatchResult.RED_WIN : MatchResult.BLACK_WIN,
      endReason:
        status.result.reason === 'checkmate' ? MatchEndReason.CHECKMATE : MatchEndReason.STALEMATE,
    };
  }
  const rep = verdict.result;
  if (!rep || rep.kind === 'undetermined') return { result: null, endReason: null };
  return {
    result:
      rep.kind === 'draw'
        ? MatchResult.DRAW
        : rep.winner === 'r'
          ? MatchResult.RED_WIN
          : MatchResult.BLACK_WIN,
    endReason: MatchEndReason.REPETITION,
  };
}

const SQUARE_PATTERN = /^[a-i][0-9]$/;

const playerSelect = { id: true, username: true, displayName: true, rating: true } as const;

const matchSelect = {
  id: true,
  status: true,
  result: true,
  endReason: true,
  currentFen: true,
  currentPly: true,
  redTimeLeftMs: true,
  blackTimeLeftMs: true,
  startedAt: true,
  endedAt: true,
  adjournedAt: true,
  turnStartedAt: true,
  roomId: true,
  redPlayerId: true,
  blackPlayerId: true,
  room: { select: { roomCode: true } },
  ruleProfile: { select: { repetitionThreshold: true, reconnectGraceSec: true, incrementSec: true } },
  redPlayer: { select: playerSelect },
  blackPlayer: { select: playerSelect },
  moves: {
    orderBy: { ply: 'asc' },
    select: {
      ply: true,
      fromSq: true,
      toSq: true,
      pieceCode: true,
      capturedPieceCode: true,
      isCheck: true,
    },
  },
  drawOffers: {
    where: { status: DrawOfferStatus.PENDING },
    orderBy: { id: 'desc' },
    take: 1,
    select: { id: true, offeredBy: true, atPly: true },
  },
  ratingHistory: {
    select: { userId: true, ratingBefore: true, ratingAfter: true },
  },
} as const;

type MatchRow = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;
type Tx = Prisma.TransactionClient;

/** Kết quả khi một bên chịu thua / bị xử thua: bên kia thắng. */
export function opponentWins(loser: PlayerColor): MatchResult {
  return loser === 'RED' ? MatchResult.BLACK_WIN : MatchResult.RED_WIN;
}

interface Replay {
  position: Position;
  judge: RepetitionJudge;
  lastVerdict: RepetitionVerdict | null;
}

/**
 * GameService (XQA-74): server là authority của ván cờ.
 *
 * - Mọi nước đi được kiểm bằng xiangqi-core trên thế cờ dựng lại từ DB, không tin client.
 * - Kiểm đúng người, đúng lượt, đúng thế cờ (expectedPly) → chống đi hộ, đi sai lượt, gửi trùng.
 * - Ghi nước + cập nhật ván trong 1 transaction có điều kiện currentPly → 2 request cùng lúc chỉ 1 thành công.
 * - Tự kết thúc ván: chiếu bí, hết nước (Điều 7.1), lặp nước theo RepetitionJudge (Điều 23).
 * - Kết thúc theo yêu cầu người chơi (XQA-90, XQA-91): xin thua, xin hòa → đối thủ đồng ý.
 *   Mọi đường kết thúc đi qua `finishInTx`: chỉ ván ACTIVE mới được chốt, kết quả do server tính,
 *   client không gửi result/endReason được (FR-13, BR-05).
 * - Mất kết nối (XQA-93): gateway theo dõi qua PresenceService; hết thời gian chờ → forfeitByDisconnect.
 * - Đồng hồ (XQA-141): chỉ server tính giờ. DB lưu thời gian còn lại của mỗi bên tại mốc turnStartedAt;
 *   đi quân → trừ thời gian suy nghĩ của người đi + cộng increment; hết giờ → bên tới lượt thua (TIMEOUT).
 *   Hết giờ được phát hiện ở: hẹn giờ của gateway (checkTimeout), mỗi lần đi quân / tải ván / thao tác.
 *   Client chỉ nhận số mili giây còn lại để hiển thị, không gửi được thời gian và không tự kết thúc ván.
 * - Chưa có: Elo.
 * Transport (REST ở GameController, Socket.IO ở gateway XQA-75) chỉ gọi vào đây.
 */
@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly chatRateLimiter: ChatRateLimiter,
  ) {}

  /**
   * Gửi tin nhắn chat trong ván cờ (XQA-29, FR-23).
   * Kiểm tra: là người chơi, ván ACTIVE, độ dài 1-300 ký tự (Unicode code points), rate limit 5 tin/10s.
   */
  async sendChat(matchId: string, userId: string, content: string): Promise<ChatMessageView> {
    if (!/^\d+$/.test(matchId)) {
      throw this.error(BadRequestException, 'VALIDATION_ERROR', 'matchId must be digits');
    }
    const trimmed = typeof content === 'string' ? content.trim() : '';
    const codePointLength = [...trimmed].length;
    if (codePointLength < 1 || codePointLength > 300) {
      throw this.error(BadRequestException, 'VALIDATION_ERROR', 'Tin nhắn phải có độ dài từ 1 đến 300 ký tự');
    }

    const match = await this.loadMatch(matchId);
    const isPlayer =
      match.redPlayerId.toString() === userId || match.blackPlayerId.toString() === userId;
    if (!isPlayer) {
      throw this.error(ForbiddenException, 'GAME_NOT_PLAYER', 'You are not a player in this match');
    }
    if (match.status !== MatchStatus.ACTIVE) {
      throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'Ván đấu không còn hoạt động');
    }

    if (!this.chatRateLimiter.isAllowed(userId)) {
      throw this.error(
        BadRequestException,
        'CHAT_RATE_LIMITED',
        'Bạn gửi tin nhắn quá nhanh. Tối đa 5 tin / 10 giây.',
      );
    }

    const sender =
      match.redPlayerId.toString() === userId ? match.redPlayer : match.blackPlayer;

    const row = await this.prisma.chat.create({
      data: {
        roomId: match.roomId,
        matchId: match.id,
        senderId: BigInt(userId),
        message: trimmed,
        type: 'TEXT',
      },
    });

    return {
      id: row.id.toString(),
      matchId: match.id.toString(),
      senderId: userId,
      senderName: sender.displayName,
      content: trimmed,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Lấy lịch sử 50 tin nhắn gần nhất của ván (XQA-29, AC-29-07). */
  async getChats(matchId: string, userId: string): Promise<ChatMessageView[]> {
    if (!/^\d+$/.test(matchId)) throw this.notFound();
    const match = await this.loadMatch(matchId);
    const isPlayer =
      match.redPlayerId.toString() === userId || match.blackPlayerId.toString() === userId;
    if (!isPlayer) {
      throw this.error(ForbiddenException, 'GAME_NOT_PLAYER', 'You are not a player in this match');
    }

    const rows = await this.prisma.chat.findMany({
      where: { matchId: match.id },
      orderBy: { id: 'desc' },
      take: 50,
      include: {
        sender: { select: { displayName: true } },
      },
    });

    return rows.reverse().map((r) => ({
      id: r.id.toString(),
      matchId: match.id.toString(),
      senderId: r.senderId.toString(),
      senderName: r.sender.displayName,
      content: r.message,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Trạng thái ván. Ván ở WAITING (vừa đủ 2 người) được bắt đầu ngay khi một người chơi mở. */
  async getState(matchId: string, userId: string): Promise<GameStateView> {
    let match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    if (match.status === MatchStatus.WAITING && color) {
      match = await this.start(match);
    }
    if (await this.finishIfFlagged(match)) match = await this.loadMatch(matchId);
    return this.toView(match, this.replay(match), color);
  }

  /**
   * Gateway gọi khi hẹn giờ hết giờ kêu (XQA-141). Server tự tính lại từ DB:
   * - đã hết giờ → chốt TIMEOUT, trả `{ ended }` để phát game:update + game:end;
   * - chưa hết (chuông kêu sớm) → trả `{ remainingMs }` để hẹn lại;
   * - ván không còn ACTIVE → null.
   */
  async checkTimeout(matchId: string): Promise<{ ended: GameStateView } | { remainingMs: number } | null> {
    const match = await this.loadMatch(matchId);
    if (match.status !== MatchStatus.ACTIVE) return null;
    if (await this.finishIfFlagged(match)) {
      const ended = await this.loadMatch(matchId);
      return { ended: this.toView(ended, this.replay(ended), null) };
    }
    const running = this.runningClock(match, new Date());
    return running ? { remainingMs: running.leftMs } : null;
  }

  /** Ván ACTIVE + thời gian còn lại của bên tới lượt – để gateway hẹn giờ lại lúc server khởi động. */
  async activeClocks(): Promise<Array<{ matchId: string; remainingMs: number }>> {
    const rows = await this.prisma.match.findMany({
      where: { status: MatchStatus.ACTIVE },
      select: { id: true, status: true, currentPly: true, redTimeLeftMs: true, blackTimeLeftMs: true, turnStartedAt: true },
    });
    const now = new Date();
    return rows.flatMap((row) => {
      const running = this.runningClock(row, now);
      return running ? [{ matchId: row.id.toString(), remainingMs: running.leftMs }] : [];
    });
  }

  async makeMove(matchId: string, userId: string, input: MoveInput): Promise<GameStateView> {
    if (!SQUARE_PATTERN.test(input.from) || !SQUARE_PATTERN.test(input.to)) {
      throw this.error(BadRequestException, 'VALIDATION_ERROR', 'from/to must be squares a0..i9');
    }
    let match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    if (!color) {
      throw this.error(ForbiddenException, 'GAME_NOT_PLAYER', 'You are not a player in this match');
    }
    if (match.status === MatchStatus.WAITING) {
      match = await this.start(match);
    }
    if (match.status !== MatchStatus.ACTIVE) {
      throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'The match has already ended');
    }
    // Đi quân khi đã hết giờ: nước đi không được ghi, ván kết thúc TIMEOUT (bên tới lượt thua)
    if (await this.finishIfFlagged(match)) return this.getState(matchId, userId);
    if (input.expectedPly !== match.currentPly) {
      throw this.error(
        ConflictException,
        'GAME_STALE_STATE',
        `Your board is out of date (server ply ${match.currentPly}); reload the game state`,
      );
    }

    const replay = this.replay(match);
    const side: Color = color === 'RED' ? 'r' : 'b';
    if (replay.position.sideToMove !== side) {
      throw this.error(ConflictException, 'GAME_NOT_YOUR_TURN', 'It is not your turn');
    }
    const move: Move = { from: algebraicToSquare(input.from), to: algebraicToSquare(input.to) };
    if (!replay.position.isLegalMove(move)) {
      throw this.error(BadRequestException, 'GAME_ILLEGAL_MOVE', 'This move is not legal');
    }

    const piece = replay.position.board[move.from] as Piece;
    const captured = replay.position.board[move.to];
    const verdict = replay.judge.play(move);
    replay.position.applyMove(move);
    replay.lastVerdict = verdict;
    const status = replay.position.getGameStatus();
    const ply = match.currentPly + 1;
    const now = new Date();

    const { result, endReason } = resolveEnding(status, verdict);
    // Trừ thời gian suy nghĩ của người vừa đi, cộng increment nếu ván còn tiếp tục
    const moverLeftMs = Math.max(0, this.clockOf(match, color) - this.thinkTime(match, now));
    const incrementMs = result ? 0 : match.ruleProfile.incrementSec * 1000;
    const moverClock = BigInt(moverLeftMs + incrementMs);

    await this.prisma.$transaction(async (tx) => {
      // Khóa lạc quan theo currentPly: request trùng / song song sẽ thấy count = 0
      const claimed = await tx.match.updateMany({
        where: { id: match.id, status: MatchStatus.ACTIVE, currentPly: match.currentPly },
        data: {
          currentFen: replay.position.toFen(),
          currentPly: ply,
          turnStartedAt: now,
          ...(color === 'RED' ? { redTimeLeftMs: moverClock } : { blackTimeLeftMs: moverClock }),
          ...(result ? { status: MatchStatus.FINISHED, result, endReason, endedAt: now } : {}),
        },
      });
      if (claimed.count !== 1) {
        throw this.error(ConflictException, 'GAME_STALE_STATE', 'Another move was applied first');
      }
      // Đi quân thay vì trả lời = bỏ qua đề nghị hòa của đối thủ (BR-DRAW-02, đề xuất)
      await tx.drawOffer.updateMany({
        where: { matchId: match.id, status: DrawOfferStatus.PENDING, offeredBy: { not: BigInt(userId) } },
        data: { status: DrawOfferStatus.EXPIRED },
      });
      await tx.move.create({
        data: {
          matchId: match.id,
          ply,
          playerId: BigInt(userId),
          pieceCode: pieceToChar(piece),
          fromSq: input.from,
          toSq: input.to,
          capturedPieceCode: captured ? pieceToChar(captured) : null,
          isCheck: status.inCheck,
          isCapture: captured !== null,
          isIrreversible: captured !== null || piece.type === 'p',
          fenAfter: replay.position.toFen(),
          positionHash: replay.position.toHashString(),
          thinkTimeMs: this.thinkTime(match, now),
        },
      });
      if (result) await this.afterFinish(tx, match, result, MatchStatus.FINISHED);
    });

    return this.getState(matchId, userId);
  }

  /** Xin thua (FR-14): người gửi thua, đối thủ thắng, lý do RESIGNATION. */
  async resign(matchId: string, userId: string): Promise<GameStateView> {
    const { match, color } = await this.activeMatchFor(matchId, userId, true);
    await this.prisma.$transaction((tx) =>
      this.finishInTx(tx, match, opponentWins(color), MatchEndReason.RESIGNATION),
    );
    return this.getState(matchId, userId);
  }

  /**
   * Đề nghị hòa (FR-15). Mỗi ván chỉ có 1 đề nghị chờ trả lời.
   * BR-DRAW-01 (đề xuất, chờ PM duyệt): bị từ chối thì phải đi thêm ít nhất 1 nước mới được đề nghị lại.
   */
  async offerDraw(matchId: string, userId: string): Promise<GameStateView> {
    const { match } = await this.activeMatchFor(matchId, userId);
    const pending = match.drawOffers[0];
    if (pending) {
      const mine = pending.offeredBy.toString() === userId;
      throw this.error(
        ConflictException,
        'GAME_DRAW_OFFER_PENDING',
        mine
          ? 'You already offered a draw; wait for the answer'
          : 'Your opponent has offered a draw; accept or reject it',
      );
    }
    const lastDeclined = await this.prisma.drawOffer.findFirst({
      where: { matchId: match.id, offeredBy: BigInt(userId), status: DrawOfferStatus.DECLINED },
      orderBy: { id: 'desc' },
      select: { atPly: true },
    });
    if (lastDeclined && !this.hasMovedSince(match, userId, lastDeclined.atPly)) {
      throw this.error(
        ConflictException,
        'GAME_DRAW_OFFER_TOO_SOON',
        'Your last draw offer was rejected; make a move before offering again',
      );
    }
    await this.prisma.drawOffer.create({
      data: {
        matchId: match.id,
        offeredBy: BigInt(userId),
        atPly: match.currentPly,
        status: DrawOfferStatus.PENDING,
      },
    });
    return this.getState(matchId, userId);
  }

  /** Trả lời đề nghị hòa: đồng ý → DRAW (DRAW_AGREEMENT); từ chối → ván tiếp tục. */
  async respondDraw(matchId: string, userId: string, accept: boolean): Promise<GameStateView> {
    const { match } = await this.activeMatchFor(matchId, userId);
    const pending = match.drawOffers[0];
    if (!pending) {
      throw this.error(ConflictException, 'GAME_NO_DRAW_OFFER', 'There is no pending draw offer');
    }
    if (pending.offeredBy.toString() === userId) {
      throw this.error(ConflictException, 'GAME_DRAW_OFFER_OWN', 'You cannot answer your own draw offer');
    }
    await this.prisma.$transaction(async (tx) => {
      const answered = await tx.drawOffer.updateMany({
        where: { id: pending.id, status: DrawOfferStatus.PENDING },
        data: { status: accept ? DrawOfferStatus.ACCEPTED : DrawOfferStatus.DECLINED },
      });
      if (answered.count !== 1) {
        throw this.error(ConflictException, 'GAME_NO_DRAW_OFFER', 'The draw offer is no longer pending');
      }
      if (accept) {
        await this.finishInTx(tx, match, MatchResult.DRAW, MatchEndReason.DRAW_AGREEMENT);
      }
    });
    return this.getState(matchId, userId);
  }

  /**
   * Thông tin để gateway quyết định có giữ ván khi user rớt mạng không (XQA-93):
   * chỉ người chơi của ván đang ACTIVE; thời gian chờ lấy từ RuleProfile.reconnectGraceSec.
   */
  async presenceTarget(
    matchId: string,
    userId: string,
  ): Promise<{ active: boolean; color: PlayerColor | null; graceMs: number; opponentId: string | null }> {
    const match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    const opponentId = color ? (color === 'RED' ? match.blackPlayerId : match.redPlayerId).toString() : null;
    return {
      active: match.status === MatchStatus.ACTIVE,
      color,
      graceMs: match.ruleProfile.reconnectGraceSec * 1000,
      opponentId,
    };
  }

  /**
   * Hết thời gian chờ vào lại (FR-22): người mất kết nối thua, lý do DISCONNECT.
   * BR-RECON-01 (đề xuất, chờ PM duyệt): lúc hết hạn mà đối thủ cũng đang mất kết nối → tự hoãn ván thay vì ABORTED.
   * Trả null nếu ván không còn ACTIVE (đã kết thúc bằng cách khác trong lúc chờ).
   */
  async forfeitByDisconnect(matchId: string, userId: string): Promise<GameStateView | null> {
    const match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    if (!color || match.status !== MatchStatus.ACTIVE) return null;
    const opponentId = (color === 'RED' ? match.blackPlayerId : match.redPlayerId).toString();
    const bothGone = this.presence.isDisconnected(matchId, opponentId);
    if (bothGone) {
      return this.adjourn(matchId);
    }
    try {
      await this.prisma.$transaction((tx) =>
        this.finishInTx(tx, match, opponentWins(color), MatchEndReason.DISCONNECT),
      );
    } catch (error) {
      if (error instanceof ConflictException) return null;
      throw error;
    }
    this.presence.clear(matchId);
    return this.getState(matchId, opponentId);
  }

  /**
   * Hoãn ván cờ: tính thời gian đã dùng của bên đang tới lượt, trừ vào *TimeLeftMs,
   * đặt turnStartedAt = null, status = ADJOURNED, adjournedAt = now.
   * Huỷ hẹn giờ mất kết nối, đề nghị hòa đang chờ → EXPIRED. Không đổi Elo.
   */
  async adjourn(matchId: string, userId?: string): Promise<GameStateView> {
    const match = await this.loadMatch(matchId);
    let color: PlayerColor | null = null;
    if (userId !== undefined) {
      color = this.colorOf(match, userId);
      if (!color) {
        throw this.error(ForbiddenException, 'GAME_NOT_PLAYER', 'You are not a player in this match');
      }
    }
    if (match.status !== MatchStatus.ACTIVE) {
      throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'The match is not active');
    }
    if (userId !== undefined && color) {
      const opponentId = (color === 'RED' ? match.blackPlayerId : match.redPlayerId).toString();
      if (!this.presence.isDisconnected(matchId, opponentId)) {
        throw this.error(ConflictException, 'OPPONENT_CONNECTED', 'Opponent is still connected');
      }
    }

    const now = new Date();
    const running = this.runningClock(match, now);
    const frozen = running
      ? running.color === 'RED'
        ? { redTimeLeftMs: BigInt(running.leftMs) }
        : { blackTimeLeftMs: BigInt(running.leftMs) }
      : {};

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.match.updateMany({
        where: { id: match.id, status: MatchStatus.ACTIVE },
        data: {
          status: MatchStatus.ADJOURNED,
          turnStartedAt: null,
          adjournedAt: now,
          ...frozen,
        },
      });
      if (claimed.count !== 1) {
        throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'The match has already ended');
      }
      await tx.drawOffer.updateMany({
        where: { matchId: match.id, status: DrawOfferStatus.PENDING },
        data: { status: DrawOfferStatus.EXPIRED },
      });
    });

    this.presence.clearTimers(match.id.toString());
    return this.getState(matchId, userId ?? match.redPlayerId.toString());
  }

  /**
   * Chơi tiếp ván hoãn khi cả 2 người đã có socket trong ván:
   * status = ACTIVE, turnStartedAt = now.
   */
  async resumeAdjourned(matchId: string, userId: string): Promise<GameStateView> {
    const now = new Date();
    await this.prisma.match.updateMany({
      where: { id: BigInt(matchId), status: MatchStatus.ADJOURNED },
      data: {
        status: MatchStatus.ACTIVE,
        turnStartedAt: now,
      },
    });
    return this.getState(matchId, userId);
  }

  /**
   * Danh sách ván hoãn của người dùng (GET /me/adjourned-matches).
   */
  async listAdjournedMatches(userId: string): Promise<AdjournedMatchItem[]> {
    const me = BigInt(userId);
    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.ADJOURNED,
        OR: [{ redPlayerId: me }, { blackPlayerId: me }],
      },
      orderBy: [{ adjournedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        adjournedAt: true,
        currentPly: true,
        redPlayerId: true,
        blackPlayerId: true,
        room: { select: { roomCode: true } },
        redPlayer: { select: { id: true, username: true, displayName: true, rating: true, avatarUrl: true } },
        blackPlayer: { select: { id: true, username: true, displayName: true, rating: true, avatarUrl: true } },
      },
    });

    return matches.map((m) => {
      const isRed = m.redPlayerId === me;
      const opp = isRed ? m.blackPlayer : m.redPlayer;
      const color: PlayerColor = isRed ? 'RED' : 'BLACK';
      return {
        matchId: m.id.toString(),
        roomCode: m.room.roomCode,
        opponent: {
          id: opp.id.toString(),
          username: opp.username,
          displayName: opp.displayName,
          rating: opp.rating,
          avatarUrl: opp.avatarUrl ?? null,
        },
        myColor: color,
        plyCount: m.currentPly,
        adjournedAt: m.adjournedAt,
      };
    });
  }

  /**
   * XQA-30: Báo cáo người chơi đối thủ trong ván cờ.
   * - Chỉ người chơi trong ván mới được báo cáo đối thủ.
   * - Mỗi người chỉ được báo cáo 1 lần / ván (409 REPORT_DUPLICATE).
   * - Lý do theo enum ReportReason, mô tả tối đa 500 ký tự Unicode (400 VALIDATION_ERROR).
   */
  async createReport(matchId: string, userId: string, dto: CreateReportDto): Promise<ReportView> {
    if (!/^\d+$/.test(matchId)) {
      throw this.notFound();
    }
    const match = await this.prisma.match.findUnique({
      where: { id: BigInt(matchId) },
      select: { id: true, redPlayerId: true, blackPlayerId: true },
    });
    if (!match) throw this.notFound();

    const userBigInt = BigInt(userId);
    const isRed = match.redPlayerId === userBigInt;
    const isBlack = match.blackPlayerId === userBigInt;
    if (!isRed && !isBlack) {
      throw this.error(ForbiddenException, 'GAME_NOT_PLAYER', 'You are not a player of this match');
    }
    const reportedUserId = isRed ? match.blackPlayerId : match.redPlayerId;
    if (reportedUserId === userBigInt) {
      throw this.error(BadRequestException, 'VALIDATION_ERROR', 'Cannot report yourself');
    }

    const existing = await this.prisma.report.findFirst({
      where: {
        matchId: match.id,
        reporterId: userBigInt,
      },
    });
    if (existing) {
      throw this.error(ConflictException, 'REPORT_DUPLICATE', 'Bạn đã báo cáo ván này rồi.');
    }

    let description: string | null = null;
    if (dto.description !== undefined && dto.description !== null) {
      const trimmed = dto.description.trim();
      if (Array.from(trimmed).length > 500) {
        throw this.error(BadRequestException, 'VALIDATION_ERROR', 'Mô tả không được vượt quá 500 ký tự');
      }
      description = trimmed || null;
    }

    try {
      const report = await this.prisma.report.create({
        data: {
          matchId: match.id,
          reporterId: userBigInt,
          reportedUserId,
          reason: dto.reason,
          description,
          status: ReportStatus.OPEN,
        },
      });

      return {
        id: report.id.toString(),
        matchId: report.matchId.toString(),
        reporterId: report.reporterId.toString(),
        reportedUserId: report.reportedUserId.toString(),
        reason: report.reason,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.error(ConflictException, 'REPORT_DUPLICATE', 'Bạn đã báo cáo ván này rồi.');
      }
      throw err;
    }
  }

  /**
   * Chốt kết quả cho ván không do nước đi (xin thua, hòa, mất kết nối – XQA-93).
   * Chỉ chạy khi ván còn ACTIVE; ván đã kết thúc → GAME_NOT_ACTIVE, kết quả cũ giữ nguyên.
   */
  private async finishInTx(
    tx: Tx,
    match: MatchRow,
    result: MatchResult | null,
    endReason: MatchEndReason,
    status: MatchStatus = MatchStatus.FINISHED,
  ): Promise<void> {
    const now = new Date();
    // Dừng đồng hồ: ghi lại thời gian còn lại của bên đang tới lượt tại lúc kết thúc
    const running = this.runningClock(match, now);
    const frozen = running
      ? running.color === 'RED'
        ? { redTimeLeftMs: BigInt(running.leftMs) }
        : { blackTimeLeftMs: BigInt(running.leftMs) }
      : {};
    const claimed = await tx.match.updateMany({
      where: { id: match.id, status: { in: [MatchStatus.ACTIVE, MatchStatus.ADJOURNED] } },
      data: { status, result, endReason, endedAt: now, ...frozen },
    });
    if (claimed.count !== 1) {
      throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'The match has already ended');
    }
    await this.afterFinish(tx, match, result, status);
  }

  /** Việc phụ khi ván kết thúc: phòng → FINISHED, đề nghị hòa còn chờ → EXPIRED, tính điểm Elo (XQA-40). */
  private async afterFinish(
    tx: Tx,
    match: Pick<MatchRow, 'id' | 'roomId' | 'redPlayerId' | 'blackPlayerId'>,
    result: MatchResult | null,
    status: MatchStatus = MatchStatus.FINISHED,
  ): Promise<void> {
    await tx.room.updateMany({
      where: { id: match.roomId, status: RoomStatus.PLAYING },
      data: { status: RoomStatus.FINISHED },
    });
    await tx.drawOffer.updateMany({
      where: { matchId: match.id, status: DrawOfferStatus.PENDING },
      data: { status: DrawOfferStatus.EXPIRED },
    });

    if (status === MatchStatus.FINISHED && result !== null) {
      const existing = await tx.ratingHistory.findFirst({
        where: { matchId: match.id },
      });
      if (!existing) {
        const [redUser, blackUser] = await Promise.all([
          tx.user.findUnique({ where: { id: match.redPlayerId }, select: { rating: true } }),
          tx.user.findUnique({ where: { id: match.blackPlayerId }, select: { rating: true } }),
        ]);
        if (redUser && blackUser) {
          const actualScoreRed =
            result === MatchResult.RED_WIN ? 1 : result === MatchResult.BLACK_WIN ? 0 : 0.5;
          const { newRatingA: newRatingRed, newRatingB: newRatingBlack } =
            calculateElo(redUser.rating, blackUser.rating, actualScoreRed);

          await Promise.all([
            tx.user.update({
              where: { id: match.redPlayerId },
              data: { rating: newRatingRed },
            }),
            tx.user.update({
              where: { id: match.blackPlayerId },
              data: { rating: newRatingBlack },
            }),
            tx.ratingHistory.create({
              data: {
                userId: match.redPlayerId,
                matchId: match.id,
                ratingBefore: redUser.rating,
                ratingAfter: newRatingRed,
              },
            }),
            tx.ratingHistory.create({
              data: {
                userId: match.blackPlayerId,
                matchId: match.id,
                ratingBefore: blackUser.rating,
                ratingAfter: newRatingBlack,
              },
            }),
          ]);
        }
      }
    }
  }

  /** Người chơi của ván + ván đang ACTIVE (ván WAITING được bắt đầu như khi đi nước đầu). */
  private async activeMatchFor(
    matchId: string,
    userId: string,
    allowAdjourned = false,
  ): Promise<{ match: MatchRow; color: PlayerColor }> {
    let match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    if (!color) {
      throw this.error(ForbiddenException, 'GAME_NOT_PLAYER', 'You are not a player in this match');
    }
    if (match.status === MatchStatus.WAITING) {
      match = await this.start(match);
    }
    const isValid = match.status === MatchStatus.ACTIVE || (allowAdjourned && match.status === MatchStatus.ADJOURNED);
    if (!isValid || (match.status === MatchStatus.ACTIVE && (await this.finishIfFlagged(match)))) {
      throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'The match has already ended');
    }
    return { match, color };
  }

  /** Người chơi đã đi ít nhất 1 nước sau ply `since` chưa. */
  private hasMovedSince(match: MatchRow, userId: string, since: number): boolean {
    const color = this.colorOf(match, userId);
    // Đỏ đi các ply lẻ (1, 3, ...), Đen đi các ply chẵn (2, 4, ...)
    const parity = color === 'RED' ? 1 : 0;
    return match.moves.some((m) => m.ply > since && m.ply % 2 === parity);
  }

  /** Tìm ván đang diễn ra (hoặc vừa tạo) của một phòng – dùng khi FE chỉ biết mã phòng. */
  async findMatchIdByRoom(roomCode: string): Promise<string> {
    const match = await this.prisma.match.findFirst({
      where: { room: { roomCode: roomCode.trim().toUpperCase() } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    if (!match) throw this.notFound();
    return match.id.toString();
  }

  private async start(match: MatchRow): Promise<MatchRow> {
    const now = new Date();
    await this.prisma.match.updateMany({
      where: { id: match.id, status: MatchStatus.WAITING },
      data: {
        status: MatchStatus.ACTIVE,
        currentFen: STARTING_FEN,
        currentPly: 0,
        startedAt: now,
        turnStartedAt: now,
      },
    });
    return this.loadMatch(match.id.toString());
  }

  private async loadMatch(matchId: string): Promise<MatchRow> {
    if (!/^\d+$/.test(matchId)) throw this.notFound();
    const match = await this.prisma.match.findUnique({
      where: { id: BigInt(matchId) },
      select: matchSelect,
    });
    if (!match) throw this.notFound();
    return match;
  }

  /** Dựng lại thế cờ + lịch sử lặp từ thế khởi đầu và toàn bộ nước đã lưu. */
  private replay(match: MatchRow): Replay {
    const position = Position.fromFen(STARTING_FEN);
    const judge = new RepetitionJudge(position, {
      threshold: match.ruleProfile.repetitionThreshold,
    });
    let lastVerdict: RepetitionVerdict | null = null;
    for (const m of match.moves) {
      const move = { from: algebraicToSquare(m.fromSq), to: algebraicToSquare(m.toSq) };
      lastVerdict = judge.play(move);
      position.applyMove(move);
    }
    return { position, judge, lastVerdict };
  }

  private colorOf(match: MatchRow, userId: string): PlayerColor | null {
    if (match.redPlayerId.toString() === userId) return 'RED';
    if (match.blackPlayerId.toString() === userId) return 'BLACK';
    return null;
  }

  /** Thời gian suy nghĩ của lượt hiện tại tính tới `now` (lưu lịch sử + trừ đồng hồ). */
  private thinkTime(match: MatchRow, now: Date): number {
    if (!match.turnStartedAt) return 0;
    return Math.max(0, now.getTime() - match.turnStartedAt.getTime());
  }

  /** Thời gian còn lại (ms) của một bên tại mốc turnStartedAt, như đang lưu trong DB. */
  private clockOf(match: Pick<MatchRow, 'redTimeLeftMs' | 'blackTimeLeftMs'>, color: PlayerColor): number {
    return Number(color === 'RED' ? match.redTimeLeftMs : match.blackTimeLeftMs);
  }

  /**
   * Đồng hồ đang chạy của ván ACTIVE: bên tới lượt (Đỏ đi ở ply chẵn) và thời gian còn lại tính tới `now`.
   * null nếu ván không ACTIVE hoặc chưa bắt đầu tính giờ.
   */
  private runningClock(
    match: Pick<MatchRow, 'status' | 'currentPly' | 'redTimeLeftMs' | 'blackTimeLeftMs' | 'turnStartedAt'>,
    now: Date,
  ): { color: PlayerColor; leftMs: number } | null {
    if (match.status !== MatchStatus.ACTIVE || !match.turnStartedAt) return null;
    const color: PlayerColor = match.currentPly % 2 === 0 ? 'RED' : 'BLACK';
    const elapsed = Math.max(0, now.getTime() - match.turnStartedAt.getTime());
    return { color, leftMs: Math.max(0, this.clockOf(match, color) - elapsed) };
  }

  /**
   * Bên tới lượt đã hết giờ → chốt TIMEOUT (bên đó thua). Trả true nếu ván vừa được chốt ở đây
   * hoặc đã bị request khác chốt trước (ván không còn ACTIVE).
   */
  private async finishIfFlagged(match: MatchRow): Promise<boolean> {
    const running = this.runningClock(match, new Date());
    if (!running || running.leftMs > 0) return false;
    try {
      await this.prisma.$transaction((tx) =>
        this.finishInTx(tx, match, opponentWins(running.color), MatchEndReason.TIMEOUT),
      );
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
    }
    this.presence.clear(match.id.toString());
    return true;
  }

  private toView(match: MatchRow, replay: Replay, yourColor: PlayerColor | null): GameStateView {
    const ended = match.status === MatchStatus.FINISHED || match.status === MatchStatus.ABORTED;
    const moves: GameMoveView[] = match.moves.map((m) => ({
      ply: m.ply,
      from: m.fromSq,
      to: m.toSq,
      piece: m.pieceCode,
      captured: m.capturedPieceCode,
      isCheck: m.isCheck,
    }));
    const verdictResult = replay.lastVerdict?.result;
    const endRule =
      match.endReason === MatchEndReason.REPETITION &&
      verdictResult &&
      verdictResult.kind !== 'undetermined'
        ? verdictResult.rule
        : null;

    const redHist = match.ratingHistory?.find((r) => r.userId === match.redPlayerId);
    const blackHist = match.ratingHistory?.find((r) => r.userId === match.blackPlayerId);
    const ratings =
      redHist && blackHist
        ? {
            red: {
              before: redHist.ratingBefore,
              after: redHist.ratingAfter,
              delta: redHist.ratingAfter - redHist.ratingBefore,
            },
            black: {
              before: blackHist.ratingBefore,
              after: blackHist.ratingAfter,
              delta: blackHist.ratingAfter - blackHist.ratingBefore,
            },
          }
        : null;

    return {
      matchId: match.id.toString(),
      roomCode: match.room.roomCode,
      status: match.status,
      fen: match.currentFen ?? STARTING_FEN,
      ply: match.currentPly,
      turn: ended ? null : replay.position.sideToMove === 'r' ? 'RED' : 'BLACK',
      inCheck: replay.position.isCheck(),
      result: match.result,
      endReason: match.endReason,
      endRule,
      ratings,
      red: this.toPlayer(match.redPlayer),
      black: this.toPlayer(match.blackPlayer),
      yourColor,
      lastMove: moves[moves.length - 1] ?? null,
      moves,
      drawOffer: ended ? null : this.toDrawOffer(match),
      disconnected: ended ? [] : this.toDisconnected(match),
      ...this.clockView(match),
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      adjournedAt: match.adjournedAt,
    };
  }

  /** Đồng hồ cho client: thời gian còn lại tại `serverTime`; client chỉ đếm lùi bên `clockRunning` để hiển thị. */
  private clockView(
    match: MatchRow,
  ): Pick<GameStateView, 'redTimeLeftMs' | 'blackTimeLeftMs' | 'clockRunning' | 'incrementMs' | 'serverTime'> {
    const now = new Date();
    const running = this.runningClock(match, now);
    return {
      redTimeLeftMs: running?.color === 'RED' ? running.leftMs : this.clockOf(match, 'RED'),
      blackTimeLeftMs: running?.color === 'BLACK' ? running.leftMs : this.clockOf(match, 'BLACK'),
      clockRunning: running?.color ?? null,
      incrementMs: match.ruleProfile.incrementSec * 1000,
      serverTime: now.toISOString(),
    };
  }

  private toDisconnected(match: MatchRow): DisconnectedPlayerView[] {
    const list: DisconnectedPlayerView[] = [];
    for (const d of this.presence.disconnected(match.id.toString())) {
      const color = this.colorOf(match, d.userId);
      if (color) list.push({ color, deadline: d.deadline });
    }
    return list;
  }

  private toDrawOffer(match: MatchRow): DrawOfferView | null {
    const pending = match.drawOffers[0];
    if (!pending) return null;
    const by = this.colorOf(match, pending.offeredBy.toString());
    return by ? { by, atPly: pending.atPly } : null;
  }

  private toPlayer(p: MatchRow['redPlayer']): GamePlayer {
    return { id: p.id.toString(), username: p.username, displayName: p.displayName, rating: p.rating };
  }

  private notFound(): NotFoundException {
    return this.error(NotFoundException, 'GAME_NOT_FOUND', 'Match does not exist');
  }

  private error<T extends HttpException>(
    Type: new (body: object) => T,
    code: string,
    message: string,
  ): T {
    const instance = new Type({ code, message });
    const status = instance.getStatus();
    return new Type({
      statusCode: status,
      error: status === 400 ? 'Bad Request' : status === 403 ? 'Forbidden' : status === 404 ? 'Not Found' : 'Conflict',
      code,
      message,
    });
  }
}

