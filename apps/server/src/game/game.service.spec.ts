import { MatchEndReason, MatchResult } from '@prisma/client';
import type { GameStatus, RepetitionVerdict } from '@xiangqi-arena/xiangqi-core';
import { resolveEnding } from './game.service';

const ongoing: GameStatus = { turn: 'b', inCheck: false, result: null };
const noRepeat: RepetitionVerdict = {
  repetitionCount: 1,
  threshold: 3,
  repeated: false,
  violations: [],
  result: null,
};

describe('resolveEnding (XQA-74)', () => {
  it('ván chưa kết thúc → null', () => {
    expect(resolveEnding(ongoing, noRepeat)).toEqual({ result: null, endReason: null });
  });

  it('chiếu bí → bên thắng + CHECKMATE', () => {
    expect(
      resolveEnding({ turn: 'b', inCheck: true, result: { winner: 'r', reason: 'checkmate' } }, noRepeat),
    ).toEqual({ result: MatchResult.RED_WIN, endReason: MatchEndReason.CHECKMATE });
  });

  it('hết nước đi (Điều 7.1b) → bên còn lại thắng, lưu STALEMATE', () => {
    expect(
      resolveEnding({ turn: 'r', inCheck: false, result: { winner: 'b', reason: 'no_moves' } }, noRepeat),
    ).toEqual({ result: MatchResult.BLACK_WIN, endReason: MatchEndReason.STALEMATE });
  });

  it('chiếu mãi (Điều 23 Điểm 1) → bên chiếu thua, REPETITION', () => {
    const verdict: RepetitionVerdict = {
      ...noRepeat,
      repeated: true,
      result: { kind: 'loss', loser: 'r', winner: 'b', rule: 'Điều 23 – Điểm 1' },
    };
    expect(resolveEnding(ongoing, verdict)).toEqual({
      result: MatchResult.BLACK_WIN,
      endReason: MatchEndReason.REPETITION,
    });
  });

  it('lặp nước phần 1 chưa xử được (undetermined) → ván tiếp tục', () => {
    const verdict: RepetitionVerdict = {
      ...noRepeat,
      repeated: true,
      result: { kind: 'undetermined', reason: 'x' },
    };
    expect(resolveEnding(ongoing, verdict)).toEqual({ result: null, endReason: null });
  });

  it('chiếu bí được ưu tiên hơn phán quyết lặp nước', () => {
    const verdict: RepetitionVerdict = { ...noRepeat, result: { kind: 'draw', rule: 'x' } };
    expect(
      resolveEnding({ turn: 'b', inCheck: true, result: { winner: 'r', reason: 'checkmate' } }, verdict),
    ).toMatchObject({ endReason: MatchEndReason.CHECKMATE });
  });
});
