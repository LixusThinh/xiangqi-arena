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
import { PresenceService } from './presence.service';
import {
  DisconnectedPlayerView,
  DrawOfferView,
  GameMoveView,
  GamePlayer,
  GameStateView,
  MoveInput,
  PlayerColor,
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
  turnStartedAt: true,
  roomId: true,
  redPlayerId: true,
  blackPlayerId: true,
  room: { select: { roomCode: true } },
  ruleProfile: { select: { repetitionThreshold: true, reconnectGraceSec: true } },
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
 * - Chưa có: đồng hồ / hết giờ (XQA-141), Elo.
 * Transport (REST ở GameController, Socket.IO ở gateway XQA-75) chỉ gọi vào đây.
 */
@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  /** Trạng thái ván. Ván ở WAITING (vừa đủ 2 người) được bắt đầu ngay khi một người chơi mở. */
  async getState(matchId: string, userId: string): Promise<GameStateView> {
    let match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    if (match.status === MatchStatus.WAITING && color) {
      match = await this.start(match);
    }
    return this.toView(match, this.replay(match), color);
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

    await this.prisma.$transaction(async (tx) => {
      // Khóa lạc quan theo currentPly: request trùng / song song sẽ thấy count = 0
      const claimed = await tx.match.updateMany({
        where: { id: match.id, status: MatchStatus.ACTIVE, currentPly: match.currentPly },
        data: {
          currentFen: replay.position.toFen(),
          currentPly: ply,
          turnStartedAt: now,
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
      if (result) await this.afterFinish(tx, match);
    });

    return this.getState(matchId, userId);
  }

  /** Xin thua (FR-14): người gửi thua, đối thủ thắng, lý do RESIGNATION. */
  async resign(matchId: string, userId: string): Promise<GameStateView> {
    const { match, color } = await this.activeMatchFor(matchId, userId);
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
  ): Promise<{ active: boolean; color: PlayerColor | null; graceMs: number }> {
    const match = await this.loadMatch(matchId);
    return {
      active: match.status === MatchStatus.ACTIVE,
      color: this.colorOf(match, userId),
      graceMs: match.ruleProfile.reconnectGraceSec * 1000,
    };
  }

  /**
   * Hết thời gian chờ vào lại (FR-22): người mất kết nối thua, lý do DISCONNECT.
   * BR-RECON-01 (đề xuất, chờ PM duyệt): lúc hết hạn mà đối thủ cũng đang mất kết nối → ván ABORTED, không ai thắng.
   * Trả null nếu ván không còn ACTIVE (đã kết thúc bằng cách khác trong lúc chờ).
   */
  async forfeitByDisconnect(matchId: string, userId: string): Promise<GameStateView | null> {
    const match = await this.loadMatch(matchId);
    const color = this.colorOf(match, userId);
    if (!color || match.status !== MatchStatus.ACTIVE) return null;
    const opponentId = (color === 'RED' ? match.blackPlayerId : match.redPlayerId).toString();
    const bothGone = this.presence.isDisconnected(matchId, opponentId);
    try {
      await this.prisma.$transaction((tx) =>
        bothGone
          ? this.finishInTx(tx, match, null, MatchEndReason.DISCONNECT, MatchStatus.ABORTED)
          : this.finishInTx(tx, match, opponentWins(color), MatchEndReason.DISCONNECT),
      );
    } catch (error) {
      if (error instanceof ConflictException) return null;
      throw error;
    }
    this.presence.clear(matchId);
    return this.getState(matchId, opponentId);
  }

  /**
   * Chốt kết quả cho ván không do nước đi (xin thua, hòa, mất kết nối – XQA-93).
   * Chỉ chạy khi ván còn ACTIVE; ván đã kết thúc → GAME_NOT_ACTIVE, kết quả cũ giữ nguyên.
   */
  private async finishInTx(
    tx: Tx,
    match: Pick<MatchRow, 'id' | 'roomId'>,
    result: MatchResult | null,
    endReason: MatchEndReason,
    status: MatchStatus = MatchStatus.FINISHED,
  ): Promise<void> {
    const claimed = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.ACTIVE },
      data: { status, result, endReason, endedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw this.error(ConflictException, 'GAME_NOT_ACTIVE', 'The match has already ended');
    }
    await this.afterFinish(tx, match);
  }

  /** Việc phụ khi ván kết thúc: phòng → FINISHED, đề nghị hòa còn chờ → EXPIRED. */
  private async afterFinish(tx: Tx, match: Pick<MatchRow, 'id' | 'roomId'>): Promise<void> {
    await tx.room.updateMany({
      where: { id: match.roomId, status: RoomStatus.PLAYING },
      data: { status: RoomStatus.FINISHED },
    });
    await tx.drawOffer.updateMany({
      where: { matchId: match.id, status: DrawOfferStatus.PENDING },
      data: { status: DrawOfferStatus.EXPIRED },
    });
  }

  /** Người chơi của ván + ván đang ACTIVE (ván WAITING được bắt đầu như khi đi nước đầu). */
  private async activeMatchFor(
    matchId: string,
    userId: string,
  ): Promise<{ match: MatchRow; color: PlayerColor }> {
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

  /** Thời gian suy nghĩ của nước vừa đi (chỉ để lưu lịch sử; trừ đồng hồ thuộc XQA-141). */
  private thinkTime(match: MatchRow, now: Date): number {
    if (!match.turnStartedAt) return 0;
    return Math.max(0, now.getTime() - match.turnStartedAt.getTime());
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
      red: this.toPlayer(match.redPlayer),
      black: this.toPlayer(match.blackPlayer),
      yourColor,
      lastMove: moves[moves.length - 1] ?? null,
      moves,
      drawOffer: ended ? null : this.toDrawOffer(match),
      disconnected: ended ? [] : this.toDisconnected(match),
      redTimeLeftMs: Number(match.redTimeLeftMs),
      blackTimeLeftMs: Number(match.blackTimeLeftMs),
      startedAt: match.startedAt,
      endedAt: match.endedAt,
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

