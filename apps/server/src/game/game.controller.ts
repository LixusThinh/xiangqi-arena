import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { MoveDto } from './game.dto';
import { GameService } from './game.service';
import { GameStateView } from './game.types';

/**
 * REST cho ván cờ: đọc trạng thái (tải lại trang – NFR-07) và đi quân dự phòng.
 * Realtime đi qua Socket.IO gateway (XQA-75), gateway gọi cùng GameService.
 */
@Controller()
@UseGuards(AuthJwtGuard)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('matches/:id')
  state(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<GameStateView> {
    return this.gameService.getState(id, req.user.sub);
  }

  @Get('rooms/:code/match')
  async stateByRoom(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
  ): Promise<GameStateView> {
    const id = await this.gameService.findMatchIdByRoom(code);
    return this.gameService.getState(id, req.user.sub);
  }

  @Post('matches/:id/moves')
  @HttpCode(HttpStatus.OK)
  move(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ): Promise<GameStateView> {
    return this.gameService.makeMove(id, req.user.sub, dto);
  }

  // XQA-91: bản REST dự phòng của game:resign / game:draw-*. Không nhận body: kết quả do server tính.
  // REST không phát game:update cho đối thủ; FE dùng socket, REST để test và gọi tay.

  @Post('matches/:id/resign')
  @HttpCode(HttpStatus.OK)
  resign(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<GameStateView> {
    return this.gameService.resign(id, req.user.sub);
  }

  @Post('matches/:id/draw-offer')
  @HttpCode(HttpStatus.OK)
  offerDraw(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<GameStateView> {
    return this.gameService.offerDraw(id, req.user.sub);
  }

  @Post('matches/:id/draw-accept')
  @HttpCode(HttpStatus.OK)
  acceptDraw(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<GameStateView> {
    return this.gameService.respondDraw(id, req.user.sub, true);
  }

  @Post('matches/:id/draw-reject')
  @HttpCode(HttpStatus.OK)
  rejectDraw(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<GameStateView> {
    return this.gameService.respondDraw(id, req.user.sub, false);
  }
}
