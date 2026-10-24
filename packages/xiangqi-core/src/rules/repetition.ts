import { squareToCoord } from '../coordinates';
import { hasCrossedRiver } from '../movegen/pawn';
import type { Position } from '../position';
import { Color, Move, Piece, PieceType, Square } from '../types';
import { opponentOf } from './check';

/**
 * RepetitionJudge – phần 1 (XQA-78): lịch sử thế cờ, phát hiện lặp, nhận diện nước chiếu / nước đuổi bắt,
 * và xử các mẫu rõ ràng của Điều 23 (luat_co_tuong_viet_nam.pdf, Chương 5).
 *
 * Phân biệt 3 tầng (theo quy ước dự án):
 * - LUẬT CỜ: Điều 22 (thuật ngữ), Điều 23 (10 điểm), Điều 24.2, Điều 7.2b/c.
 * - BUSINESS RULE của hệ thống: thế cờ lặp lại đủ `threshold` lần (mặc định 3 = RuleProfile.repetitionThreshold
 *   trong seed) thì mới xét xử. Luật chỉ nói "không thay đổi nước đi", không quy định số lần.
 * - QUYẾT ĐỊNH THIẾT KẾ phần 1: chỉ xét "đuổi bắt" do CHÍNH quân vừa đi tạo ra (không xét nước mở đường cho quân
 *   khác bắt); mẫu nào phần 1 chưa đủ căn cứ xử thì trả `undetermined` để phần 2 (XQA-95) xử, KHÔNG đoán.
 */

/** Ngưỡng mặc định, khớp `repetitionThreshold` của RuleProfile trong apps/server/prisma/seed.ts. */
export const DEFAULT_REPETITION_THRESHOLD = 3;

export type MoveKind = 'check' | 'chase' | 'idle';

/** Một mối "dọa bắt" mới (Điều 22.4) do quân vừa đi tạo ra. */
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
  /** Có ở perpetual_chase: quân đuổi và quân bị đuổi. */
  chase?: Pick<ChaseInfo, 'chaserId' | 'chaserType' | 'targetId' | 'targetType'>;
}

export type RepetitionResult =
  | { kind: 'loss'; loser: Color; winner: Color; rule: string }
  | { kind: 'draw'; rule: string }
  /** Mẫu lặp mà phần 1 chưa đủ căn cứ xử (để RepetitionJudge phần 2 – XQA-95). Ván tiếp tục. */
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
    const side = before.sideToMove;
    const piece = before.board[move.from] as Piece;
    const pieceId = this.pieceIds[move.from] as number;
    const isCapture = before.board[move.to] !== null;

    this.position.applyMove(move);
    this.pieceIds[move.to] = pieceId;
    this.pieceIds[move.from] = null;

    const isCheck = this.position.isCheck(opponentOf(side));
    const chases = findNewChases(before, this.position, move, pieceId, this.pieceIds);
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

/**
 * Xử một chu kỳ lặp (các nước giữa lần đầu và lần hiện tại của thế cờ bị lặp). Hàm thuần, test được độc lập.
 */
