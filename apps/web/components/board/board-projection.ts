/**
 * Phép chiếu phối cảnh cho bàn cờ 2.5D.
 *
 * Mặt bàn nằm trên một mặt phẳng nghiêng ra sau TILT_DEG độ, camera đặt cách tâm bàn
 * CAMERA_DIST. Toạ độ đầu vào tính theo ô (cột 0..8, hàng 0..9 theo hướng hiển thị,
 * cho phép số lẻ cho lề bàn); toạ độ đầu ra là toạ độ màn hình trong viewBox của SVG.
 * Công thức giống `perspective` + `rotateX` của CSS: điểm càng xa (hàng trên) càng nhỏ.
 */

/** Số đơn vị viewBox cho một ô khi bàn nằm phẳng (trước khi chiếu) */
export const UNIT = 80;
export const TILT_DEG = 30;
export const CAMERA_DIST = 24 * UNIT;
/** Lề mặt gỗ tính từ đường kẻ ngoài cùng, đơn vị ô */
export const BOARD_MARGIN = 0.92;
/** Bề dày mép trước của bàn trên màn hình, đơn vị viewBox */
export const SLAB_DEPTH = 26;
/** Phần thừa quanh bàn để chứa bóng đổ */
const VIEW_PAD = 18;

const TILT = (TILT_DEG * Math.PI) / 180;
export const COS_TILT = Math.cos(TILT);
export const SIN_TILT = Math.sin(TILT);

export interface Projected {
  x: number;
  y: number;
  /** Hệ số phóng to do phối cảnh (gần > 1, xa < 1) */
  s: number;
}

/** Chiếu điểm (cột, hàng) trên mặt bàn ra màn hình. */
export function project(col: number, row: number): Projected {
  const X = (col - 4) * UNIT;
  const Y = (row - 4.5) * UNIT;
  const s = CAMERA_DIST / (CAMERA_DIST - Y * SIN_TILT);
  return { x: X * s, y: Y * COS_TILT * s, s };
}

export function displayColRow(sq: number, orientation: 'r' | 'b'): { col: number; row: number } {
  const col = sq % 9;
  const row = Math.floor(sq / 9);
  return orientation === 'r' ? { col, row } : { col: 8 - col, row: 9 - row };
}

export function projectSquare(sq: number, orientation: 'r' | 'b'): Projected {
  const { col, row } = displayColRow(sq, orientation);
  return project(col, row);
}

const fmt = (n: number) => Number(n.toFixed(2));

/** Chuỗi points của đa giác tứ giác quanh giao điểm (col,row), nửa cạnh `half` ô. */
export function quadPoints(col: number, row: number, half: number): string {
  return [
    project(col - half, row - half),
    project(col + half, row - half),
    project(col + half, row + half),
    project(col - half, row + half),
  ]
    .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
    .join(' ');
}

/** Đường gấp khúc qua các điểm trên mặt bàn, dạng thuộc tính `d` của <path>. */
export function planePath(points: Array<[number, number]>, close = false): string {
  const d = points
    .map(([c, r], i) => {
      const p = project(c, r);
      return `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`;
    })
    .join(' ');
  return close ? `${d} Z` : d;
}

const M = BOARD_MARGIN;
export const SURFACE_CORNERS = {
  tl: project(-M, -M),
  tr: project(8 + M, -M),
  br: project(8 + M, 9 + M),
  bl: project(-M, 9 + M),
};

export const VIEW_BOX = (() => {
  const { tl, br, bl } = SURFACE_CORNERS;
  const minX = fmt(bl.x - VIEW_PAD);
  const minY = fmt(tl.y - VIEW_PAD);
  const width = fmt(br.x - bl.x + VIEW_PAD * 2);
  const height = fmt(br.y + SLAB_DEPTH - tl.y + VIEW_PAD * 2);
  return { minX, minY, width, height };
})();

