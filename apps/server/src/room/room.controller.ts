import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateRoomDto } from './room.dto';
import { RoomService } from './room.service';
import { RoomDetailResponse, RoomSummaryResponse } from './room.types';

/** Contract: docs/api/room.md. Mọi endpoint cần đăng nhập. */
@Controller('rooms')
@UseGuards(AuthJwtGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  list(): Promise<RoomSummaryResponse[]> {
    return this.roomService.listWaiting();
  }

  /** Khai báo trước `:code` để "current" không bị hiểu là mã phòng. */
  @Get('current')
  async current(@Req() request: AuthenticatedRequest): Promise<{ room: RoomDetailResponse | null }> {
    return { room: await this.roomService.getCurrent(request.user.sub) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomDetailResponse> {
    return this.roomService.create(request.user.sub, dto);
  }

  @Get(':code')
  detail(@Param('code') code: string): Promise<RoomDetailResponse> {
    return this.roomService.getByCode(code);
  }

  @Post(':code/join')
  @HttpCode(HttpStatus.OK)
  join(@Req() request: AuthenticatedRequest, @Param('code') code: string): Promise<RoomDetailResponse> {
    return this.roomService.join(request.user.sub, code);
  }

  @Post(':code/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@Req() request: AuthenticatedRequest, @Param('code') code: string): Promise<void> {
    return this.roomService.leave(request.user.sub, code);
  }
}
