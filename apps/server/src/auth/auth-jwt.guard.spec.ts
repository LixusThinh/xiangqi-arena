import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthJwtGuard } from './auth-jwt.guard';

const jwtSecret = 'unit-test-access-token-secret-at-least-32-bytes';

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: { headers: { authorization?: string }; user?: { sub: string } };
} {
  const request: {
    headers: { authorization?: string };
    user?: { sub: string };
  } = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

describe('AuthJwtGuard', () => {
  it('rejects a request with no bearer token', async () => {
    const jwtService = new JwtService({ secret: jwtSecret });
    const guard = new AuthJwtGuard(jwtService);
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
      { sub: '7' },
      { expiresIn: -1 },
    );
    const guard = new AuthJwtGuard(jwtService);
    const { context } = createContext(`Bearer ${token}`);

    const request = guard.canActivate(context);
    await expect(request).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(request).rejects.toMatchObject({
      response: { code: 'AUTH_TOKEN_EXPIRED' },
    });
  });
});
