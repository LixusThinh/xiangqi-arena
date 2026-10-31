import * as fs from 'fs';
import * as path from 'path';

describe('ChessImage Assets', () => {
  const assetDir = path.resolve(__dirname, '../public/ChessImage');

  it('contains the board background image', () => {
    const boardPath = path.join(assetDir, 'BOARD.BMP');
    expect(fs.existsSync(boardPath)).toBe(true);
    expect(fs.statSync(boardPath).size).toBeGreaterThan(0);
  });

  it('contains mask images', () => {
    ['mask.png', 'mask2.png', 'mask-white.png', 'mask2-orange.png'].forEach((file) => {
      const filePath = path.join(assetDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    });
  });

  it('contains all 14 piece icons', () => {
    const pieces = [
      'rk.ico', 'ra.ico', 'rb.ico', 'rn.ico', 'rr.ico', 'rc.ico', 'rp.ico',
      'bk.ico', 'ba.ico', 'bb.ico', 'bn.ico', 'br.ico', 'bc.ico', 'bp.ico',
    ];
    pieces.forEach((piece) => {
      const piecePath = path.join(assetDir, piece);
      expect(fs.existsSync(piecePath)).toBe(true);
      expect(fs.statSync(piecePath).size).toBeGreaterThan(0);
    });
  });
});
