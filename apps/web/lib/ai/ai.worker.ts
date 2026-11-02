import { chooseAiMove, Position, type AiLevel } from '@xiangqi-arena/xiangqi-core';

export interface AiWorkerMessageIn {
  id: string;
  fen: string;
  level: AiLevel;
}

export interface AiWorkerMessageOut {
  id: string;
  move: { from: number; to: number } | null;
  score?: number;
  error?: string;
}

// Chạy trong Web Worker để tính nước đi cho AI (AC-34-01: không block main thread > 200ms)
self.onmessage = (event: MessageEvent<AiWorkerMessageIn>) => {
  const { id, fen, level } = event.data;
  try {
    const position = Position.fromFen(fen);
    const result = chooseAiMove(position, level);
    const out: AiWorkerMessageOut = {
      id,
      move: result.move,
      score: result.score,
    };
    self.postMessage(out);
  } catch (err) {
    const out: AiWorkerMessageOut = {
      id,
      move: null,
      error: (err as Error).message,
    };
    self.postMessage(out);
  }
};
