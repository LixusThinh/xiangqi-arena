import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, UserRole } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { AuthService } from './auth.service';
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
  });
});
