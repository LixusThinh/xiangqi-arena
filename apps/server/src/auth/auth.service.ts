import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, AccountStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { LoginDto, RefreshTokenDto, RegisterDto } from './auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload, AuthSessionResponse, AuthUserResponse } from './auth.types';
import {
  ACCESS_TOKEN_TTL_SEC,
  DEFAULT_REFRESH_TOKEN_TTL_SEC,
  REFRESH_TOKEN_BYTES,
} from './auth.constants';

type SessionUser = Pick<
  User,
  'id' | 'username' | 'email' | 'displayName' | 'role' | 'rating' | 'createdAt' | 'accountStatus'
>;

/** SHA-256 hex (64 ký tự) của refresh token. DB chỉ giữ giá trị này. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const authUserSelect = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  role: true,
  rating: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  private readonly refreshTokenTtlSec: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() config?: ConfigService,
  ) {
    this.refreshTokenTtlSec = parseRefreshTtl(config?.get<string>('REFRESH_TOKEN_TTL_SEC'));
  }

  async register(dto: RegisterDto): Promise<AuthSessionResponse> {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw this.validationError('password', 'password must be at most 72 UTF-8 bytes');
    }

    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true },
    });
    if (existingUser) {
      throw this.identifierTaken();
    }

    const passwordHash = await hash(dto.password, 12);
    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          displayName: dto.displayName.trim(),
        },
        select: {
          ...authUserSelect,
          accountStatus: true,
        },
      });
      return this.createSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.identifierTaken();
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSessionResponse> {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw this.validationError('password', 'password must be at most 72 UTF-8 bytes');
    }

    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      select: {
        ...authUserSelect,
        passwordHash: true,
        accountStatus: true,
      },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw this.invalidCredentials();
    }
    this.ensureActive(user.accountStatus);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: {
        ...authUserSelect,
        accountStatus: true,
      },
    });
    return this.createSession(updatedUser);
  }

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: {
        ...authUserSelect,
        accountStatus: true,
      },
    });
    if (!user) {
      throw this.tokenInvalid();
    }
    this.ensureActive(user.accountStatus);
    return this.toAuthUser(user);
  }

  /**
   * Đổi refresh token lấy cặp token mới (rotation). Token cũ hết dùng được ngay sau lần đổi thành công.
   * Hạn tuyệt đối của phiên tính từ lúc đăng nhập, refresh KHÔNG kéo dài hạn phiên.
   */
  async refresh(dto: RefreshTokenDto): Promise<AuthSessionResponse> {
    const oldHash = hashRefreshToken(dto.refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: oldHash },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { ...authUserSelect, accountStatus: true } },
      },
    });
    if (!session || session.revokedAt !== null) {
      throw this.refreshInvalid();
    }
    const now = new Date();
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw this.unauthorized('AUTH_REFRESH_EXPIRED', 'Refresh token has expired');
    }
    if (session.user.accountStatus === AccountStatus.LOCKED) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      this.ensureActive(session.user.accountStatus);
    }

    const refreshToken = this.newRefreshToken();
    // Điều kiện refreshTokenHash = oldHash làm phép đổi nguyên tử: 2 request refresh cùng token
    // chạy song song thì chỉ 1 request đổi được, request còn lại nhận 401.
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, refreshTokenHash: oldHash, revokedAt: null },
      data: { refreshTokenHash: hashRefreshToken(refreshToken), lastUsedAt: now },
    });
    if (rotated.count !== 1) {
      throw this.refreshInvalid();
    }
    return this.buildSessionResponse(session.user, session.id, session.expiresAt, refreshToken);
  }

  /**
   * Thu hồi phiên ứng với refresh token. Luôn thành công (idempotent) để không tiết lộ token nào còn hiệu lực.
   * Access token của phiên này bị AuthJwtGuard từ chối ngay sau đó.
   */
  async logout(dto: RefreshTokenDto): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { refreshTokenHash: hashRefreshToken(dto.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(user: SessionUser): Promise<AuthSessionResponse> {
    this.ensureActive(user.accountStatus);
    const refreshToken = this.newRefreshToken();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlSec * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt,
      },
      select: { id: true },
    });
    return this.buildSessionResponse(user, session.id, expiresAt, refreshToken);
  }

  private async buildSessionResponse(
    user: SessionUser,
    sessionId: bigint,
    sessionExpiresAt: Date,
    refreshToken: string,
  ): Promise<AuthSessionResponse> {
    const payload: AccessTokenPayload = {
      sub: user.id.toString(),
      sid: sessionId.toString(),
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SEC,
      refreshToken,
      refreshExpiresIn: Math.max(
        0,
        Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000),
      ),
      user: this.toAuthUser(user),
    };
  }

  private newRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  private toAuthUser(
    user: Pick<User, 'id' | 'username' | 'email' | 'displayName' | 'role' | 'rating' | 'createdAt'>,
  ): AuthUserResponse {
    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      rating: user.rating,
      createdAt: user.createdAt,
    };
  }

  private ensureActive(status: AccountStatus): void {
    if (status === AccountStatus.LOCKED) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ACCOUNT_LOCKED',
        message: 'This account is locked',
      });
    }
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Username/email or password is incorrect',
    });
  }

  private identifierTaken(): ConflictException {
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'AUTH_IDENTIFIER_TAKEN',
      message: 'Username or email is already registered',
    });
  }

  private tokenInvalid(): UnauthorizedException {
    return this.unauthorized('AUTH_TOKEN_INVALID', 'Access token is invalid');
  }

  private refreshInvalid(): UnauthorizedException {
    return this.unauthorized('AUTH_REFRESH_INVALID', 'Refresh token is invalid or has been revoked');
  }

  private unauthorized(code: string, message: string): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      code,
      message,
    });
  }

  private validationError(field: string, message: string): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field, message }],
    });
  }
}

function parseRefreshTtl(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_REFRESH_TOKEN_TTL_SEC;
  }
  const ttl = Number(value);
  if (!Number.isInteger(ttl) || ttl < 60) {
    throw new Error(`REFRESH_TOKEN_TTL_SEC must be an integer >= 60; received "${value}"`);
  }
  return ttl;
}