export function judgeCycle(cycle: readonly MoveRecord[]): {
  violations: RepetitionViolation[];
  result: RepetitionResult;
} {
  const violations: RepetitionViolation[] = [];
  const unresolved: string[] = [];

  for (const side of ['r', 'b'] as const) {
    const moves = cycle.filter((m) => m.side === side);
    if (moves.length === 0) continue;

    if (moves.every((m) => m.isCheck)) {
      // Điểm 1: chiếu mãi (một quân hay nhiều quân thay nhau chiếu – Điều 24 hình 1–3) → xử thua
      violations.push({ side, type: 'perpetual_check', rule: 'Điều 23 – Điểm 1' });
      continue;
    }
    if (!moves.every((m) => m.kind === 'chase')) {
      // Có nước chiếu xen nước bắt / nước chờ: Điểm 2, Điểm 10 → không phạm luật, lặp thì xử hòa
      continue;
    }

    const pairsPerMove = moves.map(
      (m) => new Set(m.chases.map((c) => `${c.chaserId}:${c.targetId}`)),
    );
    const common = [...pairsPerMove[0]].filter((key) => pairsPerMove.every((s) => s.has(key)));
    if (common.length === 0) {
      const chasersPerMove = moves.map((m) => new Set(m.chases.map((c) => c.chaserId)));
      const singleChaser = [...chasersPerMove[0]].some((id) => chasersPerMove.every((s) => s.has(id)));
      if (singleChaser) {
        continue; // Điểm 4 câu 1: một quân lần lượt đuổi bắt mãi hai hoặc nhiều quân → hòa
      }
      // Nhiều quân thay nhau đuổi: Điểm 3 câu 2 (thua) và Điểm 4 câu 2 (hòa) cần phân tích sâu hơn → phần 2.
      unresolved.push(
        `${side === 'r' ? 'Đỏ' : 'Đen'}: nhiều quân thay nhau đuổi bắt liên tục (Điểm 3 câu 2 / Điểm 4 câu 2)`,
      );
      continue;
    }

    const [chaserId, targetId] = common[0].split(':').map(Number);
    const infos = moves.map(
      (m) => m.chases.find((c) => c.chaserId === chaserId && c.targetId === targetId) as ChaseInfo,
    );
    const { chaserType, targetType } = infos[0];
    const chase = { chaserId, chaserType, targetId, targetType };

    if (chaserType === 'k' || chaserType === 'p') {
      continue; // Điểm 9: Tướng hoặc Tốt bắt mãi → hòa (không phạm luật)
    }
    if (infos.every((c) => c.targetIsUncrossedPawn)) {
      continue; // Điểm 3 ngoại lệ: đuổi bắt mãi Tốt chưa qua sông được phép
    }
    if (infos.every((c) => c.targetProtected)) {
      if ((chaserType === 'n' || chaserType === 'c') && targetType === 'r') {
        // Điểm 6 câu 2: Mã/Pháo đuổi bắt mãi Xe có căn thật vẫn xử thua
        violations.push({ side, type: 'perpetual_chase', rule: 'Điều 23 – Điểm 6 (Mã/Pháo bắt Xe)', chase });
      }
      continue; // Điểm 6 câu 1: đuổi bắt mãi quân có căn thật → hòa
    }
    // Điểm 3 (và Điểm 6 vế "căn giả"): một quân đuổi bắt mãi một quân → xử thua
    violations.push({ side, type: 'perpetual_chase', rule: 'Điều 23 – Điểm 3', chase });
  }

  if (unresolved.length > 0) {
    return { violations, result: { kind: 'undetermined', reason: unresolved.join('; ') } };
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
  return {
    violations,
    result: { kind: 'undetermined', reason: 'Hai bên phạm hai loại vi phạm khác nhau (chiếu mãi và bắt mãi)' },
  };
}

/** Các ô có quân đối phương (trừ Tướng) mà quân ở `sq` ăn được hợp lệ nếu tới lượt phe `color`. */
function captureTargets(pos: Position, sq: Square, color: Color): Square[] {
  const probe = pos.clone();
  probe.sideToMove = color; // "nước đi giả định": chỉ dùng để sinh nước, không dùng hash
  return probe
    .generatePieceMoves(sq)
    .map((m) => m.to)
    .filter((to) => {
      const target = probe.board[to];
      return target !== null && target.color !== color && target.type !== 'k';
    });
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
  after: Position,
  move: Move,
  chaserId: number,
  pieceIds: (number | null)[],
): ChaseInfo[] {
  const mover = before.sideToMove;
  const chaser = after.board[move.to] as Piece;
  const threatenedBefore = new Set(captureTargets(before, move.from, mover));
  const chases: ChaseInfo[] = [];
  for (const targetSquare of captureTargets(after, move.to, mover)) {
    // Quân bị đuổi đứng yên trong nước này nên cùng ô = cùng quân → chỉ tính mối đe dọa MỚI
    if (threatenedBefore.has(targetSquare)) continue;
    const target = after.board[targetSquare] as Piece;
    chases.push({
      chaserId,
      chaserType: chaser.type,
      targetId: pieceIds[targetSquare] as number,
      targetType: target.type,
      targetSquare,
      targetIsUncrossedPawn:
        target.type === 'p' && !hasCrossedRiver(target.color, squareToCoord(targetSquare).row),
      targetProtected: canRecapture(after, move.to, targetSquare, mover),
    });
  }
  return chases;
}
