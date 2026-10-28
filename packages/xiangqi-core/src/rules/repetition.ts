import { squareToCoord } from '../coordinates';
import { hasCrossedRiver } from '../movegen/pawn';
import type { Position } from '../position';
import { Color, Move, Piece, PieceType, Square } from '../types';
import { opponentOf } from './check';

/**
 * RepetitionJudge (XQA-78 phần 1, XQA-95 phần 2): lịch sử thế cờ, phát hiện lặp, nhận diện nước chiếu /
 * nước đuổi bắt, và xử 10 điểm của Điều 23 (luat_co_tuong_viet_nam.pdf, Chương 5).
 *
 * Phân biệt 3 tầng (theo quy ước dự án):
 * - LUẬT CỜ: Điều 7.1g, 7.2b/c, Điều 22 (thuật ngữ), Điều 23 (10 điểm), Điều 24 (ví dụ).
 * - BUSINESS RULE của hệ thống: thế cờ lặp lại đủ `threshold` lần (mặc định 3 = RuleProfile.repetitionThreshold
 *   trong seed) thì mới xét xử. Luật chỉ nói "không thay đổi nước đi", không quy định số lần.
 * - QUYẾT ĐỊNH THIẾT KẾ: "dọa bắt mới" = cặp (quân ta, quân địch) mà sau nước đi quân ta ăn hợp lệ được quân địch,
 *   còn trước nước đi thì không. Tính cả quân đứng yên được "mở đường" (Pháo đổi ngòi – 24.21, 24.22).
 *   Mẫu luật không nói rõ thì trả `undetermined` và ghi đề xuất BR (docs/engine/repetition-judge.md), KHÔNG đoán.
 */

/** Ngưỡng mặc định, khớp `repetitionThreshold` của RuleProfile trong apps/server/prisma/seed.ts. */
export const DEFAULT_REPETITION_THRESHOLD = 3;

export type MoveKind = 'check' | 'chase' | 'idle';

/** Một mối "dọa bắt" mới (Điều 22.4) sau nước đi: do quân vừa đi, hoặc do quân khác được mở đường. */
export interface ChaseInfo {
  /** Định danh quân đuổi, giữ nguyên khi quân di chuyển (để biết "một quân đuổi mãi một quân"). */
  chaserId: number;
  chaserType: PieceType;
  targetId: number;
  targetType: PieceType;
  targetSquare: Square;
  /** Quân bị đuổi là Tốt chưa qua sông (ngoại lệ Điểm 3). */
  targetIsUncrossedPawn: boolean;
  /**
   * Quân bị đuổi "có căn thật" (Điều 22.15): nếu bị ăn thì bên kia ăn lại hợp lệ ngay được.
   * Bảo vệ mà không ăn lại được (bị ghim, lộ mặt tướng) = căn giả → false.
   */
  targetProtected: boolean;
  /**
   * Quân bị đuổi không có nước đi hợp lệ nào (bị ghim / bị giam). Điểm 7 câu 1, 24.15: khi đó căn thật
   * không cứu được bên đuổi.
   */
  targetImmobile: boolean;
  /**
   * Quân bị đuổi cùng loại và ăn lại được ngay quân đuổi = đòi đổi quân / thí quân (Điều 22.5, 22.7, 24.20).
   * Nếu MỌI nước đều là đòi đổi thì là "đòi đổi mãi / thí mãi" (Điểm 10, hòa); có lẫn nước bắt thật thì vẫn là
   * bắt mãi (Điểm 8).
   */
  isExchangeOffer: boolean;
  /** Quân đuổi không phải quân vừa đi (được mở đường, ví dụ Pháo có ngòi mới). */
  discovered: boolean;
}

export interface MoveRecord {
  /** Số thứ tự nửa nước, bắt đầu từ 1. */
  ply: number;
  side: Color;
  move: Move;
  piece: Piece;
  pieceId: number;
  isCapture: boolean;
  /** Nước đi chiếu Tướng đối phương (Điều 22.2). */
  isCheck: boolean;
  chases: ChaseInfo[];
  /** 'check' ưu tiên hơn 'chase' (nước vừa chiếu vừa dọa bắt tính là nước chiếu). */
  kind: MoveKind;
  /** Zobrist hash (hex 16 ký tự) của thế cờ SAU nước đi. */
  hashAfter: string;
}

export type RepetitionViolationType = 'perpetual_check' | 'perpetual_chase';

