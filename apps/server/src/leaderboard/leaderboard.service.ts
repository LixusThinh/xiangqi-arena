import { Injectable } from '@nestjs/common';
import { AccountStatus, MatchStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LEADERBOARD_DEFAULT_PAGE_SIZE } from './leaderboard.dto';
import { LeaderboardItem, LeaderboardPage } from './leaderboard.types';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(
    page = 1,
    pageSize = LEADERBOARD_DEFAULT_PAGE_SIZE,
  ): Promise<LeaderboardPage> {
    const where: Prisma.UserWhereInput = {
      accountStatus: AccountStatus.ACTIVE,
      role: UserRole.PLAYER,
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ rating: 'desc' }, { username: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          displayName: true,
          rating: true,
        },
      }),
    ]);

    const items: LeaderboardItem[] = await Promise.all(
      users.map(async (u, idx) => {
        const gamesPlayed = await this.prisma.match.count({
          where: {
            status: MatchStatus.FINISHED,
            OR: [{ redPlayerId: u.id }, { blackPlayerId: u.id }],
          },
        });
        return {
          rank: (page - 1) * pageSize + idx + 1,
          id: u.id.toString(),
          username: u.username,
          displayName: u.displayName,
          rating: u.rating,
          gamesPlayed,
        };
      }),
    );

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
