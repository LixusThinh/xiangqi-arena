# XQA-44 MoveGen Tướng, Sĩ, Tượng, Mã Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực module sinh nước đi (Move Generation) vật lý cho 4 quân cờ: Tướng (King), Sĩ (Advisor), Tượng (Elephant), Mã (Horse) với đầy đủ quy tắc cản chân mã, cản mắt tượng, giới hạn cung tướng, sông và luật lộ mặt tướng trong `@xiangqi-arena/xiangqi-core`.

**Architecture:** Tạo thư mục `src/movegen/` với các hàm generator chuyên biệt cho từng loại quân. Tích hợp dispatcher `generatePieceMoves` vào lớp `Position` cùng phương thức `hasFlyingGeneral()`. Mọi hàm nhận `(board, from, sideToMove)` hoặc `(pos)` và trả về mảng `Move[]`. 100% tuân thủ TypeScript strict và không phụ thuộc thư viện ngoài.

**Tech Stack:** TypeScript 5.8+, Jest 29+ (`ts-jest`), pnpm workspaces monorepo.

**Spec:** [docs/superpowers/specs/2026-10-14-xqa-44-movegen-tuong-si-tuong-ma-design.md](../specs/2026-10-14-xqa-44-movegen-tuong-si-tuong-ma-design.md)

---

### Task 1: MoveGen Tướng (King) & Kiểm tra Lộ Mặt Tướng

**Files:**
- Create: `packages/xiangqi-core/src/movegen/king.ts`
- Create: `packages/xiangqi-core/tests/movegen-king.spec.ts`

- [ ] **Step 1: Write failing tests in `tests/movegen-king.spec.ts`**
  - Test Tướng Đỏ đi trong cung (các ô biên, ô giữa).
  - Test Tướng không thể đi ra ngoài cung.
  - Test Tướng không thể đi vào ô có quân cùng phe.
  - Test Tướng ăn quân đối phương trong cung.
  - Test Flying General (Tướng bay ăn Tướng đối phương khi cùng cột và thông suốt).
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-king.spec.ts`
- [ ] **Step 3: Implement `src/movegen/king.ts`**
  - Triển khai `isInPalace`, `generateKingMoves`, `findOpponentKing`, `canFlyingGeneralCapture`.
- [ ] **Step 4: Run tests to verify passing**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-king.spec.ts`
- [ ] **Step 5: Commit**
  - Commit: `git add packages/xiangqi-core/src/movegen/king.ts packages/xiangqi-core/tests/movegen-king.spec.ts && git commit -m "feat(xiangqi-core): implement King movegen and flying general capture [XQA-44]"`

---

### Task 2: MoveGen Sĩ (Advisor)

**Files:**
- Create: `packages/xiangqi-core/src/movegen/advisor.ts`
- Create: `packages/xiangqi-core/tests/movegen-advisor.spec.ts`

- [ ] **Step 1: Write failing tests in `tests/movegen-advisor.spec.ts`**
  - Test Sĩ tại tâm cung (`e8` cho Đỏ, `e1` cho Đen) có 4 nước đi chéo đến 4 góc cung.
  - Test Sĩ tại góc cung (`d9`, `f9`, `d7`, `f7`) chỉ có 1 nước đi về tâm cung.
  - Test Sĩ không thể đi vào ô có quân cùng phe.
  - Test Sĩ ăn quân đối phương tại các điểm hợp lệ.
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-advisor.spec.ts`
- [ ] **Step 3: Implement `src/movegen/advisor.ts`**
  - Triển khai `isAdvisorSquare`, `generateAdvisorMoves`.
- [ ] **Step 4: Run tests to verify passing**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-advisor.spec.ts`
- [ ] **Step 5: Commit**
  - Commit: `git add packages/xiangqi-core/src/movegen/advisor.ts packages/xiangqi-core/tests/movegen-advisor.spec.ts && git commit -m "feat(xiangqi-core): implement Advisor movegen [XQA-44]"`

---

### Task 3: MoveGen Tượng (Elephant) & Cản Mắt Tượng

**Files:**
- Create: `packages/xiangqi-core/src/movegen/elephant.ts`
- Create: `packages/xiangqi-core/tests/movegen-elephant.spec.ts`

