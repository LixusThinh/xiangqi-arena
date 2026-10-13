# Đặc tả Kiến trúc và Hiện thực Engine Luật Cờ Tướng (`packages/xiangqi-core`)

> **Mục đích tài liệu**: Cung cấp thiết kế chi tiết, giải thuật và lộ trình kỹ thuật để triển khai toàn diện Engine luật Cờ Tướng (Xiangqi Engine) cho dự án **Xiangqi Arena**, kế thừa kinh nghiệm tối ưu từ dự án tham khảo `ChineseChess` (thuật toán cản mã, ngòi pháo, lộ mặt tướng, vị trí cung và qua sông).

---

## 1. Triết lý Thiết kế & Phân tầng Kiến trúc

```text
       ┌────────────────────────────────────────────────────────┐
       │                packages/xiangqi-core                   │
       │  (Pure TypeScript · Zero Runtime Dependencies · $O(1)$) │
       └───────────────────────────┬────────────────────────────┘
                                   │ pnpm workspace link
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
       ┌──────────────────────┐          ┌──────────────────────┐
       │     apps/server      │          │       apps/web       │
       │   (NestJS Backend)   │          │  (Next.js Frontend)  │
       │                      │          │                      │
       │ - GameService        │          │ - Board render (SVG) │
       │ - Server Validation  │          │ - Move hints (dots)  │
       │ - Anti-cheat / Sync  │          │ - Optimistic UI drag │
       │ - ELO & DB Logging   │          │ - Client validation  │
       └──────────────────────┘          └──────────────────────┘
```

### Nguyên tắc bất biến (Invariants)
1. **Zero External Dependencies**: Tuyệt đối không import thư viện ngoài (không React, không NestJS, không DB). Toàn bộ engine chạy được đồng nhất trên cả Node.js, Web Browser, Web Worker.
2. **Single Source of Truth**: Cả Frontend và Backend đều dùng chung một bộ quy tắc và logic từ package này, triệt tiêu nguy cơ lệch luật (desync).
3. **Phân tách $O(1)$**: Toàn bộ thao tác cập nhật bàn cờ (`applyMove`, `undoMove`), băm bàn cờ (`zobristHash`), và tra cứu ô cờ đều đạt độ phức tạp hằng số $O(1)$.

---

## 2. Mô hình Biểu diễn Dữ liệu (Core Data Structures)

### 2.1. Hệ toạ độ 1D (0..89)
Bàn cờ gồm 9 cột ($0 \le c \le 8$, tương ứng files `a` đến `i`) và 10 hàng ($0 \le r \le 9$, tương ứng ranks `0` đến `9`).

```text
(Black Back Rank)
Row 0: [ 0] [ 1] [ 2] [ 3] [ 4] [ 5] [ 6] [ 7] [ 8]  <-- Cung Đen: c in [3..5], r in [0..2]
Row 1: [ 9] [10] [11] [12] [13] [14] [15] [16] [17]
Row 2: [18] [19] [20] [21] [22] [23] [24] [25] [26]  <-- Pháo Đen (sq 19, 25)
Row 3: [27] [28] [29] [30] [31] [32] [33] [34] [35]  <-- Tốt Đen (sq 27, 29, 31, 33, 35)
Row 4: [36] [37] [38] [39] [40] [41] [42] [43] [44]  <-- Bờ sông bên Đen
~~~~~~~~~~~~~~~~~~~ SÔNG SỞ HÀ HÁN GIỚI ~~~~~~~~~~~~~~~~~~~
Row 5: [45] [46] [47] [48] [49] [50] [51] [52] [53]  <-- Bờ sông bên Đỏ
Row 6: [54] [55] [56] [57] [58] [59] [60] [61] [62]  <-- Tốt Đỏ (sq 54, 56, 58, 60, 62)
Row 7: [63] [64] [65] [66] [67] [68] [69] [70] [71]  <-- Pháo Đỏ (sq 64, 70)
Row 8: [72] [73] [74] [75] [76] [77] [78] [79] [80]
Row 9: [81] [82] [83] [84] [85] [86] [87] [88] [89]  <-- Cung Đỏ: c in [3..5], r in [7..9]
(Red Back Rank)
```

- **Công thức chuyển đổi**:
  - `sq = r * 9 + c`
  - `c = sq % 9`, `r = Math.floor(sq / 9)`
  - Toạ độ đại số: `squareToAlgebraic(sq)` (ví dụ `sq=64` $\rightarrow$ `b7`).

