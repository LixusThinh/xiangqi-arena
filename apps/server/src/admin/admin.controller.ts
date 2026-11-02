import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  MatchQueryDto,
  ReportQueryDto,
  UpdateReportStatusDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './admin.dto';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  AdminDashboardData,
  AdminMatchDetail,
  AdminMatchesPage,
  AdminReportItem,
  AdminReportsPage,
  AdminUserItem,
  AdminUsersPage,
} from './admin.types';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard(): Promise<AdminDashboardData> {
    return this.adminService.getDashboard();
  }

  @Get('users')
  getUsers(@Query() query: UserQueryDto): Promise<AdminUsersPage> {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  updateUserStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<AdminUserItem> {
    return this.adminService.updateUserStatus(req.user.sub, id, dto.status);
  }

  @Get('matches')
  getMatches(@Query() query: MatchQueryDto): Promise<AdminMatchesPage> {
    return this.adminService.getMatches(query);
  }

  @Get('matches/:id')
  getMatchDetail(@Param('id') id: string): Promise<AdminMatchDetail> {
    return this.adminService.getMatchDetail(id);
  }

  @Get('reports')
  getReports(@Query() query: ReportQueryDto): Promise<AdminReportsPage> {
    return this.adminService.getReports(query);
  }

  @Patch('reports/:id')
  @HttpCode(HttpStatus.OK)
  updateReportStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ): Promise<AdminReportItem> {
    return this.adminService.updateReportStatus(req.user.sub, id, dto.status);
  }
}
