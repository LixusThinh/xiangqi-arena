# Đặc tả Thiết kế Kỹ thuật: Bàn cờ, FEN, Apply/Undo Move & Zobrist Hash (XQA-42)

## 1. Tóm tắt Yêu cầu & Bối cảnh (Understanding Summary)
* **Mục tiêu**: Xây dựng module hạt nhân `packages/xiangqi-core` làm nền tảng cho luật cờ tướng, quản lý bàn cờ 90 ô (9x10), parse/export chuỗi FEN chuẩn quốc tế (WXF/UCCI), thực thi và hoàn tác nước đi (`applyMove` / `undoMove`) trong thời gian $O(1)$, và sinh mã băm vi sai Zobrist hash 64-bit BigInt (xuất chuỗi 16 hex).
* **Đối tượng**: Backend NestJS (`GameService`, `MatchModule`), Frontend Next.js (`apps/web` render bàn cờ từ FEN), và Engine AI/MoveGen sau này.
* **Ràng buộc**: Pure TypeScript, không phụ thuộc vào React / Nest / Database. Phải tương thích Monorepo pnpm workspace và vượt qua 100% test suite trên CI.
* **Ngoài phạm vi (Non-goals)**: Chưa sinh nước đi hợp lệ (MoveGen Tướng, Sĩ, Tượng, Mã, Xe, Pháo, Tốt thuộc các issue tiếp theo); chưa tích hợp Web UI hay Database.

## 2. Nhật ký Quyết định (Decision Log)

| Quyết định | Các phương án đã cân nhắc | Lý do lựa chọn |
|---|---|---|
| **Mô hình Bàn cờ 1D 90 ô (`0..89`)** | Mảng 2D `[10][9]`, Mảng mở rộng Mailbox (`16x16`, `11x12`) | Khớp trực tiếp với component Board render SVG của Frontend; mảng phẳng 90 ô tối ưu bộ nhớ cache và phù hợp với bảng Zobrist. |
| **Ký hiệu quân WXF/UCCI quốc tế** | Ký hiệu tiếng Anh đơn giản (H, E) | Chuẩn quốc tế WXF: `K, A, B, N, R, C, P` (Đỏ viết hoa, Đen viết thường). Lượt đi `r`/`b`. Đảm bảo tính tương thích rộng với các công cụ cờ tướng chuẩn. |
| **Cơ chế Mutable vi sai + `MoveUndo`** | Pure Functional (sao chép mảng mỗi nước đi), Bitboards 90-bit | Đạt tốc độ tối đa $O(1)$ cho engine và MoveGen, không gây rác bộ nhớ (Zero Allocation); cung cấp kèm `.clone()` cho Frontend khi cần React state. |
| **Zobrist Hash 64-bit tất định (PRNG SplitMix64)** | Chuỗi băm SHA-256/MD5 từ FEN, Hash 32-bit thông thường | Khớp chính xác với kiểu cột `position_hash CHAR(16)` trong schema PostgreSQL Prisma; SplitMix64 với seed cố định đảm bảo đồng nhất trên mọi máy và cập nhật vi sai XOR siêu tốc. |
| **Phạm vi kiểm tra của `applyMove`** | Tích hợp MoveGen kiểm tra đường đi chi tiết | Tách bạch trách nhiệm (Separation of Concerns): `applyMove` chỉ cập nhật vị trí, lượt đi và hash; MoveGen phức tạp được phát triển theo các issue độc lập tiếp theo. |

## 3. Kiến trúc Chi tiết

### 3.1. Cấu trúc Thư mục
```text
packages/xiangqi-core/
├── src/
│   ├── types.ts          # Color, PieceType, Piece, Square, Move, MoveUndo
│   ├── constants.ts      # Kích thước bàn cờ, chuỗi FEN ban đầu
│   ├── coordinates.ts    # Helper toạ độ (index 0..89, col/row, algebraic a0..i9)
│   ├── zobrist.ts        # Thuật toán SplitMix64, bảng Zobrist 1260 keys + sideKey
│   ├── fen.ts            # Parser & Serializer FEN chuẩn WXF
│   ├── position.ts       # Lớp Position (applyMove, undoMove, toFen, clone)
│   └── index.ts          # Public entrypoint
├── tests/
│   ├── fen.spec.ts       # Unit tests FEN parse/export roundtrip
│   ├── position.spec.ts  # Unit tests applyMove, undoMove, capture, counters
│   └── zobrist.spec.ts   # Unit tests tính tất định và XOR vi sai
├── package.json
└── tsconfig.json
```

### 3.2. Kiểu dữ liệu cốt lõi (`types.ts`)
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

### 3.3. Chuỗi FEN khởi đầu chuẩn
```text
rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1
```

### 3.4. Zobrist Hash
* **Bộ sinh ngẫu nhiên**: SplitMix64 với seed `0x123456789ABCDEFn`.
* **Cập nhật vi sai**:
  $$H_{new} = H_{old} \oplus K[piece][from] \oplus K[piece][to] \oplus K[captured][to] \oplus SideKey$$
* **Xuất chuỗi 16 hex**:
  `toHashString(hash: bigint): string => (hash & 0xffffffffffffffffn).toString(16).padStart(16, '0')`

---

## 4. Kế hoạch Kiểm thử & Tiêu chí Nghiệm thu (Acceptance Criteria)
1. **FEN Round-trip**: `toFen(parseFen(STARTING_FEN)) === STARTING_FEN`.
2. **Apply & Undo Integrity**: Gọi `applyMove` rồi `undoMove` khôi phục chính xác 100% về FEN và Zobrist hash ban đầu.
3. **Multi-step Undo**: Thực hiện chuỗi 10-20 nước đi rồi undo toàn bộ, bàn cờ quay về nguyên trạng ban đầu.
4. **CI Testing**: Chạy qua `pnpm test` (sử dụng Jest với `ts-jest`) vượt qua toàn bộ test suites.
