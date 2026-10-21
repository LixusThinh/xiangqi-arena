import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload, AuthenticatedRequest } from './auth.types';

const DIGITS = /^\d+$/;

@Injectable()
export class AuthJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw this.unauthorized('AUTH_TOKEN_MISSING', 'Bearer token is required');
    }

    const match = /^Bearer (\S+)$/i.exec(authorization);
    if (!match) {
      throw this.unauthorized('AUTH_TOKEN_INVALID', 'Access token is invalid');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(match[1]);
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw this.unauthorized('AUTH_TOKEN_EXPIRED', 'Access token has expired');
      }
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'NotBeforeError'].includes(error.name)
      ) {
        throw this.unauthorized('AUTH_TOKEN_INVALID', 'Access token is invalid');
      }
      throw error;
    }

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !DIGITS.test(payload.sub) ||
      typeof payload.sid !== 'string' ||
      !DIGITS.test(payload.sid)
    ) {
      // Token cấp trước XQA-66 không có `sid` → buộc đăng nhập lại.
      throw this.unauthorized('AUTH_TOKEN_INVALID', 'Access token is invalid');
    }

    // Access JWT vẫn còn hạn chữ ký nhưng phiên đã logout/hết hạn thì phải từ chối (AC XQA-66).
    const session = await this.prisma.authSession.findUnique({
      where: { id: BigInt(payload.sid) },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.userId.toString() !== payload.sub
    ) {
      throw this.unauthorized('AUTH_SESSION_REVOKED', 'Session has been signed out or has expired');
    }

    request.user = { sub: payload.sub, sid: payload.sid };
    return true;
  }

  private unauthorized(code: string, message: string): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      code,
      message,
    });
  }
}
