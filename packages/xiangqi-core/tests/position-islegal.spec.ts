import { Position } from '../src';

describe('Position.isLegalMove', () => {
  it('returns false for invalid squares or from === to', () => {
    const pos = Position.initial();
    expect(pos.isLegalMove({ from: -1, to: 10 })).toBe(false);
    expect(pos.isLegalMove({ from: 10, to: 90 })).toBe(false);
    expect(pos.isLegalMove({ from: 66, to: 66 })).toBe(false);
  });

  it('returns false when source square is empty or has opponent piece', () => {
    const pos = Position.initial(); // sideToMove is 'r'
    expect(pos.isLegalMove({ from: 40, to: 41 })).toBe(false); // Empty square
    expect(pos.isLegalMove({ from: 1, to: 19 })).toBe(false); // Black horse on Red turn
  });

  it('validates legal and illegal moves for Horse (Mã) including leg blocking', () => {
    const pos = Position.initial();
    // Red Horse at b0 (sq 82): legal moves to a2 (sq 63), c2 (sq 65)
    expect(pos.isLegalMove({ from: 82, to: 63 })).toBe(true);
    expect(pos.isLegalMove({ from: 82, to: 65 })).toBe(true);
    // Invalid jumping to illegal squares
    expect(pos.isLegalMove({ from: 82, to: 73 })).toBe(false);
    expect(pos.isLegalMove({ from: 82, to: 0 })).toBe(false);

    // Block Red horse leg at sq 73 with a custom fen
    const blockedFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/1P7/RNBAKABNR r - - 0 1';
    const blockedPos = Position.fromFen(blockedFen);
    // Red horse at sq 82 has leg blocked at sq 73 by pawn (sq 73)
    expect(blockedPos.isLegalMove({ from: 82, to: 63 })).toBe(false);
    expect(blockedPos.isLegalMove({ from: 82, to: 65 })).toBe(false);
  });

  it('validates legal and illegal moves for Elephant (Tượng)', () => {
    const pos = Position.initial();
    // Red Elephant at c0 (sq 83): legal moves to a2 (sq 63), e2 (sq 67)
    expect(pos.isLegalMove({ from: 83, to: 63 })).toBe(true);
    expect(pos.isLegalMove({ from: 83, to: 67 })).toBe(true);
    // Cannot move across river or arbitrary square
    expect(pos.isLegalMove({ from: 83, to: 47 })).toBe(false);
  });

  it('validates legal and illegal moves for Advisor (Sĩ) and King (Tướng)', () => {
    const pos = Position.initial();
    // Red Advisor at d9 (sq 84): legal move to e8 (sq 76)
    expect(pos.isLegalMove({ from: 84, to: 76 })).toBe(true);
    // Red King at e9 (sq 85): can step forward to empty e8 (sq 76)
    expect(pos.isLegalMove({ from: 85, to: 76 })).toBe(true);
    // Cannot move into friendly advisors at d9 (sq 84) or f9 (sq 86)
    expect(pos.isLegalMove({ from: 85, to: 84 })).toBe(false);
    expect(pos.isLegalMove({ from: 85, to: 86 })).toBe(false);
    // Cannot move diagonally to d8 (sq 75)
    expect(pos.isLegalMove({ from: 85, to: 75 })).toBe(false);
  });

  it('returns false for locked pieces: Chariot (Xe), Cannon (Pháo), Soldier (Tốt)', () => {
    const pos = Position.initial();
    // Red Chariot at a0 (sq 81)
    expect(pos.isLegalMove({ from: 81, to: 72 })).toBe(false);
    // Red Cannon at b2 (sq 64)
    expect(pos.isLegalMove({ from: 64, to: 67 })).toBe(false);
    // Red Soldier at c3 (sq 56)
    expect(pos.isLegalMove({ from: 56, to: 47 })).toBe(false);
  });
});
