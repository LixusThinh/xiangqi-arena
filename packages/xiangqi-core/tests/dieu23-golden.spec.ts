/**
 * XQA-79 – Golden test Điều 23 / Điều 24: thế cờ trong hình minh họa của luật → fixture JSON chạy tự động.
 * Fixture: tests/fixtures/dieu23-golden.fixture.json (nguồn, trang, ghi chú suy luận nằm trong file).
 */
import * as fs from 'fs';
import * as path from 'path';
import { algebraicToSquare, Position, RepetitionJudge, RepetitionVerdict } from '../src';

interface GoldenCase {
  id: string;
  figure: string;
  fen: string;
  setup: string[];
  cycle: string[];
  expected: {
    kind: 'loss' | 'draw' | 'undetermined';
    loser: 'r' | 'b' | null;
    violations: { side: 'r' | 'b'; type: string }[];
  };
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'dieu23-golden.fixture.json'), 'utf-8'),
) as { cases: GoldenCase[] };

const mv = (u: string) => ({ from: algebraicToSquare(u.slice(0, 2)), to: algebraicToSquare(u.slice(2, 4)) });

describe('XQA-79 golden test Điều 23 (hình minh họa Điều 24)', () => {
  it.each((fixture.cases as GoldenCase[]).map((c) => [c.id, c.figure, c] as const))(
    '%s (%s) cho đúng phán quyết như tài liệu',
    (_id, _fig, c) => {
      const judge = new RepetitionJudge(Position.fromFen(c.fen));
      c.setup.forEach((m) => judge.play(mv(m)));
      let verdict: RepetitionVerdict | undefined;
      // lặp chu kỳ tới khi thế cờ xuất hiện đủ ngưỡng (tối đa 4 vòng để không lặp vô hạn nếu fixture sai)
      for (let round = 0; round < 4 && !verdict?.result; round++) {
        for (const m of c.cycle) {
          verdict = judge.play(mv(m));
          if (verdict.result) break;
        }
      }
      expect(verdict?.repeated).toBe(true);
      expect(verdict?.result?.kind).toBe(c.expected.kind);
      if (c.expected.kind === 'loss') {
        expect(verdict?.result).toMatchObject({ loser: c.expected.loser });
      }
      expect(verdict?.violations.map((v) => ({ side: v.side, type: v.type }))).toEqual(c.expected.violations);
    },
  );

  it('mọi thế cờ trong fixture hợp lệ (đúng 1 Tướng mỗi bên, không lộ mặt tướng)', () => {
    for (const c of fixture.cases as GoldenCase[]) {
      const pos = Position.fromFen(c.fen);
      const kings = pos.board.filter((p) => p?.type === 'k');
      expect(kings).toHaveLength(2);
      expect(pos.hasFlyingGeneral()).toBe(false);
    }
  });
});