- [ ] **Step 1: Write failing tests in `tests/movegen-elephant.spec.ts`**
  - Test Tượng đi chéo 2 ô khi mắt thông suốt (tối đa 4 hướng).
  - Test Tượng bị cản mắt khi ô chính giữa có quân (bất kể phe ta hay phe địch).
  - Test Tượng không thể qua sông (Đỏ không qua hàng 4, Đen không qua hàng 5).
  - Test Tượng ăn quân đối phương tại điểm đến.
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-elephant.spec.ts`
- [ ] **Step 3: Implement `src/movegen/elephant.ts`**
  - Triển khai `generateElephantMoves`.
- [ ] **Step 4: Run tests to verify passing**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-elephant.spec.ts`
- [ ] **Step 5: Commit**
  - Commit: `git add packages/xiangqi-core/src/movegen/elephant.ts packages/xiangqi-core/tests/movegen-elephant.spec.ts && git commit -m "feat(xiangqi-core): implement Elephant movegen with eye blocking [XQA-44]"`

---

### Task 4: MoveGen Mã (Horse) & Cản Chân Mã

**Files:**
- Create: `packages/xiangqi-core/src/movegen/horse.ts`
- Create: `packages/xiangqi-core/tests/movegen-horse.spec.ts`

- [ ] **Step 1: Write failing tests in `tests/movegen-horse.spec.ts`**
  - Test Mã ở trung tâm bàn cờ có tối đa 8 nước nhảy khi không bị cản chân.
  - Test Mã bị cản chân dọc và cản chân ngang độc lập.
  - Test Mã ở biên bàn cờ (bỏ qua các ô ngoài bàn cờ).
  - Test Mã ăn quân đối phương và không thể nhảy vào ô quân cùng phe.
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-horse.spec.ts`
- [ ] **Step 3: Implement `src/movegen/horse.ts`**
  - Triển khai `generateHorseMoves`.
- [ ] **Step 4: Run tests to verify passing**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/movegen-horse.spec.ts`
- [ ] **Step 5: Commit**
  - Commit: `git add packages/xiangqi-core/src/movegen/horse.ts packages/xiangqi-core/tests/movegen-horse.spec.ts && git commit -m "feat(xiangqi-core): implement Horse movegen with leg blocking [XQA-44]"`

---

### Task 5: MoveGen Dispatcher & Tích hợp vào Lớp `Position`

**Files:**
- Create: `packages/xiangqi-core/src/movegen/index.ts`
- Modify: `packages/xiangqi-core/src/position.ts`
- Modify: `packages/xiangqi-core/src/index.ts`
- Create: `packages/xiangqi-core/tests/position-movegen.spec.ts`

- [ ] **Step 1: Write failing integration tests in `tests/position-movegen.spec.ts`**
  - Test `pos.generatePieceMoves(sq)` cho Tướng, Sĩ, Tượng, Mã trên thế cờ chuẩn FEN ban đầu.
  - Test `pos.hasFlyingGeneral()` phát hiện đúng khi 2 tướng đối mặt không có quân cản.
  - Test trả về `[]` nếu chọn ô trống hoặc quân của đối thủ (không phải `sideToMove`).
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test tests/position-movegen.spec.ts`
- [ ] **Step 3: Implement `src/movegen/index.ts` và nâng cấp `Position`**
  - Triển khai `generatePieceMoves` dispatcher.
  - Bổ sung `generatePieceMoves(sq: Square): Move[]` và `hasFlyingGeneral(): boolean` vào `Position`.
  - Re-export movegen trong `src/index.ts`.
- [ ] **Step 4: Run all tests in package**
  - Run: `pnpm --filter @xiangqi-arena/xiangqi-core test`
- [ ] **Step 5: Run monorepo build and test**
  - Run: `pnpm build && pnpm test`
- [ ] **Step 6: Commit**
  - Commit: `git add packages/xiangqi-core/src/movegen/index.ts packages/xiangqi-core/src/position.ts packages/xiangqi-core/src/index.ts packages/xiangqi-core/tests/position-movegen.spec.ts && git commit -m "feat(xiangqi-core): integrate movegen dispatcher and flying general check into Position [XQA-44]"`
