import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, ReportStatus, UserRole } from '@prisma/client';
import { PresenceService } from '../game/presence.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MatchQueryDto,
  ReportQueryDto,
  UserQueryDto,
} from './admin.dto';
import {
  AdminDashboardData,
  AdminMatchDetail,
  AdminMatchesPage,
  AdminMatchItem,
  AdminReportItem,
  AdminReportsPage,
  AdminUserItem,
  AdminUsersPage,
} from './admin.types';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  /**
   * AC-31-03: Tìm kiếm người dùng theo username / email / displayName (không phân biệt hoa thường).
   */
  async getUsers(query: UserQueryDto): Promise<AdminUsersPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const search = query.q?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items: AdminUserItem[] = users.map((u) => ({
      id: u.id.toString(),
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      accountStatus: u.accountStatus,
      rating: u.rating,
      createdAt: u.createdAt.toISOString(),
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * AC-31-04, AC-31-05, AC-31-06, AC-31-07: Khóa / mở khóa tài khoản người dùng.
   * - Khóa thì thu hồi mọi auth_sessions của user.
   * - Chặn tự khóa chính mình và chặn khóa admin khác.
   * - Ghi log bằng Nest Logger.
   */
  async updateUserStatus(
    adminId: string,
    targetUserId: string,
    status: AccountStatus,
  ): Promise<AdminUserItem> {
    if (!/^\d+$/.test(targetUserId)) {
      throw this.notFound('User does not exist');
    }
    const adminBigInt = BigInt(adminId);
    const targetBigInt = BigInt(targetUserId);

    // Chặn tự khóa chính mình
    if (adminBigInt === targetBigInt && status === AccountStatus.LOCKED) {
      throw this.error(
        BadRequestException,
        'VALIDATION_ERROR',
        'Không thể tự khóa tài khoản của chính mình.',
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetBigInt },
    });
    if (!target) {
      throw this.notFound('Không tìm thấy người dùng');
    }

    // Chặn khóa admin khác
    if (target.role === UserRole.ADMIN && status === AccountStatus.LOCKED) {
      throw this.error(
        BadRequestException,
        'VALIDATION_ERROR',
        'Không thể khóa tài khoản của quản trị viên khác.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetBigInt },
        data: { accountStatus: status },
      });

      if (status === AccountStatus.LOCKED) {
        await tx.authSession.updateMany({
          where: { userId: targetBigInt, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return u;
    });

    // AC-31-07: Ghi log bằng Logger
    this.logger.log(
      `Admin [${adminId}] đã ${status === AccountStatus.LOCKED ? 'KHÓA' : 'MỞ KHÓA'} user [${targetUserId}] (${target.username}) lúc ${new Date().toISOString()}`,
    );

    return {
      id: updated.id.toString(),
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      role: updated.role,
      accountStatus: updated.accountStatus,
      rating: updated.rating,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * AC-35-01: Danh sách ván đấu phân trang, có thể lọc theo status.
   */
  async getMatches(query: MatchQueryDto): Promise<AdminMatchesPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const where: Prisma.MatchWhereInput = query.status ? { status: query.status } : {};

    const [total, matches] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
        include: { redPlayer: true, blackPlayer: true },
      }),
    ]);

    const items: AdminMatchItem[] = matches.map((m) => ({
      id: m.id.toString(),
      red: {
        id: m.redPlayer.id.toString(),
        username: m.redPlayer.username,
        displayName: m.redPlayer.displayName,
      },
      black: {
        id: m.blackPlayer.id.toString(),
        username: m.blackPlayer.username,
        displayName: m.blackPlayer.displayName,
      },
      status: m.status,
      result: m.result,
      endReason: m.endReason,
      startedAt: m.startedAt ? m.startedAt.toISOString() : null,
      endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * AC-35-01: Chi tiết ván kèm danh sách nước đi.
   */
  async getMatchDetail(matchId: string): Promise<AdminMatchDetail> {
    if (!/^\d+$/.test(matchId)) {
      throw this.notFound('Match does not exist');
    }

    const match = await this.prisma.match.findUnique({
      where: { id: BigInt(matchId) },
      include: {
        redPlayer: true,
        blackPlayer: true,
        moves: { orderBy: { ply: 'asc' } },
      },
    });

    if (!match) {
      throw this.notFound('Không tìm thấy ván đấu');
    }

    return {
      id: match.id.toString(),
      red: {
        id: match.redPlayer.id.toString(),
        username: match.redPlayer.username,
        displayName: match.redPlayer.displayName,
      },
      black: {
        id: match.blackPlayer.id.toString(),
        username: match.blackPlayer.username,
        displayName: match.blackPlayer.displayName,
      },
      status: match.status,
      result: match.result,
      endReason: match.endReason,
      currentFen: match.currentFen,
      startedAt: match.startedAt ? match.startedAt.toISOString() : null,
      endedAt: match.endedAt ? match.endedAt.toISOString() : null,
      moves: match.moves.map((mv) => ({
        ply: mv.ply,
        from: mv.fromSq,
        to: mv.toSq,
        piece: mv.pieceCode,
        captured: mv.capturedPieceCode,
        isCheck: mv.isCheck,
        fenAfter: mv.fenAfter,
        thinkTimeMs: mv.thinkTimeMs,
        createdAt: mv.createdAt.toISOString(),
      })),
    };
  }

  /**
   * AC-35-02: Danh sách report có phân trang và lọc theo status.
   */
  async getReports(query: ReportQueryDto): Promise<AdminReportsPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const where: Prisma.ReportWhereInput = query.status ? { status: query.status } : {};

    const [total, reports] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { reporter: true, reportedUser: true, handler: true },
      }),
    ]);

    const items: AdminReportItem[] = reports.map((r) => ({
      id: r.id.toString(),
      matchId: r.matchId.toString(),
      reporter: {
        id: r.reporter.id.toString(),
        username: r.reporter.username,
        displayName: r.reporter.displayName,
      },
      reportedUser: {
        id: r.reportedUser.id.toString(),
        username: r.reportedUser.username,
        displayName: r.reportedUser.displayName,
      },
      reason: r.reason,
      description: r.description,
      status: r.status,
      handledBy: r.handler
        ? {
            id: r.handler.id.toString(),
            username: r.handler.username,
            displayName: r.handler.displayName,
          }
        : null,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * AC-35-02: Chuyển trạng thái report (chỉ OPEN → PROCESSING → CLOSED, không đi lùi).
   */
  async updateReportStatus(
    adminId: string,
    reportId: string,
    newStatus: ReportStatus,
  ): Promise<AdminReportItem> {
    if (!/^\d+$/.test(reportId)) {
      throw this.notFound('Report does not exist');
    }

    const report = await this.prisma.report.findUnique({
      where: { id: BigInt(reportId) },
      include: { reporter: true, reportedUser: true, handler: true },
    });

    if (!report) {
      throw this.notFound('Không tìm thấy báo cáo');
    }

    // Kiểm tra quy tắc chuyển trạng thái: chỉ cho OPEN → PROCESSING → CLOSED, không đi lùi
    if (report.status === ReportStatus.PROCESSING && newStatus === ReportStatus.OPEN) {
      throw this.error(
        BadRequestException,
        'VALIDATION_ERROR',
        'Không thể chuyển trạng thái báo cáo từ PROCESSING về OPEN.',
      );
    }
    if (
      report.status === ReportStatus.CLOSED &&
      (newStatus === ReportStatus.OPEN || newStatus === ReportStatus.PROCESSING)
    ) {
      throw this.error(
        BadRequestException,
        'VALIDATION_ERROR',
        'Không thể thay đổi trạng thái của báo cáo đã CLOSED.',
      );
    }

    const updated = await this.prisma.report.update({
      where: { id: report.id },
      data: {
        status: newStatus,
        handledById: BigInt(adminId),
        handledAt: new Date(),
      },
      include: { reporter: true, reportedUser: true, handler: true },
    });

    return {
      id: updated.id.toString(),
      matchId: updated.matchId.toString(),
      reporter: {
        id: updated.reporter.id.toString(),
        username: updated.reporter.username,
        displayName: updated.reporter.displayName,
      },
      reportedUser: {
        id: updated.reportedUser.id.toString(),
        username: updated.reportedUser.username,
        displayName: updated.reportedUser.displayName,
      },
      reason: updated.reason,
      description: updated.description,
      status: updated.status,
      handledBy: updated.handler
        ? {
            id: updated.handler.id.toString(),
            username: updated.handler.username,
            displayName: updated.handler.displayName,
          }
        : null,
      handledAt: updated.handledAt ? updated.handledAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * AC-35-03: Dashboard tổng quan: tổng user, tổng ván, ván hôm nay (giờ VN UTC+7), report OPEN, user online.
   */
  async getDashboard(): Promise<AdminDashboardData> {
    const now = new Date();
    // Tính đầu ngày hôm nay theo giờ Việt Nam (UTC+7)
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const vnYear = vnTime.getUTCFullYear();
    const vnMonth = vnTime.getUTCMonth();
    const vnDate = vnTime.getUTCDate();
    const todayVnStart = new Date(Date.UTC(vnYear, vnMonth, vnDate, 0, 0, 0) - 7 * 60 * 60 * 1000);

    const [totalUsers, totalMatches, todayMatches, openReports] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.match.count(),
      this.prisma.match.count({
        where: { startedAt: { gte: todayVnStart } },
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.OPEN },
      }),
    ]);

    const onlineUsers = this.presenceService.countOnlineUsers();

    return {
      totalUsers,
      totalMatches,
      todayMatches,
      openReports,
      onlineUsers,
    };
  }

  private notFound(message = 'Resource not found'): NotFoundException {
    return this.error(NotFoundException, 'NOT_FOUND', message);
  }

  private error<T extends HttpException>(
    Type: new (body: object) => T,
    code: string,
    message: string,
  ): T {
    const instance = new Type({ code, message });
    const status = instance.getStatus();
    return new Type({
      statusCode: status,
      error: status === 400 ? 'Bad Request' : status === 403 ? 'Forbidden' : 'Not Found',
      code,
      message,
    });
  }
}
