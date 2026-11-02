import type { AiLevel } from '@xiangqi-arena/xiangqi-core';
import { authorizedRequest } from '@/lib/session';

export interface AiGameSummary {
  id: string;
  level: AiLevel;
  playerColor: 'r' | 'b';
  plyCount: number;
  updatedAt: string;
}

export interface AiGameMove {
  from: string;
  to: string;
}

export interface AiGameDetail {
  id: string;
  userId: string;
  level: AiLevel;
  playerColor: 'r' | 'b';
  initialFen: string;
  moves: AiGameMove[];
  currentFen: string;
  plyCount: number;
  status: 'IN_PROGRESS' | 'FINISHED';
  result: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createAiGame(level: AiLevel, playerColor: 'r' | 'b'): Promise<AiGameDetail> {
  return authorizedRequest<AiGameDetail>('/ai-games', {
    method: 'POST',
    body: JSON.stringify({ level, playerColor }),
  });
}

export async function listSavedAiGames(
  status: 'IN_PROGRESS' | 'FINISHED' = 'IN_PROGRESS',
): Promise<AiGameSummary[]> {
  return authorizedRequest<AiGameSummary[]>(`/ai-games?status=${encodeURIComponent(status)}`, {
    method: 'GET',
  });
}

export async function getAiGame(id: string): Promise<AiGameDetail> {
  return authorizedRequest<AiGameDetail>(`/ai-games/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function updateAiGame(
  id: string,
  payload: {
    moves: AiGameMove[];
    status?: 'IN_PROGRESS' | 'FINISHED';
    result?: string | null;
  },
): Promise<AiGameDetail> {
  return authorizedRequest<AiGameDetail>(`/ai-games/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAiGame(id: string): Promise<void> {
  return authorizedRequest<void>(`/ai-games/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
