/**
 * Tính toán thay đổi điểm Elo (XQA-40, FR-19).
 * K = 32, công thức chuẩn E = 1 / (1 + 10^((Rb - Ra) / 400)), làm tròn số nguyên.
 */
export interface EloResult {
  deltaA: number;
  deltaB: number;
  newRatingA: number;
  newRatingB: number;
}

export function calculateElo(
  ratingA: number,
  ratingB: number,
  actualScoreA: 1 | 0.5 | 0,
): EloResult {
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
  const actualScoreB = (1 - actualScoreA) as 1 | 0.5 | 0;

  const deltaA = Math.round(K * (actualScoreA - expectedA));
  const deltaB = Math.round(K * (actualScoreB - expectedB));

  return {
    deltaA,
    deltaB,
    newRatingA: Math.max(0, ratingA + deltaA),
    newRatingB: Math.max(0, ratingB + deltaB),
  };
}
