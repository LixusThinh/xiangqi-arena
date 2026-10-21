import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, UserRole } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { AuthService, hashRefreshToken } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  const user = {
    id: 7n,
    username: 'player',
    email: 'player@example.com',
    displayName: 'Player',
    role: UserRole.PLAYER,
    rating: 1200,
    createdAt: new Date('2026-10-12T10:00:00.000Z'),
    accountStatus: AccountStatus.ACTIVE,
  };
  let prisma: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    authSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      authSession: {
        create: jest.fn().mockResolvedValue({ id: 11n }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  it.each([
    ['username', { id: 1n }],
    ['email', { id: 2n }],
  ])('rejects a duplicate %s', async (_field, existingUser) => {
    prisma.user.findFirst.mockResolvedValue(existingUser);

    const request = service.register({
      username: 'player',
      email: 'player@example.com',
      password: 'example-pass-123',
      displayName: 'Player',
    });

    await expect(request).rejects.toBeInstanceOf(ConflictException);
    await expect(request).rejects.toMatchObject({
      response: { code: 'AUTH_IDENTIFIER_TAKEN' },
    });
  });

  it('returns the same invalid-credentials error for a wrong password', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...user,
      passwordHash: await hash('correct-password', 4),
    });

    const login = service.login({
      identifier: 'player@example.com',
      password: 'incorrect-password',
    });
    await expect(login).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(login).rejects.toMatchObject({
      response: { code: 'AUTH_INVALID_CREDENTIALS' },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('creates an account with a bcrypt password hash and returns a bearer token', async () => {
    let createdPasswordHash = '';
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(
      async (args: { data: { passwordHash: string } }) => {
        createdPasswordHash = args.data.passwordHash;
        return user;
      },
    );

    const result = await service.register({
      username: ' Player ',
      email: 'PLAYER@example.com',
      password: 'example-pass-123',
      displayName: ' Player ',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'player',
          email: 'player@example.com',
          displayName: 'Player',
        }),
      }),
    );
    await expect(compare('example-pass-123', createdPasswordHash)).resolves.toBe(true);
    expect(result).toMatchObject({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: '7', username: 'player' },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    // XQA-66: access token mang sid của phiên vừa tạo; DB lưu hash chứ không lưu refresh token gốc
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: '7', sid: '11' });
    const sessionData = prisma.authSession.create.mock.calls[0][0].data;
    expect(sessionData.refreshTokenHash).toBe(hashRefreshToken(result.refreshToken));
  });

  it('rejects a refresh when another request rotated the same token first', async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 11n,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refresh({ refreshToken: 'A'.repeat(43) })).rejects.toMatchObject({
      response: { code: 'AUTH_REFRESH_INVALID' },
    });
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('does not extend the absolute session lifetime on refresh', async () => {
    const expiresAt = new Date(Date.now() + 3600_000);
    prisma.authSession.findUnique.mockResolvedValue({ id: 11n, expiresAt, revokedAt: null, user });

    const result = await service.refresh({ refreshToken: 'A'.repeat(43) });

    expect(result.refreshExpiresIn).toBeLessThanOrEqual(3600);
    expect(prisma.authSession.updateMany.mock.calls[0][0].data).not.toHaveProperty('expiresAt');
  });

  it('rejects a REFRESH_TOKEN_TTL_SEC that is not an integer >= 60', () => {
    const config = { get: () => '10' } as unknown as ConfigService;
    expect(
      () =>
        new AuthService(
          prisma as unknown as PrismaService,
          jwtService as unknown as JwtService,
          config,
        ),
    ).toThrow('REFRESH_TOKEN_TTL_SEC');
  });
});
