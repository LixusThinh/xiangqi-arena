import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthJwtGuard } from '../auth/auth-jwt.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly authJwtGuard: AuthJwtGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Kiểm tra xác thực token (chưa đăng nhập / token sai → 401 do AuthJwtGuard ném)
    await this.authJwtGuard.canActivate(context);

    // 2. Kiểm tra role ADMIN (AC-31-02: role PLAYER → 403 cho mọi /admin/*)
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user.sub;

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { role: true, accountStatus: true },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập trang quản trị.',
      });
    }

    if (user.accountStatus === 'LOCKED') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản quản trị viên này đã bị khóa.',
      });
    }

    return true;
  }
}
