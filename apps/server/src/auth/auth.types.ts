import { UserRole } from '@prisma/client';

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: {
    sub: string;
  };
}

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating: number;
  createdAt: Date;
}

export interface AuthSessionResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: 900;
  user: AuthUserResponse;
}
