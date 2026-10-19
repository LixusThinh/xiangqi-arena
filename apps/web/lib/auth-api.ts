export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'PLAYER';
  rating: number;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: 900;
  user: AuthUser;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

interface MockAccount {
  user: AuthUser;
  password: string;
}

const mockAccounts: MockAccount[] = [
  {
    user: {
      id: '1',
      username: 'player1',
      email: 'player1@xiangqi.local',
      displayName: 'Test Player 1',
      role: 'PLAYER',
      rating: 1200,
      createdAt: '2026-10-12T10:00:00.000Z',
    },
    password: 'arena1234',
  },
];

let nextUserId = 2;

function createSession(user: AuthUser): AuthSession {
  return {
    accessToken: `mock-access-token-${user.id}`,
    tokenType: 'Bearer',
    expiresIn: 900,
    user,
  };
}

export const authApi = {
  async login({ identifier, password }: LoginInput): Promise<AuthSession> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const account = mockAccounts.find(
      ({ user }) =>
        user.username === normalizedIdentifier ||
        user.email === normalizedIdentifier,
    );

    if (!account || account.password !== password) {
      throw new AuthApiError(
        'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
        401,
        'AUTH_INVALID_CREDENTIALS',
      );
    }

    return createSession(account.user);
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    if (
      mockAccounts.some(
        ({ user }) => user.username === username || user.email === email,
      )
    ) {
      throw new AuthApiError(
        'Tên đăng nhập hoặc email đã được đăng ký.',
        409,
        'AUTH_IDENTIFIER_TAKEN',
      );
    }

    const user: AuthUser = {
      id: String(nextUserId++),
      username,
      email,
      displayName: input.displayName.trim(),
      role: 'PLAYER',
      rating: 1200,
      createdAt: new Date().toISOString(),
    };

    mockAccounts.push({ user, password: input.password });
    return createSession(user);
  },
};
