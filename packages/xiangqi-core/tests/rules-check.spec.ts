import {
  Move,
  Position,
  algebraicToSquare,
  findKing,
  generatePieceMoves,
  isInCheck,
  opponentOf,
  squareToAlgebraic,
} from '../src';

function mv(from: string, to: string): Move {
  return { from: algebraicToSquare(from), to: algebraicToSquare(to) };
}

function legalSet(pos: Position): string[] {
  return pos
    .generateLegalMoves()
    .map((m) => `${squareToAlgebraic(m.from)}${squareToAlgebraic(m.to)}`)
    .sort();
}

/** Đếm số nút cây nước đi hợp lệ tới độ sâu `depth` (perft). */
function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const m of pos.generateLegalMoves()) {
    const undo = pos.applyMove(m);
    nodes += perft(pos, depth - 1);
    pos.undoMove(undo);
  }
  return nodes;
}

/** Kiểm tra chiếu kiểu "vét cạn": có nước pseudo-legal nào của đối phương đi vào ô Tướng không. */
function bruteForceInCheck(pos: Position, color: 'r' | 'b'): boolean {
  const kingSq = findKing(pos.board, color);
  if (kingSq === null) return false;
  const enemy = opponentOf(color);
  for (let sq = 0; sq < 90; sq++) {
    if (generatePieceMoves(pos.board, sq, enemy).some((m) => m.to === kingSq)) return true;
  }
  return false;
}

