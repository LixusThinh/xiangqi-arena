import { authApi } from '../lib/auth-api';

describe('authApi mock', () => {
  it('returns a contract-shaped session for a valid login', async () => {
    await expect(
      authApi.login({ identifier: 'PLAYER1', password: 'arena1234' }),
    ).resolves.toMatchObject({
      accessToken: 'mock-access-token-1',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: '1',
        username: 'player1',
        email: 'player1@xiangqi.local',
        role: 'PLAYER',
      },
    });
  });

  it('returns the contract 401 error for invalid credentials', async () => {
    await expect(
      authApi.login({ identifier: 'missing-player', password: 'wrongpass' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('returns the contract 409 error for a duplicate username or email', async () => {
    await expect(
      authApi.register({
        username: 'PLAYER1',
        email: 'new-player@example.com',
        password: 'password123',
        displayName: 'New Player',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'AUTH_IDENTIFIER_TAKEN',
    });

    await expect(
      authApi.register({
        username: 'new_player',
        email: 'PLAYER1@xiangqi.local',
        password: 'password123',
        displayName: 'New Player',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'AUTH_IDENTIFIER_TAKEN',
    });
  });

  it('registers a new mock user and allows that user to log in', async () => {
    const input = {
      username: `new_player_${Date.now()}`,
      email: `new_player_${Date.now()}@example.com`,
      password: 'password123',
      displayName: 'New Player',
    };
    const session = await authApi.register(input);
    const loginSession = await authApi.login({
      identifier: input.username,
      password: input.password,
    });

    expect(session.user.username).toBe(input.username);
    expect(loginSession.user.id).toBe(session.user.id);
  });
});
