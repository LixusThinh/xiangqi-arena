import {
  BOARD_ASPECT,
  VIEW_BOX,
  displayColRow,
  project,
  projectSquare,
} from '../components/board/board-projection';

describe('board-projection (bàn cờ 2.5D)', () => {
  it('puts the board centre at the origin', () => {
    const c = project(4, 4.5);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.s).toBeCloseTo(1);
  });

  it('makes far rows smaller and narrower than near rows (perspective)', () => {
    const farLeft = project(0, 0);
    const farRight = project(8, 0);
    const nearLeft = project(0, 9);
    const nearRight = project(8, 9);
    expect(farLeft.s).toBeLessThan(1);
    expect(nearLeft.s).toBeGreaterThan(1);
    expect(farRight.x - farLeft.x).toBeLessThan(nearRight.x - nearLeft.x);
    expect(farLeft.y).toBeLessThan(nearLeft.y);
  });

  it('keeps columns symmetric around the centre line', () => {
    for (let r = 0; r <= 9; r++) {
      expect(project(0, r).x).toBeCloseTo(-project(8, r).x);
    }
  });

  it('flips squares for Black orientation', () => {
    expect(displayColRow(0, 'r')).toEqual({ col: 0, row: 0 });
    expect(displayColRow(0, 'b')).toEqual({ col: 8, row: 9 });
    expect(projectSquare(85, 'r')).toEqual(projectSquare(4, 'b'));
  });

  it('exposes a viewBox wider than tall that contains every intersection', () => {
    expect(BOARD_ASPECT).toBeGreaterThan(1);
    for (const [c, r] of [[0, 0], [8, 0], [0, 9], [8, 9]]) {
      const p = project(c, r);
      expect(p.x).toBeGreaterThan(VIEW_BOX.minX);
      expect(p.x).toBeLessThan(VIEW_BOX.minX + VIEW_BOX.width);
      expect(p.y).toBeGreaterThan(VIEW_BOX.minY);
      expect(p.y).toBeLessThan(VIEW_BOX.minY + VIEW_BOX.height);
    }
  });
});
