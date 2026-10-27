import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HostColorPref, Prisma, RoomStatus, RoomVisibility } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './room.dto';
import {
  DEFAULT_RULE_PROFILE_CODE,
  ROOM_CAPACITY,
  RoomDetailResponse,
  RoomMemberResponse,
  RoomPlayerResponse,
  RoomSummaryResponse,
  SeatColor,
} from './room.types';

/** Bỏ chữ dễ nhầm (I, O, 0, 1) để người chơi đọc mã phòng cho nhau không sai. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 8;
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
const MAX_CODE_ATTEMPTS = 5;
const LOBBY_LIMIT = 50;
const ACTIVE_STATUSES: RoomStatus[] = [RoomStatus.WAITING, RoomStatus.PLAYING];

const playerSelect = {
  id: true,
  username: true,
  displayName: true,
  rating: true,
} as const;

const summarySelect = {
  roomCode: true,
  name: true,
  visibility: true,
  status: true,
  hostColorPref: true,
  createdAt: true,
  ruleProfile: {
    select: { code: true, baseTimeSec: true, incrementSec: true, isRanked: true },
  },
  host: { select: playerSelect },
  members: { select: { userId: true } },
} as const;

const detailSelect = {
  ...summarySelect,
  hostId: true,
  members: {
    orderBy: { joinedAt: 'asc' },
    select: { userId: true, joinedAt: true, user: { select: playerSelect } },
  },
  matches: {
    orderBy: { id: 'desc' },
    take: 1,
    select: { id: true, redPlayerId: true, blackPlayerId: true },
  },
} as const;

type RoomSummaryRow = Prisma.RoomGetPayload<{ select: typeof summarySelect }>;
type RoomDetailRow = Prisma.RoomGetPayload<{ select: typeof detailSelect }>;
type PlayerRow = Prisma.UserGetPayload<{ select: typeof playerSelect }>;

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách phòng công khai đang chờ đối thủ, mới nhất trước (màn Sảnh – XQA-70). */
  async listWaiting(): Promise<RoomSummaryResponse[]> {
    const rooms = await this.prisma.room.findMany({
      where: { status: RoomStatus.WAITING, visibility: RoomVisibility.PUBLIC },
      orderBy: { createdAt: 'desc' },
      take: LOBBY_LIMIT,
      select: summarySelect,
    });
    return rooms.map((room) => this.toSummary(room));
  }

  async getByCode(code: string): Promise<RoomDetailResponse> {
    const room = await this.prisma.room.findUnique({
      where: { roomCode: this.normalizeCode(code) },
      select: detailSelect,
    });
    if (!room) throw this.roomNotFound();
    return this.toDetail(room);
  }

  /** Phòng WAITING/PLAYING mà người dùng đang ở (để FE đưa người chơi quay lại phòng sau khi reload). */
  async getCurrent(userId: string): Promise<RoomDetailResponse | null> {
    const membership = await this.findActiveMembership(BigInt(userId));
    if (!membership) return null;
    return this.getByCode(membership.room.roomCode);
  }

  async create(userId: string, dto: CreateRoomDto): Promise<RoomDetailResponse> {
    const hostId = BigInt(userId);
    await this.ensureNotInActiveRoom(hostId);

    const profileCode = dto.ruleProfileCode ?? DEFAULT_RULE_PROFILE_CODE;
    const profile = await this.prisma.ruleProfile.findUnique({
      where: { code: profileCode },
      select: { id: true },
    });
    if (!profile) {
      throw this.validationError('ruleProfileCode', `rule profile "${profileCode}" does not exist`);
    }
    const host = await this.prisma.user.findUnique({
      where: { id: hostId },
      select: { displayName: true },
    });
    if (!host) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'AUTH_TOKEN_INVALID',
        message: 'Access token is invalid',
      });
    }

    const name = dto.name ?? `Phòng của ${host.displayName}`.slice(0, 80);
    for (let attempt = 1; ; attempt++) {
      const roomCode = this.generateCode();
      try {
        await this.prisma.$transaction(async (tx) => {
          const room = await tx.room.create({
            data: {
              roomCode,
              name,
              hostId,
              visibility: dto.visibility ?? RoomVisibility.PUBLIC,
              hostColorPref: dto.hostColorPref ?? HostColorPref.RANDOM,
              ruleProfileId: profile.id,
            },
            select: { id: true },
          });
          await tx.roomMember.create({ data: { roomId: room.id, userId: hostId } });
        });
        return this.getByCode(roomCode);
      } catch (error) {
        // Trùng mã phòng (xác suất rất nhỏ với 32^8 mã) → sinh mã khác
        const duplicateCode =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!duplicateCode || attempt >= MAX_CODE_ATTEMPTS) throw error;
      }
    }
  }

  /**
   * Vào phòng bằng mã (từ Sảnh hoặc link mời). Người thứ 2 vào → phòng PLAYING, chia màu, tạo Match.
   * Vào lại phòng mình đang ở trả về 200 (idempotent, ví dụ bấm link mời 2 lần).
   */
  async join(userId: string, code: string): Promise<RoomDetailResponse> {
    const uid = BigInt(userId);
    const roomCode = this.normalizeCode(code);
    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      select: {
        id: true,
        status: true,
        hostId: true,
        hostColorPref: true,
        ruleProfileId: true,
        ruleProfile: { select: { baseTimeSec: true } },
        members: { select: { userId: true } },
      },
    });
    if (!room) throw this.roomNotFound();
    if (room.members.some((m) => m.userId === uid)) {
      return this.getByCode(roomCode);
    }
    if (room.status === RoomStatus.FINISHED || room.status === RoomStatus.CANCELLED) {
      throw this.conflict('ROOM_CLOSED', 'Room has finished or was cancelled');
    }
    if (room.status === RoomStatus.PLAYING || room.members.length >= ROOM_CAPACITY) {
      throw this.roomFull();
    }
    await this.ensureNotInActiveRoom(uid);

    const { redPlayerId, blackPlayerId } = this.assignColors(room.hostColorPref, room.hostId, uid);
    const clockMs = BigInt(room.ruleProfile.baseTimeSec) * 1000n;
    await this.prisma.$transaction(async (tx) => {
      // Chuyển WAITING → PLAYING có điều kiện: 2 người bấm vào cùng lúc thì chỉ 1 người thắng,
      // người còn lại nhận ROOM_FULL (PostgreSQL khóa dòng khi UPDATE).
      const claimed = await tx.room.updateMany({
        where: { id: room.id, status: RoomStatus.WAITING },
        data: { status: RoomStatus.PLAYING },
      });
      if (claimed.count !== 1) throw this.roomFull();
      await tx.roomMember.create({ data: { roomId: room.id, userId: uid } });
      // Match tạo ở trạng thái WAITING; GameService (XQA-74) chuyển ACTIVE khi bắt đầu ván.
      await tx.match.create({
        data: {
          roomId: room.id,
          redPlayerId,
          blackPlayerId,
          ruleProfileId: room.ruleProfileId,
          redTimeLeftMs: clockMs,
          blackTimeLeftMs: clockMs,
        },
      });
    });
    return this.getByCode(roomCode);
  }

  /** Rời phòng khi ván chưa bắt đầu. Chủ phòng rời → phòng CANCELLED. */
  async leave(userId: string, code: string): Promise<void> {
    const uid = BigInt(userId);
    const room = await this.prisma.room.findUnique({
      where: { roomCode: this.normalizeCode(code) },
      select: { id: true, status: true, members: { select: { userId: true } } },
    });
    if (!room) throw this.roomNotFound();
    if (!room.members.some((m) => m.userId === uid)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ROOM_NOT_MEMBER',
        message: 'You are not in this room',
      });
    }
    if (room.status === RoomStatus.PLAYING) {
      throw this.conflict(
        'ROOM_ALREADY_STARTED',
        'The game has started; resign instead of leaving the room',
      );
    }
    if (room.status !== RoomStatus.WAITING) return; // phòng đã kết thúc/hủy: coi như đã rời

    // Phòng WAITING chỉ có chủ phòng (người thứ 2 vào là PLAYING ngay), nên rời = hủy phòng.
    await this.prisma.room.updateMany({
      where: { id: room.id, status: RoomStatus.WAITING },
      data: { status: RoomStatus.CANCELLED },
    });
  }

  private async ensureNotInActiveRoom(userId: bigint): Promise<void> {
    const membership = await this.findActiveMembership(userId);
    if (membership) {
      throw this.conflict(
        'ROOM_USER_BUSY',
        `You are already in room ${membership.room.roomCode}; leave it first`,
      );
    }
  }

  private findActiveMembership(userId: bigint) {
    return this.prisma.roomMember.findFirst({
      where: { userId, room: { status: { in: ACTIVE_STATUSES } } },
      select: { room: { select: { roomCode: true } } },
    });
  }

  private assignColors(
    pref: HostColorPref,
    hostId: bigint,
    guestId: bigint,
  ): { redPlayerId: bigint; blackPlayerId: bigint } {
    const hostColor: SeatColor =
      pref === HostColorPref.RED
        ? 'RED'
        : pref === HostColorPref.BLACK
          ? 'BLACK'
          : this.randomColor();
    return hostColor === 'RED'
      ? { redPlayerId: hostId, blackPlayerId: guestId }
      : { redPlayerId: guestId, blackPlayerId: hostId };
  }

  /** Tách riêng để test có thể cố định kết quả. */
  protected randomColor(): SeatColor {
    return randomInt(2) === 0 ? 'RED' : 'BLACK';
  }

  protected generateCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    return code;
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().toUpperCase();
    // Mã sai định dạng không thể tồn tại → trả 404 luôn, khỏi truy vấn DB
    if (!ROOM_CODE_PATTERN.test(normalized)) throw this.roomNotFound();
    return normalized;
  }

  private toPlayer(user: PlayerRow): RoomPlayerResponse {
    return {
      id: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
      rating: user.rating,
    };
  }

  private toSummary(room: RoomSummaryRow): RoomSummaryResponse {
    return {
      code: room.roomCode,
      name: room.name,
      visibility: room.visibility,
      status: room.status,
      hostColorPref: room.hostColorPref,
      ruleProfile: room.ruleProfile,
      host: this.toPlayer(room.host),
      playerCount: room.members.length,
      createdAt: room.createdAt,
    };
  }

  private toDetail(room: RoomDetailRow): RoomDetailResponse {
    const match = room.matches[0] ?? null;
    const colorOf = (userId: bigint): SeatColor | null => {
      if (!match) return null;
      if (match.redPlayerId === userId) return 'RED';
      if (match.blackPlayerId === userId) return 'BLACK';
      return null;
    };
    const members: RoomMemberResponse[] = room.members.map((m) => ({
      ...this.toPlayer(m.user),
      isHost: m.userId === room.hostId,
      color: colorOf(m.userId),
      joinedAt: m.joinedAt,
    }));
    return {
      ...this.toSummary(room),
      members,
      matchId: match ? match.id.toString() : null,
    };
  }

  private roomNotFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      error: 'Not Found',
      code: 'ROOM_NOT_FOUND',
      message: 'Room does not exist',
    });
  }

  private roomFull(): ConflictException {
    return this.conflict('ROOM_FULL', 'Room already has two players');
  }

  private conflict(code: string, message: string): HttpException {
    return new ConflictException({ statusCode: 409, error: 'Conflict', code, message });
  }

  private validationError(field: string, message: string): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field, message }],
    });
  }
}
