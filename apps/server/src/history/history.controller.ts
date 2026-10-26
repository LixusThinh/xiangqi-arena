import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { HistoryQueryDto } from './history.dto';
import { HistoryService } from './history.service';
import { MatchHistoryDetail, MatchHistoryPage } from './history.types';

/** Lịch sử ván của chính người đăng nhập. Contract: docs/api/history.md. */
@Controller('me/matches')
@UseGuards(AuthJwtGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() query: HistoryQueryDto): Promise<MatchHistoryPage> {
    return this.historyService.list(req.user.sub, query.page, query.pageSize);
  }

  @Get(':id')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<MatchHistoryDetail> {
    return this.historyService.detail(req.user.sub, id);
  }
}
