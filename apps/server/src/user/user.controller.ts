import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateProfileDto } from './user.dto';
import { UserService } from './user.service';
import { UpdatedProfileResponse, UserProfileResponse } from './user.types';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Lấy thông tin hồ sơ công khai của người chơi theo username (công khai, không cần đăng nhập).
   */
  @Get('users/:username/profile')
  getProfile(@Param('username') username: string): Promise<UserProfileResponse> {
    return this.userService.getProfile(username);
  }

  /**
   * Cập nhật thông tin hồ sơ của bản thân (cần đăng nhập).
   */
  @Patch('me/profile')
  @UseGuards(AuthJwtGuard)
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<UpdatedProfileResponse> {
    return this.userService.updateProfile(req.user.sub, dto);
  }
}
