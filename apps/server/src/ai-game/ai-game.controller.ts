import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateAiGameDto, ListAiGameQueryDto, UpdateAiGameDto } from './ai-game.dto';
import { AiGameService } from './ai-game.service';
import { AiGameDetailResponse, AiGameSummaryResponse } from './ai-game.types';

@Controller('ai-games')
@UseGuards(AuthJwtGuard)
export class AiGameController {
  constructor(private readonly aiGameService: AiGameService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAiGameDto,
  ): Promise<AiGameDetailResponse> {
    return this.aiGameService.create(req.user.sub, dto);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListAiGameQueryDto,
  ): Promise<AiGameSummaryResponse[]> {
    return this.aiGameService.list(req.user.sub, query.status);
  }

  @Get(':id')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AiGameDetailResponse> {
    return this.aiGameService.get(req.user.sub, id);
  }

  @Put(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAiGameDto,
  ): Promise<AiGameDetailResponse> {
    return this.aiGameService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    return this.aiGameService.delete(req.user.sub, id);
  }
}
