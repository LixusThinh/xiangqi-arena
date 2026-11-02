import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiGameLevel, AiGameStatus, Prisma } from '@prisma/client';
import {
  algebraicToSquare,
  Position,
  STARTING_FEN,
} from '@xiangqi-arena/xiangqi-core';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiGameDto, UpdateAiGameDto } from './ai-game.dto';
import {
  AiGameDetailResponse,
  AiGameMove,
  AiGameSummaryResponse,
} from './ai-game.types';

@Injectable()
export class AiGameService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAiGameDto): Promise<AiGameDetailResponse> {
    const userBigInt = BigInt(userId);
    const inProgressCount = await this.prisma.aiGame.count({
      where: {
        userId: userBigInt,
        status: AiGameStatus.IN_PROGRESS,
      },
    });

    if (inProgressCount >= 10) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'AI_GAME_LIMIT',
        message: 'Mỗi người chơi chỉ được lưu tối đa 10 ván đang chơi.',
      });
    }

    const game = await this.prisma.aiGame.create({
      data: {
        userId: userBigInt,
        level: dto.level,
        playerColor: dto.playerColor,
        initialFen: STARTING_FEN,
        currentFen: STARTING_FEN,
        moves: [],
        plyCount: 0,
        status: AiGameStatus.IN_PROGRESS,
        result: null,
      },
    });

    return this.toDetail(game);
  }

  async list(userId: string, status?: AiGameStatus): Promise<AiGameSummaryResponse[]> {
    const userBigInt = BigInt(userId);
    const where: Prisma.AiGameWhereInput = {
      userId: userBigInt,
      ...(status ? { status } : {}),
    };

    const rows = await this.prisma.aiGame.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        level: true,
        playerColor: true,
        plyCount: true,
        updatedAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id.toString(),
      level: r.level as AiGameLevel,
      playerColor: r.playerColor,
      plyCount: r.plyCount,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    }));
  }

  async get(userId: string, id: string): Promise<AiGameDetailResponse> {
    if (!/^\d+$/.test(id)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'AI_GAME_NOT_FOUND',
        message: 'Không tìm thấy ván chơi',
      });
    }

    const game = await this.prisma.aiGame.findFirst({
      where: {
        id: BigInt(id),
        userId: BigInt(userId),
      },
    });

    if (!game) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'AI_GAME_NOT_FOUND',
        message: 'Không tìm thấy ván chơi',
      });
    }

    return this.toDetail(game);
  }

  async update(userId: string, id: string, dto: UpdateAiGameDto): Promise<AiGameDetailResponse> {
    if (!/^\d+$/.test(id)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'AI_GAME_NOT_FOUND',
        message: 'Không tìm thấy ván chơi',
      });
    }

    const game = await this.prisma.aiGame.findFirst({
      where: {
        id: BigInt(id),
        userId: BigInt(userId),
      },
    });

    if (!game) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'AI_GAME_NOT_FOUND',
        message: 'Không tìm thấy ván chơi',
      });
    }

    if (game.status === AiGameStatus.FINISHED) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'AI_GAME_FINISHED',
        message: 'Ván chơi đã kết thúc, không thể lưu thêm nước đi.',
      });
    }

    const pos = Position.fromFen(game.initialFen);
    for (let i = 0; i < dto.moves.length; i++) {
      const m = dto.moves[i];
      let fromSq: number;
      let toSq: number;
      try {
        fromSq = algebraicToSquare(m.from);
        toSq = algebraicToSquare(m.to);
      } catch {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: `Nước thứ ${i + 1} không hợp lệ: toạ độ sai`,
          details: [{ moveIndex: i + 1, move: m }],
        });
      }

      const move = { from: fromSq, to: toSq };
      if (!pos.isLegalMove(move)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: `Nước thứ ${i + 1} không hợp lệ theo luật cờ`,
          details: [{ moveIndex: i + 1, move: m }],
        });
      }

      pos.applyMove(move);
    }

    const currentFen = pos.toFen();
    const plyCount = dto.moves.length;

    const updated = await this.prisma.aiGame.update({
      where: { id: game.id },
      data: {
        moves: dto.moves as unknown as Prisma.InputJsonValue,
        currentFen,
        plyCount,
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.result !== undefined ? { result: dto.result } : {}),
      },
    });

    return this.toDetail(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!/^\d+$/.test(id)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'AI_GAME_NOT_FOUND',
        message: 'Không tìm thấy ván chơi',
      });
    }

    const game = await this.prisma.aiGame.findFirst({
      where: {
        id: BigInt(id),
        userId: BigInt(userId),
      },
    });

    if (!game) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'AI_GAME_NOT_FOUND',
        message: 'Không tìm thấy ván chơi',
      });
    }

    await this.prisma.aiGame.delete({
      where: { id: game.id },
    });
  }

  private toDetail(game: {
    id: bigint;
    userId: bigint;
    level: string | AiGameLevel;
    playerColor: string;
    initialFen: string;
    moves: unknown;
    currentFen: string;
    plyCount: number;
    status: string | AiGameStatus;
    result: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): AiGameDetailResponse {
    return {
      id: game.id.toString(),
      userId: game.userId.toString(),
      level: game.level as AiGameLevel,
      playerColor: game.playerColor,
      initialFen: game.initialFen,
      moves: (Array.isArray(game.moves) ? game.moves : []) as AiGameMove[],
      currentFen: game.currentFen,
      plyCount: game.plyCount,
      status: game.status as AiGameStatus,
      result: game.result,
      createdAt: game.createdAt instanceof Date ? game.createdAt.toISOString() : String(game.createdAt),
      updatedAt: game.updatedAt instanceof Date ? game.updatedAt.toISOString() : String(game.updatedAt),
    };
  }
}
