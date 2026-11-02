import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardQueryDto } from './leaderboard.dto';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardPage } from './leaderboard.types';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Query() query: LeaderboardQueryDto): Promise<LeaderboardPage> {
    return this.leaderboardService.getLeaderboard(query.page, query.pageSize);
  }
}
