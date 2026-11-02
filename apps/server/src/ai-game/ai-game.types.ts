import { AiGameLevel, AiGameStatus } from '@prisma/client';

export interface AiGameMove {
  from: string;
  to: string;
}

export interface AiGameSummaryResponse {
  id: string;
  level: AiGameLevel;
  playerColor: string;
  plyCount: number;
  updatedAt: string;
}

export interface AiGameDetailResponse {
  id: string;
  userId: string;
  level: AiGameLevel;
  playerColor: string;
  initialFen: string;
  moves: AiGameMove[];
  currentFen: string;
  plyCount: number;
  status: AiGameStatus;
  result: string | null;
  createdAt: string;
  updatedAt: string;
}
