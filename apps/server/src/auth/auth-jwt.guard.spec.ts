import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthJwtGuard } from './auth-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

const jwtSecret = 'unit-test-access-token-secret-at-least-32-bytes';

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: { headers: { authorization?: string }; user?: { sub: string; sid: string } };
} {
  const request: {
    headers: { authorization?: string };
    user?: { sub: string; sid: string };
  } = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

function createPrisma(session: unknown = null): {
  prisma: PrismaService;
  findUnique: jest.Mock;
} {
  const findUnique = jest.fn().mockResolvedValue(session);
  return {
    prisma: { authSession: { findUnique } } as unknown as PrismaService,
    findUnique,
  };
}

describe('AuthJwtGuard', () => {
  it('rejects a request with no bearer token', async () => {
    const jwtService = new JwtService({ secret: jwtSecret });
    const guard = new AuthJwtGuard(jwtService, createPrisma().prisma);
    const { context } = createContext();

    const request = guard.canActivate(context);
    await expect(request).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(request).rejects.toMatchObject({
      response: { code: 'AUTH_TOKEN_MISSING' },
    });
  });

  it('rejects an expired access token with the contract error code', async () => {
    const jwtService = new JwtService({ secret: jwtSecret });
    const token = await jwtService.signAsync(
      { sub: '7', sid: '1' },
      { expiresIn: -1 },
    );
    const guard = new AuthJwtGuard(jwtService, createPrisma().prisma);
    const { context } = createContext(`Bearer ${token}`);

    const request = guard.canActivate(context);
    await expect(request).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(request).rejects.toMatchObject({
      response: { code: 'AUTH_TOKEN_EXPIRED' },
    });
  });

  it('rejects a token issued before XQA-66 (no sid claim)', async () => {
    const jwtService = new JwtService({ secret: jwtSecret });
    const token = await jwtService.signAsync({ sub: '7' });
    const { prisma, findUnique } = createPrisma();
    const guard = new AuthJwtGuard(jwtService, prisma);
    const { context } = createContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'AUTH_TOKEN_INVALID' },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['session not found', null],
    ['session revoked', { userId: 7n, revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
    ['session expired', { userId: 7n, revokedAt: null, expiresAt: new Date(Date.now() - 1) }],
    ['session belongs to another user', { userId: 8n, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }],
  ])('rejects a valid JWT when %s', async (_case, session) => {
    const jwtService = new JwtService({ secret: jwtSecret });
    const token = await jwtService.signAsync({ sub: '7', sid: '3' });
    const guard = new AuthJwtGuard(jwtService, createPrisma(session).prisma);
    const { context } = createContext(`Bearer ${token}`);

    const result = guard.canActivate(context);
    await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(result).rejects.toMatchObject({
      response: { code: 'AUTH_SESSION_REVOKED' },
    });
  });

  it('accepts a JWT whose session is active and exposes sub + sid', async () => {
    const jwtService = new JwtService({ secret: jwtSecret });
    const token = await jwtService.signAsync({ sub: '7', sid: '3' });
    const { prisma, findUnique } = createPrisma({
      userId: 7n,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const guard = new AuthJwtGuard(jwtService, prisma);
    const { context, request } = createContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3n } }));
    expect(request.user).toEqual({ sub: '7', sid: '3' });
  });
});
