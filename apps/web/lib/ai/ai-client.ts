import { chooseAiMove, Position, type AiLevel, type Move } from '@xiangqi-arena/xiangqi-core';
import type { AiWorkerMessageIn, AiWorkerMessageOut } from './ai.worker';

export interface AiClient {
  computeMove(fen: string, level: AiLevel): Promise<Move | null>;
  terminate(): void;
}

export function createAiClient(): AiClient {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    const worker = new Worker(new URL('./ai.worker.ts', import.meta.url));
    let nextId = 1;
    const pending = new Map<
      string,
      { resolve: (move: Move | null) => void; reject: (err: Error) => void }
    >();

    worker.onmessage = (event: MessageEvent<AiWorkerMessageOut>) => {
      const { id, move, error } = event.data;
      const callback = pending.get(id);
      if (!callback) return;
      pending.delete(id);
      if (error) {
        callback.reject(new Error(error));
      } else {
        callback.resolve(move);
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      for (const { reject } of pending.values()) {
        reject(new Error(event.message || 'Worker error'));
      }
      pending.clear();
    };

    return {
      computeMove(fen: string, level: AiLevel): Promise<Move | null> {
        return new Promise((resolve, reject) => {
          const id = String(nextId++);
          pending.set(id, { resolve, reject });
          const payload: AiWorkerMessageIn = { id, fen, level };
          worker.postMessage(payload);
        });
      },
      terminate() {
        worker.terminate();
        pending.clear();
      },
    };
  }

  // Môi trường không có Web Worker (Jest jsdom, SSR)
  return {
    computeMove(fen: string, level: AiLevel): Promise<Move | null> {
      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            const pos = Position.fromFen(fen);
            const res = chooseAiMove(pos, level);
            resolve(res.move);
          } catch {
            resolve(null);
          }
        }, 0);
      });
    },
    terminate() {
      // no-op
    },
  };
}
