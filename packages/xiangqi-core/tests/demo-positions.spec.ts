/**
 * XQA-113 – bộ 10 thế cờ mẫu (FEN) cho demo và test.
 * AC2 "Quang kiểm FEN load được": spec này load từng FEN và kiểm đúng điều mà thế cờ minh họa,
 * chạy trên CI cùng các test engine khác.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { algebraicToSquare, Position, RepetitionJudge, squareToAlgebraic } from '../src';

interface DemoPosition {
  id: string;
  name: string;
  fen: string;
  source: { article: string; figure: string | null };
  purpose: string;
  expect: {
    status: 'ongoing' | 'checkmate' | 'no_moves';
    inCheck: boolean;
    winner?: 'r' | 'b';
    legalMoveCount?: number;
    legalMoves?: string[];
    pieceMoves?: { square: string; to: string[] };
    cycle?: string[];
    cycleRepeat?: number;
    repetition?: { kind: 'loss' | 'draw'; loser?: 'r' | 'b' };
  };
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'demo-positions.fixture.json'), 'utf8'),
) as { positions: DemoPosition[] };

const uci = (m: { from: number; to: number }) => squareToAlgebraic(m.from) + squareToAlgebraic(m.to);
const mv = (s: string) => ({ from: algebraicToSquare(s.slice(0, 2)), to: algebraicToSquare(s.slice(2, 4)) });

describe('XQA-113 bộ 10 thế cờ mẫu', () => {
  it('đủ 10 thế, id không trùng, thế nào cũng có điều luật làm nguồn', () => {
    expect(fixture.positions).toHaveLength(10);
    expect(new Set(fixture.positions.map((p) => p.id)).size).toBe(10);
    for (const p of fixture.positions) expect(p.source.article).toMatch(/Điều \d/);
  });

  describe.each(fixture.positions.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    it(`load được FEN và trạng thái đúng: ${p.name}`, () => {
      const pos = Position.fromFen(p.fen);
      expect(pos.toFen()).toBe(p.fen);
      const status = pos.getGameStatus();
      expect(status.inCheck).toBe(p.expect.inCheck);
      if (p.expect.status === 'ongoing') {
        expect(status.result).toBeNull();
      } else {
        expect(status.result).toEqual({ winner: p.expect.winner, reason: p.expect.status });
      }
      if (p.expect.legalMoveCount !== undefined) {
        expect(pos.generateLegalMoves()).toHaveLength(p.expect.legalMoveCount);
      }
      if (p.expect.legalMoves) {
        expect(pos.generateLegalMoves().map(uci).sort()).toEqual([...p.expect.legalMoves].sort());
      }
      if (p.expect.pieceMoves) {
        const { square, to } = p.expect.pieceMoves;
        const actual = pos.generatePieceMoves(algebraicToSquare(square)).map((m) => squareToAlgebraic(m.to));
        expect(actual.sort()).toEqual([...to].sort());
      }
    });

    if (p.expect.cycle && p.expect.repetition) {
      it('đi chu kỳ lặp → Điều 23 xử đúng kết quả', () => {
        const judge = new RepetitionJudge(Position.fromFen(p.fen));
        let verdict = null;
        for (let i = 0; i < (p.expect.cycleRepeat ?? 2); i++) {
          for (const m of p.expect.cycle ?? []) verdict = judge.play(mv(m));
        }
        expect(verdict?.result).toMatchObject(p.expect.repetition ?? {});
      });
    }
  });
});