### 2.2. Kiểu dữ liệu (`types.ts`)
```typescript
export type Color = 'r' | 'b';
export type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p';

export interface Piece {
  color: Color;
  type: PieceType;
}

export type Square = number; // 0..89

export interface Move {
  from: Square;
  to: Square;
}

export interface MoveUndo {
  move: Move;
  captured: Piece | null;
  prevHalfMoveClock: number;
  prevZobristHash: bigint;
}
```

---

## 3. Thuật toán Kiểm tra & Sinh Nước Đi (Move Generation Rules)

Để xây dựng các issue tiếp theo (`XQA-44: MoveGen Tướng/Sĩ/Tượng/Mã`, `XQA-45: MoveGen Xe/Pháo/Tốt`), thuật toán được chia làm 2 giai đoạn:
1. **Pseudo-Legal Move**: Sinh nước đi tuân thủ luật di chuyển vật lý của quân cờ.
2. **Legal Move**: Nước đi sau khi thực hiện không được khiến Tướng phe mình bị chiếu và không phạm luật lộ mặt tướng.

### 3.1. Tướng (General / King - `k`)
* **Quy tắc di chuyển**:
  - Chỉ đi ngang hoặc dọc đúng 1 ô: `|dr| + |dc| === 1`.
  - Phải luôn nằm trong Cung tướng:
    - Cột: `3 <= tc && tc <= 5`.
    - Hàng: `7 <= tr && tr <= 9` (Đỏ) hoặc `0 <= tr && tr <= 2` (Đen).
* **Quy tắc Lộ mặt Tướng (Flying General)**:
  - Nếu Tướng của hai bên nằm trên cùng một cột (`fc === tc`), và giữa hai Tướng **không có bất kỳ quân cản nào**:
  - Tướng được phép "bay" ăn trực tiếp Tướng đối phương.
  - Ngược lại: Mọi nước đi của các quân khác làm lộ mặt hai Tướng mà không có vật cản đều là **bất hợp lệ (Illegal Move)**.

### 3.2. Sĩ (Advisor - `a`)
* **Quy tắc di chuyển**:
  - Đi chéo đúng 1 ô: `|dr| === 1 && |dc| === 1`.
  - Chỉ được đứng tại 5 điểm cố định trong Cung tướng:
    - Đỏ: `d9(84)`, `f9(86)`, `e8(76)`, `d7(66)`, `f7(68)`.
    - Đen: `d0(3)`, `f0(5)`, `e1(13)`, `d2(21)`, `f2(23)`.
  - Kiểm tra Cung: `3 <= tc && tc <= 5` và `(tr >= 7 || tr <= 2)`.

### 3.3. Tượng (Elephant / Bishop - `b`)
* **Quy tắc di chuyển**:
  - Đi chéo 2 ô hình chữ Điền: `|dr| === 2 && |dc| === 2`.
  - **Không được qua sông**:
    - Tượng Đỏ: `tr >= 5` (chỉ ở nửa sân Đỏ).
    - Tượng Đen: `tr <= 4` (chỉ ở nửa sân Đen).
  - **Kiểm tra Mắt Tượng (Blocking Elephant)**:
    - Điểm chính giữa ô xuất phát và ô đích phải là ô trống:
      $$\text{eyeSquare} = \text{coordToSquare}\left(fc + \frac{dc}{2}, fr + \frac{dr}{2}\right)$$
    - Nếu `board[eyeSquare] !== null` $\rightarrow$ Tượng bị cản (bị chẹn mắt), không thể đi.

### 3.4. Mã (Horse / Knight - `n`)
* **Quy tắc di chuyển**:
  - Đi theo hình chữ L: (`|dr| === 2 && |dc| === 1`) hoặc (`|dr| === 1 && |dc| === 2`).
  - **Kiểm tra Cản Mã (Chân Mã / Hobbling)**:
    - Nếu đi dọc 2 ô (`|dr| === 2`): Ô cản nằm tại `(fc, fr + dr / 2)`.
    - Nếu đi ngang 2 ô (`|dc| === 2`): Ô cản nằm tại `(fc + dc / 2, fr)`.
    - Nếu ô cản có quân cờ đứng chắn $\rightarrow$ Mã bị cản chân, không thể đi.

