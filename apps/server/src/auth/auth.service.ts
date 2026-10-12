import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User, AccountStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { LoginDto, RegisterDto } from './auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSessionResponse, AuthUserResponse } from './auth.types';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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

  private async createSession(
    user: Pick<User, 'id' | 'username' | 'email' | 'displayName' | 'role' | 'rating' | 'createdAt' | 'accountStatus'>,
  ): Promise<AuthSessionResponse> {
    this.ensureActive(user.accountStatus);
    const accessToken = await this.jwtService.signAsync({
      sub: user.id.toString(),
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: this.toAuthUser(user),
    };
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
    return new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      code: 'AUTH_TOKEN_INVALID',
      message: 'Access token is invalid',
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