export interface RepetitionViolation {
  side: Color;
  type: RepetitionViolationType;
  /** Điểm của Điều 23 làm căn cứ. */
  rule: string;
  /** Có ở perpetual_chase: quân đuổi (quân đầu tiên nếu nhiều quân cùng bắt) và quân bị đuổi. */
  chase?: Pick<ChaseInfo, 'chaserId' | 'chaserType' | 'targetId' | 'targetType'>;
  /** Có ở perpetual_chase: mọi quân tham gia đuổi bắt quân bị đuổi trong chu kỳ (Điểm 3 câu 2). */
  chaserIds?: number[];
}

export type RepetitionResult =
  | { kind: 'loss'; loser: Color; winner: Color; rule: string }
  | { kind: 'draw'; rule: string }
  /** Mẫu lặp mà luật không quy định rõ (chờ business rule PM duyệt). Ván tiếp tục. */
  | { kind: 'undetermined'; reason: string };

export interface RepetitionVerdict {
  /** Số lần thế cờ hiện tại đã xuất hiện, tính cả lần này. */
  repetitionCount: number;
  threshold: number;
  /** true khi repetitionCount ≥ threshold. */
  repeated: boolean;
  violations: RepetitionViolation[];
  /** null khi chưa tới ngưỡng lặp. */
  result: RepetitionResult | null;
}

export interface RepetitionJudgeOptions {
  threshold?: number;
}

/**
 * Theo dõi một ván từ một thế cờ xuất phát. Gọi `play(move)` sau MỖI nước hợp lệ (cùng thứ tự với GameService).
 */
export class RepetitionJudge {
  readonly threshold: number;
  private readonly position: Position;
  /** Định danh từng quân theo ô hiện tại; đổi chỗ theo nước đi. */
  private readonly pieceIds: (number | null)[];
  private readonly hashes: string[];
  private readonly records: MoveRecord[] = [];

  constructor(start: Position, options: RepetitionJudgeOptions = {}) {
    const threshold = options.threshold ?? DEFAULT_REPETITION_THRESHOLD;
    if (!Number.isInteger(threshold) || threshold < 2) {
      throw new Error(`Repetition threshold must be an integer >= 2; received ${threshold}`);
    }
    this.threshold = threshold;
    this.position = start.clone();
    let nextId = 1;
    this.pieceIds = this.position.board.map((p) => (p ? nextId++ : null));
    this.hashes = [this.position.toHashString()];
  }

  /** Thế cờ hiện tại (bản sao, sửa không ảnh hưởng judge). */
  get current(): Position {
    return this.position.clone();
  }

  get history(): readonly MoveRecord[] {
    return this.records;
  }

  /** Ghi nhận một nước đi hợp lệ và trả về phán quyết sau nước đó. Ném lỗi nếu nước không hợp lệ. */
  play(move: Move): RepetitionVerdict {
    if (!this.position.isLegalMove(move)) {
      throw new Error(`Illegal move for repetition judge: ${move.from}->${move.to}`);
    }
    const before = this.position.clone();
    const idsBefore = [...this.pieceIds];
    const side = before.sideToMove;
    const piece = before.board[move.from] as Piece;
    const pieceId = this.pieceIds[move.from] as number;
    const isCapture = before.board[move.to] !== null;

    this.position.applyMove(move);
    this.pieceIds[move.to] = pieceId;
    this.pieceIds[move.from] = null;

    const isCheck = this.position.isCheck(opponentOf(side));
    const chases = findNewChases(before, idsBefore, this.position, this.pieceIds, pieceId);
    const hashAfter = this.position.toHashString();
    this.hashes.push(hashAfter);
    this.records.push({
      ply: this.records.length + 1,
      side,
      move,
      piece,
      pieceId,
      isCapture,
      isCheck,
      chases,
      kind: isCheck ? 'check' : chases.length > 0 ? 'chase' : 'idle',
      hashAfter,
    });
    return this.verdict();
  }

  /** Phán quyết cho thế cờ hiện tại. */
  verdict(): RepetitionVerdict {
    const currentHash = this.hashes[this.hashes.length - 1];
    let firstIndex = -1;
    let repetitionCount = 0;
    for (let i = 0; i < this.hashes.length; i++) {
      if (this.hashes[i] === currentHash) {
        if (firstIndex < 0) firstIndex = i;
        repetitionCount++;
      }
    }
    if (repetitionCount < this.threshold) {
      return { repetitionCount, threshold: this.threshold, repeated: false, violations: [], result: null };
    }
    // hashes[i] là thế cờ sau i nửa nước → các nước tạo nên chu kỳ là records[firstIndex .. hết]
    const cycle = this.records.slice(firstIndex);
    const { violations, result } = judgeCycle(cycle);
    return { repetitionCount, threshold: this.threshold, repeated: true, violations, result };
  }
}

const SIDE_NAME: Record<Color, string> = { r: 'Đỏ', b: 'Đen' };