### 3.5. Xe (Chariot / Rook - `r`)
* **Quy tắc di chuyển**:
  - Đi thẳng ngang hoặc dọc không giới hạn khoảng cách: `fr === tr || fc === tc`.
  - **Đường đi phải hoàn toàn thông suốt**:
    - Quét toàn bộ các ô nằm giữa `from` và `to`.
    - Nếu có bất kỳ quân nào chắn giữa $\rightarrow$ Không hợp lệ.
  - Ô đích phải là ô trống hoặc là quân của đối phương (ăn quân).

### 3.6. Pháo (Cannon - `c`)
* **Quy tắc di chuyển**:
  - Đi thẳng ngang hoặc dọc giống hệt Xe: `fr === tr || fc === tc`.
  - Đếm số quân cản ở giữa (`hurdles`):
    - **Nước đi thường (không ăn quân, ô đích trống)**: Bắt buộc $\text{hurdles} = 0$ (đường đi hoàn toàn thông suốt như Xe).
    - **Nước đi ăn quân (ô đích có quân đối phương)**: Bắt buộc $\text{hurdles} = 1$ (phải nhảy qua đúng 1 ngòi cản).

### 3.7. Tốt (Pawn / Soldier - `p`)
* **Quy tắc di chuyển**:
  - Hướng tiến: Đỏ đi lên (`dr = -1`), Đen đi xuống (`dr = +1`).
  - **Chưa qua sông**:
    - Đỏ: `fr >= 5`; Đen: `fr <= 4`.
    - Chỉ được tiến thẳng đúng 1 ô: `dr === forward && dc === 0`.
  - **Đã qua sông**:
    - Đỏ: `fr <= 4`; Đen: `fr >= 5`.
    - Được tiến thẳng 1 ô HOẶC đi ngang 1 ô: `(dr === forward && dc === 0) || (dr === 0 && |dc| === 1)`.
  - **Bất biến**: Tốt không bao giờ được phép đi lùi.

---

## 4. Xử lý Chiếu Tướng, Hết Cờ và Hòa Cờ

### 4.1. Hàm `isSquareAttacked(sq: Square, byColor: Color): boolean`
Xác định một ô có đang bị đe dọa bởi đối phương hay không:
- Có Xe đối phương cùng hàng/cột và đường đi trống?
- Có Pháo đối phương cùng hàng/cột với đúng 1 ngòi ở giữa?
- Có Mã đối phương có thể nhảy tới mà không bị cản chân?
- Có Tốt đối phương ở cự ly tấn công 1 ô?
- Có Tướng đối phương đối mặt trực tiếp trên cùng cột?

### 4.2. Kiểm tra Chiếu Tướng (`isCheck(color: Color): boolean`)
1. Tìm toạ độ Tướng của phe `color`.
2. Gọi `isSquareAttacked(kingSq, opponentColor)`.

### 4.3. Sinh Nước Đi Hợp Lệ (`generateLegalMoves(position: Position): Move[]`)
```typescript
function generateLegalMoves(pos: Position): Move[] {
  const pseudoMoves = generatePseudoLegalMoves(pos);
  const legalMoves: Move[] = [];

  for (const move of pseudoMoves) {
    const undo = pos.applyMove(move);
    // Sau khi đi, nếu Tướng của phe vừa đi KHÔNG bị chiếu thì nước đi hợp lệ
    // Lưu ý: Sau applyMove, lượt đã đổi, nên kiểm tra bên vừa đi (opponent của sideToMove hiện tại)
    const movingColor = pos.sideToMove === 'r' ? 'b' : 'r';
    if (!pos.isCheck(movingColor) && !pos.isFlyingGeneralFaceToFace()) {
      legalMoves.push(move);
    }
    pos.undoMove(undo);
  }

  return legalMoves;
}
```

### 4.4. Xử lý Kết thúc Ván cờ
- **Chiếu bí (Checkmate)**: `isCheck(pos.sideToMove) === true` và `generateLegalMoves(pos).length === 0` $\rightarrow$ Bên bị chiếu THUA.
- **Hết nước đi (Stalemate / Khốn bí)**: `isCheck(pos.sideToMove) === false` và `generateLegalMoves(pos).length === 0` $\rightarrow$ Trong Cờ Tướng, bên hết nước đi bị xử **THUA** (khác với Cờ Vua là hòa).
- **Hòa cờ 60 nước (Halfmove Clock)**: `pos.halfMoveClock >= 120` (60 hiệp của cả 2 bên không ăn quân).
- **Lặp nước bất biến (Repetition)**: Kiểm tra `zobristHash` xuất hiện 3 lần trong mảng lịch sử ván cờ.

