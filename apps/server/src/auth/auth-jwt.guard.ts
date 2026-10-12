import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from './auth.types';

interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class AuthJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

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

    if (!payload || typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) {
      throw this.unauthorized('AUTH_TOKEN_INVALID', 'Access token is invalid');
    }
    request.user = { sub: payload.sub };
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
