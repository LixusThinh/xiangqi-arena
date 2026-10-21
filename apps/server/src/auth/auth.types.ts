import { UserRole } from '@prisma/client';

/** Payload của access JWT. `sid` = AuthSession.id, dùng để vô hiệu token khi logout (XQA-66). */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: {
    sub: string;
    sid: string;
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
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: AuthUserResponse;
}