---

## 5. Lộ trình Phân chia Module & Issue tiếp theo

| Issue | Nội dung thực hiện | Module tương ứng | Phụ thuộc |
|---|---|---|---|
| **XQA-42** (Đã xong) | Board 90 ô, FEN parser/export, Apply/Undo move, Zobrist Hash | `coordinates.ts`, `fen.ts`, `zobrist.ts`, `position.ts` | Không |
| **XQA-44** | MoveGen: Tướng, Sĩ, Tượng, Mã (kèm cản mã, mắt tượng, lộ mặt tướng) | `src/movegen/king.ts`, `advisor.ts`, `elephant.ts`, `horse.ts` | XQA-42 |
| **XQA-45** | MoveGen: Xe, Pháo, Tốt (kèm ngòi pháo, qua sông, thông đường) | `src/movegen/chariot.ts`, `cannon.ts`, `pawn.ts` | XQA-42 |
| **XQA-46** | Kiểm tra chiếu (`isCheck`), hợp lệ hóa nước đi (`legalMoves`), Chiếu bí & Khốn bí | `src/rules/check.ts`, `src/rules/game-status.ts` | XQA-44, XQA-45 |
| **XQA-43** | Frontend: Tích hợp `xiangqi-core` vào Next.js Board SVG, hiển thị chấm gợi ý nước đi | `apps/web/components/Board.tsx` | XQA-42, XQA-46 |

---

## 6. Hướng dẫn Tích hợp vào Frontend và Backend

### 6.1. Dùng trong Frontend Next.js (`apps/web`)
```tsx
import { Position, squareToCoord, Move } from '@xiangqi-arena/xiangqi-core';

export function BoardComponent({ fen }: { fen: string }) {
  const [pos, setPos] = useState(() => Position.fromFen(fen));
  const [selectedSq, setSelectedSq] = useState<number | null>(null);

  // Lấy danh sách nước đi gợi ý cho quân đang chọn
  const validDestinations = useMemo(() => {
    if (selectedSq === null) return [];
    return pos.generateLegalMoves().filter(m => m.from === selectedSq).map(m => m.to);
  }, [pos, selectedSq]);

  const handleSquareClick = (sq: number) => {
    if (selectedSq !== null && validDestinations.includes(sq)) {
      // Optimistic update UI ngay tức thì
      const newPos = pos.clone();
      newPos.applyMove({ from: selectedSq, to: sq });
      setPos(newPos);
      setSelectedSq(null);

      // Gửi nước đi lên server qua Socket.IO
      socket.emit('match:move', { from: selectedSq, to: sq });
    } else {
      setSelectedSq(sq);
    }
  };
  // Render bàn cờ và vẽ các chấm tròn gợi ý tại validDestinations...
}
```

### 6.2. Dùng trong Backend NestJS (`apps/server`)
```typescript
import { Position, toHashString } from '@xiangqi-arena/xiangqi-core';

@Injectable()
export class GameService {
  async processMove(matchId: bigint, moveDto: MoveDto) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    const pos = Position.fromFen(match.currentFen);

    // 1. Thẩm định nước đi hợp lệ
    const legalMoves = pos.generateLegalMoves();
    const isLegal = legalMoves.some(m => m.from === moveDto.from && m.to === moveDto.to);
    if (!isLegal) {
      throw new BadRequestException('Nước đi không hợp lệ');
    }

    // 2. Thực thi nước đi & tính hash
    const undo = pos.applyMove({ from: moveDto.from, to: moveDto.to });
    const newFen = pos.toFen();
    const newHash = pos.toHashString();

    // 3. Cập nhật Database và Broadcast Socket cho cả 2 đấu thủ
    await this.prisma.$transaction([
      this.prisma.move.create({
        data: {
          matchId,
          ply: match.currentPly + 1,
          fromSq: squareToAlgebraic(moveDto.from),
          toSq: squareToAlgebraic(moveDto.to),
          fenAfter: newFen,
          positionHash: newHash,
        }
      }),
      this.prisma.match.update({
        where: { id: matchId },
        data: {
          currentFen: newFen,
          currentPly: { increment: 1 },
        }
      })
    ]);

    this.matchGateway.broadcastMove(matchId, { ...moveDto, fen: newFen });
  }
}
```