/**
 * Mối dọa bắt có được tính là "nước bắt" khi xét bắt mãi không (theo từng nước):
 * - Tốt chưa qua sông: được phép đuổi (Điểm 3 ngoại lệ, 24.21).
 * - Quân có căn thật: không tính (Điểm 6 câu 1; 24.13 hình 31, 24.23, 24.20 hình 54: "một nước có căn thì nước
 *   này không coi là nước bắt quân"), TRỪ khi quân đó không đi được (Điểm 7 câu 1, 24.15) hoặc Mã/Pháo bắt Xe
 *   (Điểm 6 câu 2, 24.11).
 */
export function chaseCounts(c: ChaseInfo): boolean {
  if (c.targetIsUncrossedPawn) return false;
  if (c.targetProtected && !c.targetImmobile && !isMinorOnRook(c)) return false;
  return true;
}

function isMinorOnRook(c: Pick<ChaseInfo, 'chaserType' | 'targetType'>): boolean {
  return (c.chaserType === 'n' || c.chaserType === 'c') && c.targetType === 'r';
}

const isKingOrPawn = (type: PieceType): boolean => type === 'k' || type === 'p';

/**
 * Xử một chu kỳ lặp (các nước giữa lần đầu và lần hiện tại của thế cờ bị lặp). Hàm thuần, test được độc lập.
 */
export function judgeCycle(cycle: readonly MoveRecord[]): {
  violations: RepetitionViolation[];
  result: RepetitionResult;
} {
  const violations: RepetitionViolation[] = [];

  for (const side of ['r', 'b'] as const) {
    const moves = cycle.filter((m) => m.side === side);
    if (moves.length === 0) continue;

    if (moves.every((m) => m.isCheck)) {
      // Điểm 1, Điều 7.1g: chiếu mãi (một quân hay nhiều quân thay nhau chiếu – 24.2 hình 1–3) → xử thua
      violations.push({ side, type: 'perpetual_check', rule: 'Điều 23 – Điểm 1' });
      continue;
    }
    const chase = findPerpetualChase(moves);
    if (chase) violations.push({ side, type: 'perpetual_chase', ...chase });
  }

  if (violations.length === 0) {
    return {
      violations,
      result: { kind: 'draw', rule: 'Điều 24.2 / Điều 7.2b – hai bên không phạm luật, không đổi nước đi' },
    };
  }
  if (violations.length === 1) {
    const loser = violations[0].side;
    return { violations, result: { kind: 'loss', loser, winner: opponentOf(loser), rule: violations[0].rule } };
  }
  if (violations[0].type === violations[1].type) {
    return { violations, result: { kind: 'draw', rule: 'Điều 7.2c – hai bên cùng phạm một điều luật cấm' } };
  }
  // Luật không nói rõ khi một bên chiếu mãi, bên kia bắt mãi → chờ BR-REP-01 (đề xuất, chưa duyệt)
  return {
    violations,
    result: {
      kind: 'undetermined',
      reason: `Hai bên phạm hai loại khác nhau (${violations
        .map((v) => `${SIDE_NAME[v.side]} ${v.type === 'perpetual_check' ? 'chiếu mãi' : 'bắt mãi'}`)
        .join(', ')}); chờ BR-REP-01`,
    },
  };
}

/**
 * Một bên có "bắt mãi" không. Cần: mọi nước của bên đó trong chu kỳ đều có mối dọa bắt được tính (`chaseCounts`)
 * nhắm vào CÙNG một quân địch, không có nước chiếu xen vào (Điểm 2: một chiếu một bắt → hòa).
 */