export const VIEW_BOX_ATTR = `${VIEW_BOX.minX} ${VIEW_BOX.minY} ${VIEW_BOX.width} ${VIEW_BOX.height}`;
/** Tỉ lệ rộng/cao của khung bàn cờ, dùng cho CSS aspect-ratio và tính bề rộng theo chiều cao màn hình */
export const BOARD_ASPECT = VIEW_BOX.width / VIEW_BOX.height;

/* ---------- Các nét vẽ cố định của bàn (tính một lần) ---------- */

function buildGridPaths(): string[] {
  const paths: string[] = [];
  for (let r = 0; r <= 9; r++) paths.push(planePath([[0, r], [8, r]]));
  for (let c = 0; c <= 8; c++) {
    if (c === 0 || c === 8) {
      paths.push(planePath([[c, 0], [c, 9]]));
    } else {
      paths.push(planePath([[c, 0], [c, 4]]));
      paths.push(planePath([[c, 5], [c, 9]]));
    }
  }
  // Cung tướng
  paths.push(planePath([[3, 0], [5, 2]]));
  paths.push(planePath([[5, 0], [3, 2]]));
  paths.push(planePath([[3, 7], [5, 9]]));
  paths.push(planePath([[5, 7], [3, 9]]));
  return paths;
}

function buildStarMarks(): string[] {
  const points: Array<[number, number]> = [
    [1, 2], [7, 2], [1, 7], [7, 7],
    [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
    [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
  ];
  const gap = 0.07;
  const arm = 0.2;
  const marks: string[] = [];
  for (const [c, r] of points) {
    for (const dx of [-1, 1]) {
      if ((c === 0 && dx < 0) || (c === 8 && dx > 0)) continue;
      for (const dy of [-1, 1]) {
        marks.push(
          planePath([
            [c + dx * gap, r + dy * (gap + arm)],
            [c + dx * gap, r + dy * gap],
            [c + dx * (gap + arm), r + dy * gap],
          ]),
        );
      }
    }
  }
  return marks;
}

/** Vân gỗ: các đường lượn ngang trên mặt bàn, độ đậm/biên độ giả ngẫu nhiên nhưng cố định. */
function buildGrain(): Array<{ d: string; opacity: number; width: number }> {
  const lines: Array<{ d: string; opacity: number; width: number }> = [];
  const count = 46;
  for (let i = 0; i < count; i++) {
    const base = -M + ((9 + 2 * M) * (i + 0.5)) / count;
    const amp = 0.04 + 0.05 * Math.abs(Math.sin(i * 12.9898));
    const freq = 0.5 + 0.35 * Math.abs(Math.sin(i * 78.233));
    const phase = i * 1.7;
    const pts: Array<[number, number]> = [];
    for (let c = -M; c <= 8 + M + 0.001; c += 0.4) {
      pts.push([c, base + amp * Math.sin(c * freq + phase)]);
    }
    lines.push({
      d: planePath(pts),
      opacity: fmt(0.05 + 0.1 * Math.abs(Math.sin(i * 3.1))),
      width: fmt(0.8 + 1.6 * Math.abs(Math.sin(i * 5.7))),
    });
  }
  return lines;
}

export const GRID_PATHS = buildGridPaths();
export const STAR_MARKS = buildStarMarks();
export const GRAIN_LINES = buildGrain();
export const SURFACE_PATH = planePath([[-M, -M], [8 + M, -M], [8 + M, 9 + M], [-M, 9 + M]], true);
export const INNER_BORDER_PATH = planePath([[-0.16, -0.16], [8.16, -0.16], [8.16, 9.16], [-0.16, 9.16]], true);
export const FRONT_FACE_PATH = (() => {
  const { bl, br } = SURFACE_CORNERS;
  return `M${fmt(bl.x)} ${fmt(bl.y)} L${fmt(br.x)} ${fmt(br.y)} L${fmt(br.x)} ${fmt(br.y + SLAB_DEPTH)} L${fmt(bl.x)} ${fmt(bl.y + SLAB_DEPTH)} Z`;
})();