/** PRNG tất định để test random playout lặp lại được. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Chiếu, lộ mặt tướng, lọc nước tự chiếu, chiếu bí / hết nước – XQA-49', () => {
  describe('isCheck', () => {
    it('thế khai cuộc không bên nào bị chiếu', () => {
      const pos = Position.initial();
      expect(pos.isCheck('r')).toBe(false);
      expect(pos.isCheck('b')).toBe(false);
    });

    it('nhận diện chiếu bởi Xe, Pháo (1 ngòi), Mã (không cản chân), Tốt', () => {
      expect(Position.fromFen('3kr4/9/9/9/9/9/9/9/9/4K4 r - - 0 1').isCheck()).toBe(true); // Xe
      expect(Position.fromFen('3kc4/9/9/9/9/4P4/9/9/9/4K4 r - - 0 1').isCheck()).toBe(true); // Pháo + ngòi
      expect(Position.fromFen('3k5/9/9/9/9/9/9/5n3/9/4K4 r - - 0 1').isCheck()).toBe(true); // Mã f7 → e9
      expect(Position.fromFen('3k5/9/9/9/9/9/9/5n3/5P3/4K4 r - - 0 1').isCheck()).toBe(false); // chân Mã f8 bị cản
      expect(Position.fromFen('3k5/9/9/9/9/9/9/9/4p4/4K4 r - - 0 1').isCheck()).toBe(true); // Tốt tiến
      expect(Position.fromFen('3k5/9/9/9/9/9/9/9/9/3pK4 r - - 0 1').isCheck()).toBe(true); // Tốt đi ngang
    });

    it('Pháo không chiếu khi 0 ngòi hoặc 2 ngòi', () => {
      // Pháo đen e2, Tướng đỏ e9, không ngòi
      expect(Position.fromFen('3k5/9/4c4/9/9/9/9/9/9/4K4 r - - 0 1').isCheck()).toBe(false);
      // 2 ngòi e5, e6
      expect(Position.fromFen('3k5/9/4c4/9/9/4P4/4P4/9/9/4K4 r - - 0 1').isCheck()).toBe(false);
    });

    it('Tốt chỉ chiếu theo hướng đi: tiến hoặc ngang (đã qua sông), không chiếu ngược ra sau', () => {
      // Tốt đỏ d2 tiến lên d1 bắt được Tướng đen d1 → chiếu
      expect(Position.fromFen('9/3k5/3P5/9/9/9/9/9/9/4K4 b - - 0 1').isCheck()).toBe(true);
      // Tốt đỏ c1 đã qua sông, đi ngang sang d1 → chiếu
      expect(Position.fromFen('9/2Pk5/9/9/9/9/9/9/9/4K4 b - - 0 1').isCheck()).toBe(true);
      // Tốt đỏ d0 nằm sau Tướng đen d1: Tốt không lùi → không chiếu
      expect(Position.fromFen('3P5/3k5/9/9/9/9/9/9/9/4K4 b - - 0 1').isCheck()).toBe(false);
    });

    it('hai Tướng đối mặt trên cùng cột không che được tính là bị chiếu', () => {
      expect(Position.fromFen('4k4/9/9/9/9/9/9/9/9/4K4 r - - 0 1').isCheck()).toBe(true);
      expect(Position.fromFen('4k4/9/9/9/4P4/9/9/9/9/4K4 r - - 0 1').isCheck()).toBe(false);
    });

    it('isInCheck khớp với kiểm tra vét cạn trên 200 ván ngẫu nhiên', () => {
      const rand = mulberry32(49);
      let checked = 0;
      for (let game = 0; game < 200; game++) {
        const pos = Position.initial();
        for (let ply = 0; ply < 80; ply++) {
          for (const color of ['r', 'b'] as const) {
            expect(isInCheck(pos.board, color)).toBe(bruteForceInCheck(pos, color));
            checked++;
          }
          const moves = pos.generateLegalMoves();
          if (moves.length === 0) break;
          pos.applyMove(moves[Math.floor(rand() * moves.length)]);
        }
      }
      expect(checked).toBeGreaterThan(10000);
    });
  });

  describe('Lọc nước tự chiếu & lộ mặt tướng (AC2)', () => {
    it('perft khai cuộc: 44 / 1920 / 79666 nước hợp lệ ở độ sâu 1 / 2 / 3', () => {
      const pos = Position.initial();
      expect(perft(pos, 1)).toBe(44);
      expect(perft(pos, 2)).toBe(1920);
      expect(perft(pos, 3)).toBe(79666);
      expect(pos.toFen()).toBe(Position.initial().toFen()); // apply/undo trả bàn cờ về nguyên trạng
    });

    it('legalMoves không bao giờ chứa nước làm Tướng mình bị chiếu (random playout)', () => {
      const rand = mulberry32(2026);
      for (let game = 0; game < 100; game++) {
        const pos = Position.initial();
        for (let ply = 0; ply < 80; ply++) {
          const mover = pos.sideToMove;
          const moves = pos.generateLegalMoves();
          for (const m of moves) {
            const undo = pos.applyMove(m);
            expect(pos.isCheck(mover)).toBe(false);
            expect(pos.hasFlyingGeneral()).toBe(false);
            pos.undoMove(undo);
          }
          if (moves.length === 0) break;
          pos.applyMove(moves[Math.floor(rand() * moves.length)]);
        }
      }
    });

    it('Tướng không được bước sang cột đối mặt trực tiếp Tướng đối phương', () => {
      const pos = Position.fromFen('3k5/9/9/9/9/9/9/9/9/4K4 r - - 0 1');
      expect(pos.isLegalMove(mv('e9', 'd9'))).toBe(false);
      expect(pos.isLegalMove(mv('e9', 'e8'))).toBe(true);
    });

    it('quân che duy nhất giữa hai Tướng không được rời cột', () => {
      const pos = Position.fromFen('4k4/9/9/9/4P4/9/9/9/9/4K4 r - - 0 1');
      expect(pos.isLegalMove(mv('e4', 'd4'))).toBe(false);
      expect(pos.isLegalMove(mv('e4', 'f4'))).toBe(false);
      expect(pos.isLegalMove(mv('e4', 'e3'))).toBe(true);
    });

    it('quân bị ghim chỉ được đi trên đường ghim', () => {
      // Xe đỏ e5 bị Xe đen e1 ghim vào Tướng đỏ e9
      const pos = Position.fromFen('3k5/4r4/9/9/9/4R4/9/9/9/4K4 r - - 0 1');
      expect(pos.isLegalMove(mv('e5', 'd5'))).toBe(false);
      expect(pos.isLegalMove(mv('e5', 'e6'))).toBe(true);
      expect(pos.isLegalMove(mv('e5', 'e1'))).toBe(true); // ăn quân ghim
    });

    it('khi bị chiếu chỉ còn nước chạy Tướng hoặc chặn chiếu', () => {
      // Xe đen e0 chiếu Tướng đỏ e9; Xe đỏ a5 chặn được tại e5; Tướng chạy f9 (d9 đối mặt Tướng đen)
      const pos = Position.fromFen('3kr4/9/9/9/9/R8/9/9/9/4K4 r - - 0 1');
      expect(pos.isCheck()).toBe(true);
      expect(legalSet(pos)).toEqual(['a5e5', 'e9f9']);
    });

    it('được bắt quân đang chiếu', () => {
      // Mã đỏ f2 bắt được Xe đen e0 đang chiếu
      const pos = Position.fromFen('3kr4/9/5N3/9/9/9/9/9/9/4K4 r - - 0 1');
      expect(pos.isLegalMove(mv('f2', 'e0'))).toBe(true);
      expect(pos.isLegalMove(mv('f2', 'g0'))).toBe(false); // không giải chiếu
    });

    it('Position.generatePieceMoves (FE highlight) chỉ trả nước hợp lệ', () => {
      const pos = Position.fromFen('3k5/4r4/9/9/9/4R4/9/9/9/4K4 r - - 0 1');
      const tos = pos.generatePieceMoves(algebraicToSquare('e5')).map((m) => squareToAlgebraic(m.to));
      expect(tos.sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e6', 'e7', 'e8']);
      expect(pos.generatePseudoLegalPieceMoves(algebraicToSquare('e5')).length).toBeGreaterThan(tos.length);
    });
  });

  describe('Kết thúc ván: chiếu bí / hết nước (AC1, hợp đồng XQA-216)', () => {
    it('ván đang diễn ra: result = null', () => {
      expect(Position.initial().getGameStatus()).toEqual({ turn: 'r', inCheck: false, result: null });
    });

    it('chiếu bí: Đen bị Xe chiếu, Tướng không chạy được → Đỏ thắng (Điều 7.1a)', () => {
      // Xe đỏ a0 chiếu hàng 0; Xe đỏ a1 khống chế d1; e0 vẫn trên hàng của Xe và đối mặt Tướng đỏ e9
      const pos = Position.fromFen('R2k5/R8/9/9/9/9/9/9/9/4K4 b - - 0 1');
      expect(pos.generateLegalMoves()).toHaveLength(0);
      expect(pos.getGameStatus()).toEqual({
        turn: 'b',
        inCheck: true,
        result: { winner: 'r', reason: 'checkmate' },
      });
    });

    it('hết nước khi không bị chiếu → bên hết nước thua (Điều 7.1b) – Đen', () => {
      const pos = Position.fromFen('3k5/9/9/2N6/9/9/9/9/9/4K4 b - - 0 1');
      expect(pos.getGameStatus()).toEqual({
        turn: 'b',
        inCheck: false,
        result: { winner: 'r', reason: 'no_moves' },
      });
    });

    it('hết nước khi không bị chiếu → bên hết nước thua (Điều 7.1b) – Đỏ', () => {
      const pos = Position.fromFen('4k4/9/9/9/9/9/2n6/9/9/3K5 r - - 0 1');
      expect(pos.getGameStatus()).toEqual({
        turn: 'r',
        inCheck: false,
        result: { winner: 'b', reason: 'no_moves' },
      });
    });

    it('bị chiếu nhưng còn đỡ được thì chưa kết thúc', () => {
      const status = Position.fromFen('3kr4/9/9/9/9/R8/9/9/9/4K4 r - - 0 1').getGameStatus();
      expect(status).toEqual({ turn: 'r', inCheck: true, result: null });
    });
  });
});
