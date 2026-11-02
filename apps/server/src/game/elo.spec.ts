import { calculateElo } from './elo';

describe('calculateElo (XQA-40, FR-19)', () => {
  it('hai bên bằng điểm, A thắng → A +16, B -16', () => {
    const res = calculateElo(1200, 1200, 1);
    expect(res).toEqual({
      deltaA: 16,
      deltaB: -16,
      newRatingA: 1216,
      newRatingB: 1184,
    });
  });

  it('hai bên bằng điểm, A thua → A -16, B +16', () => {
    const res = calculateElo(1200, 1200, 0);
    expect(res).toEqual({
      deltaA: -16,
      deltaB: 16,
      newRatingA: 1184,
      newRatingB: 1216,
    });
  });

  it('hai bên bằng điểm, hòa → delta = 0 cho cả hai', () => {
    const res = calculateElo(1200, 1200, 0.5);
    expect(res).toEqual({
      deltaA: 0,
      deltaB: 0,
      newRatingA: 1200,
      newRatingB: 1200,
    });
  });

  it('chênh lệch lớn: cửa trên thắng (1600 vs 1200) → điểm tăng ít (+3 / -3)', () => {
    const res = calculateElo(1600, 1200, 1);
    expect(res).toEqual({
      deltaA: 3,
      deltaB: -3,
      newRatingA: 1603,
      newRatingB: 1197,
    });
  });

  it('chênh lệch lớn: cửa dưới thắng (1600 vs 1200, A thua) → điểm đổi nhiều (-29 / +29)', () => {
    const res = calculateElo(1600, 1200, 0);
    expect(res).toEqual({
      deltaA: -29,
      deltaB: 29,
      newRatingA: 1571,
      newRatingB: 1229,
    });
  });

  it('chênh lệch lớn: hòa (1600 vs 1200) → cửa trên bị trừ điểm (-13 / +13)', () => {
    const res = calculateElo(1600, 1200, 0.5);
    expect(res).toEqual({
      deltaA: -13,
      deltaB: 13,
      newRatingA: 1587,
      newRatingB: 1213,
    });
  });

  it('rating không bị âm nếu giảm vượt quá số điểm hiện có', () => {
    const res = calculateElo(10, 10, 0);
    expect(res.deltaA).toBe(-16);
    expect(res.newRatingA).toBe(0);
  });
});