function findPerpetualChase(
  moves: readonly MoveRecord[],
): Pick<RepetitionViolation, 'rule' | 'chase' | 'chaserIds'> | null {
  if (moves.some((m) => m.isCheck)) return null; // Điểm 2
  const counted = moves.map((m) => m.chases.filter(chaseCounts));
  if (counted.some((list) => list.length === 0)) return null; // có nước chờ / nước bắt quân có căn → Điểm 2, 6, 10

  const targetSets = counted.map((list) => new Set(list.map((c) => c.targetId)));
  const commonTargets = [...targetSets[0]].filter((t) => targetSets.every((set) => set.has(t)));
  // Không có quân nào bị đuổi ở MỌI nước → một quân / nhiều quân luân phiên đuổi nhiều quân (Điểm 4) → hòa

  for (const targetId of commonTargets) {
    const onTarget = counted.map((list) => list.filter((c) => c.targetId === targetId));
    // Mọi nước đều chỉ là đòi đổi quân cùng loại → đòi đổi mãi / thí mãi (Điểm 10, 24.20, 24.36) → không phạm.
    // Có ít nhất một nước bắt thật → vẫn là bắt mãi (Điểm 8, 24.32).
    if (onTarget.every((list) => list.every((c) => c.isExchangeOffer))) continue;

    const chasers = new Map<number, PieceType>();
    for (const list of onTarget) for (const c of list) chasers.set(c.chaserId, c.chaserType);
    const others = [...chasers.values()].filter((t) => !isKingOrPawn(t)).length;
    const kingOrPawn = chasers.size - others;
    // Điểm 9: Tướng / Tốt bắt mãi → hòa; phối hợp với MỘT Xe/Mã/Pháo cũng hòa (24.24, 24.25).
    // Phối hợp với từ hai quân khác trở lên → bắt mãi (24.26 hình 71–73).
    if (others === 0) continue;
    if (kingOrPawn > 0 && others <= 1) continue;

    const infos = onTarget.flat();
    const first = infos[0];
    const chase = {
      chaserId: first.chaserId,
      chaserType: first.chaserType,
      targetId,
      targetType: first.targetType,
    };
    const chaserIds = [...chasers.keys()];
    let rule: string;
    if (chasers.size > 1) {
      rule = 'Điều 23 – Điểm 3 câu 2 (nhiều quân bắt mãi một quân)';
    } else if (infos.some((c) => c.targetProtected && isMinorOnRook(c))) {
      rule = 'Điều 23 – Điểm 6 (Mã/Pháo bắt Xe)';
    } else if (infos.some((c) => c.targetProtected && c.targetImmobile)) {
      rule = 'Điều 23 – Điểm 7 (quân có căn nhưng không đi được)';
    } else {
      rule = 'Điều 23 – Điểm 3';
    }
    return { rule, chase, chaserIds };
  }
  return null;
}

/** Mọi nước ăn hợp lệ của phe `color` (bỏ ăn Tướng) trong thế `pos`: Map ô quân ta → các ô quân địch. */
function captureMap(pos: Position, color: Color): Map<Square, Square[]> {
  const probe = pos.clone();
  probe.sideToMove = color; // "nước đi giả định": chỉ dùng để sinh nước, không dùng hash
  const map = new Map<Square, Square[]>();
  for (const m of probe.generateLegalMoves()) {
    const target = probe.board[m.to];
    if (target === null || target.color === color || target.type === 'k') continue;
    const list = map.get(m.from) ?? [];
    list.push(m.to);
    map.set(m.from, list);
  }
  return map;
}

/** Sau khi quân ở `from` ăn quân tại `target`, bên bị ăn có ăn lại hợp lệ ngay được không (căn thật). */
function canRecapture(pos: Position, from: Square, target: Square, attacker: Color): boolean {
  const probe = pos.clone();
  probe.sideToMove = attacker;
  probe.applyMove({ from, to: target });
  return probe.generateLegalMoves().some((m) => m.to === target);
}

function findNewChases(
  before: Position,
  idsBefore: readonly (number | null)[],
  after: Position,
  idsAfter: readonly (number | null)[],
  movedId: number,
): ChaseInfo[] {
  const mover = before.sideToMove;
  const opponent = opponentOf(mover);
  const pairsBefore = new Set<string>();
  for (const [from, targets] of captureMap(before, mover)) {
    for (const to of targets) pairsBefore.add(`${idsBefore[from]}:${idsBefore[to]}`);
  }

  // Góc nhìn bên bị đuổi: quân bị đuổi còn đi được không, có ăn lại ngay quân đuổi được không
  const defender = after.clone();
  defender.sideToMove = opponent;

  const chases: ChaseInfo[] = [];
  for (const [from, targets] of captureMap(after, mover)) {
    const chaserId = idsAfter[from] as number;
    const chaser = after.board[from] as Piece;
    for (const targetSquare of targets) {
      const targetId = idsAfter[targetSquare] as number;
      // Chỉ tính mối đe dọa MỚI: cặp (quân đuổi, quân bị đuổi) chưa có trước nước đi
      if (pairsBefore.has(`${chaserId}:${targetId}`)) continue;
      const target = after.board[targetSquare] as Piece;
      const targetMoves = defender.generatePieceMoves(targetSquare);
      chases.push({
        chaserId,
        chaserType: chaser.type,
        targetId,
        targetType: target.type,
        targetSquare,
        targetIsUncrossedPawn:
          target.type === 'p' && !hasCrossedRiver(target.color, squareToCoord(targetSquare).row),
        targetProtected: canRecapture(after, from, targetSquare, mover),
        targetImmobile: targetMoves.length === 0,
        isExchangeOffer: target.type === chaser.type && targetMoves.some((m) => m.to === from),
        discovered: chaserId !== movedId,
      });
    }
  }
  return chases;
}
