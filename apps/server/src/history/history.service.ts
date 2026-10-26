import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchResult, MatchStatus, Prisma } from '@prisma/client';
import { STARTING_FEN } from '@xiangqi-arena/xiangqi-core';
import { PlayerColor } from '../game/game.types';
import { PrismaService } from '../prisma/prisma.service';
import { HISTORY_DEFAULT_PAGE_SIZE } from './history.dto';
import {
  HistoryMoveView,
  HistoryOutcome,
  MatchHistoryDetail,
  MatchHistoryItem,
  MatchHistoryPage,
} from './history.types';

const playerSelect = { id: true, username: true, displayName: true, rating: true } as const;

const historySelect = {
  id: true,
  result: true,
  endReason: true,
  currentPly: true,
  currentFen: true,
  startedAt: true,
  endedAt: true,
  redPlayerId: true,
  blackPlayerId: true,
  room: { select: { roomCode: true } },
  ruleProfile: { select: { code: true, isRanked: true } },
  redPlayer: { select: playerSelect },
  blackPlayer: { select: playerSelect },
} as const;

type HistoryRow = Prisma.MatchGetPayload<{ select: typeof historySelect }>;

/**
 * History API (XQA-97, Story XQA-27, FR-17). Contract: docs/api/history.md.
 *
 * - Chỉ trả ván FINISHED mà người gọi là Đỏ hoặc Đen. Ván người khác → 404, không lộ là ván có tồn tại.
 * - Ván đang diễn ra không nằm ở đây; FE đọc trạng thái ván đang chơi qua GET /matches/:id (XQA-74).
 * - Chi tiết ván trả đủ danh sách nước + FEN sau từng nước cho replay (XQA-33).
 */
@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, pageSize = HISTORY_DEFAULT_PAGE_SIZE): Promise<MatchHistoryPage> {
    const me = BigInt(userId);
    const where: Prisma.MatchWhereInput = {
      status: MatchStatus.FINISHED,
      OR: [{ redPlayerId: me }, { blackPlayerId: me }],
    };
    const [total, rows] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        // Ván kết thúc gần nhất lên đầu; id giảm dần để thứ tự ổn định khi trùng thời điểm
        orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: historySelect,
      }),
    ]);
    return {
      items: rows.map((row) => this.toItem(row, userId)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async detail(userId: string, matchId: string): Promise<MatchHistoryDetail> {
    if (!/^\d+$/.test(matchId)) throw this.notFound();
    const me = BigInt(userId);
    const id = BigInt(matchId);
    const row = await this.prisma.match.findFirst({
      where: {
        id,
        status: MatchStatus.FINISHED,
        OR: [{ redPlayerId: me }, { blackPlayerId: me }],
      },
      select: {
        ...historySelect,
        moves: {
          orderBy: { ply: 'asc' },
          select: {
            ply: true,
            fromSq: true,
            toSq: true,
            pieceCode: true,
            capturedPieceCode: true,
            isCheck: true,
            thinkTimeMs: true,
            fenAfter: true,
          },
        },
      },
    });
    if (!row) throw this.notFound();

    const rating = await this.prisma.ratingHistory.findFirst({
      where: { matchId: id, userId: me },
      orderBy: { id: 'desc' },
      select: { ratingBefore: true, ratingAfter: true },
    });

    const moves: HistoryMoveView[] = row.moves.map((m) => ({
      ply: m.ply,
      // Mọi ván bắt đầu từ STARTING_FEN, Đỏ đi trước → nửa nước lẻ là Đỏ
      color: m.ply % 2 === 1 ? 'RED' : 'BLACK',
      from: m.fromSq,
      to: m.toSq,
      piece: m.pieceCode,
      captured: m.capturedPieceCode,
      isCheck: m.isCheck,
      thinkTimeMs: m.thinkTimeMs,
      fenAfter: m.fenAfter,
    }));

    return {
      ...this.toItem(row, userId),
      initialFen: STARTING_FEN,
      finalFen: row.currentFen ?? moves[moves.length - 1]?.fenAfter ?? STARTING_FEN,
      ratingChange: rating
        ? {
            before: rating.ratingBefore,
            after: rating.ratingAfter,
            delta: rating.ratingAfter - rating.ratingBefore,
          }
        : null,
      moves,
    };
  }

  private toItem(row: HistoryRow, userId: string): MatchHistoryItem {
    const yourColor: PlayerColor = row.redPlayerId.toString() === userId ? 'RED' : 'BLACK';
    const opponent = yourColor === 'RED' ? row.blackPlayer : row.redPlayer;
    // Ván FINISHED luôn có result (GameService ghi cùng lúc với status)
    const result = row.result as MatchResult;
    return {
      matchId: row.id.toString(),
      roomCode: row.room.roomCode,
      ruleProfileCode: row.ruleProfile.code,
      isRanked: row.ruleProfile.isRanked,
      yourColor,
      opponent: {
        id: opponent.id.toString(),
        username: opponent.username,
        displayName: opponent.displayName,
        rating: opponent.rating,
      },
      outcome: outcomeFor(result, yourColor),
      result,
      endReason: row.endReason,
      plyCount: row.currentPly,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSec:
        row.startedAt && row.endedAt
          ? Math.max(0, Math.floor((row.endedAt.getTime() - row.startedAt.getTime()) / 1000))
          : null,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      error: 'Not Found',
      code: 'HISTORY_NOT_FOUND',
      message: 'Match does not exist in your history',
    });
  }
}

export function outcomeFor(result: MatchResult, color: PlayerColor): HistoryOutcome {
  if (result === MatchResult.DRAW) return 'DRAW';
  const redWon = result === MatchResult.RED_WIN;
  return (color === 'RED') === redWon ? 'WIN' : 'LOSS';
}
