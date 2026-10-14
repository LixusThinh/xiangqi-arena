# Thiết kế Kỹ thuật XQA-44: Bộ Sinh Nước Đi (MoveGen) cho Tướng, Sĩ, Tượng, Mã

- **Mã tính năng / Nhánh**: `feat/XQA-44-MoveGen-Tuong-Si-Tuong-Ma`
- **Gói áp dụng**: `@xiangqi-arena/xiangqi-core`
- **Ngày lập**: 14/10/2026
- **Trạng thái**: Đã duyệt (Approved)
- **Tài liệu tham chiếu**: [docs/engine/rules-and-movegen-spec.md](../../engine/rules-and-movegen-spec.md)

---

## 1. Mục tiêu & Phạm vi

Triển khai các module sinh nước đi vật lý (pseudo-legal moves) cho 4 loại quân cờ cơ bản trong Cờ Tướng:
1. **Tướng (King - `k`)**: Di chuyển 1 ô trực giao trong Cung tướng; hỗ trợ kiểm tra Lộ mặt tướng (Flying General - bay ăn Tướng đối phương khi không có vật cản).
2. **Sĩ (Advisor - `a`)**: Di chuyển 1 ô chéo giữa 5 vị trí cố định trong Cung tướng.
3. **Tượng (Elephant / Bishop - `b`)**: Di chuyển 2 ô chéo (hình chữ Điền), không được qua sông, kiểm tra cản mắt Tượng.
4. **Mã (Horse / Knight - `n`)**: Di chuyển hình chữ L (8 hướng), kiểm tra cản chân Mã.

---

## 2. Ràng buộc Kỹ thuật

- **Pure TypeScript & Zero Dependencies**: 100% không dùng thư viện ngoài.
- **Hệ toạ độ 1D (0..89)**: `col = sq % 9`, `row = Math.floor(sq / 9)`.
- **Hiệu năng $O(1)$**: Sử dụng logic kiểm tra biên trực tiếp hoặc mảng offset tĩnh.
- **Tương thích hoàn toàn với lớp `Position`**: Bổ sung method `generatePieceMoves(sq: Square): Move[]` và `hasFlyingGeneral(): boolean`.
- **TDD (Test-Driven Development)**: Mỗi module đều đi kèm Jest test suite tương ứng trong `packages/xiangqi-core/tests/`.

---

## 3. Chi tiết Giải thuật Từng Quân

### 3.1. Tướng (King - `k`)
- **Phạm vi Cung (Palace)**:
  - Cột: $3 \le c \le 5$ (`d`, `e`, `f`).
  - Đỏ: $7 \le r \le 9$; Đen: $0 \le r \le 2$.
- **Bước đi trực giao**:
  - Hướng: $(-1, 0), (1, 0), (0, -1), (0, 1)$.
  - Ô đích phải nằm trong Cung, không chứa quân cùng màu.
- **Lộ mặt tướng (Flying General)**:
  - Nếu Tướng phe mình và Tướng phe đối phương cùng cột, quét dọc giữa 2 Tướng: nếu không có bất kỳ quân nào chắn giữa $\rightarrow$ nước đi Tướng ăn trực tiếp Tướng đối phương là hợp lệ.

### 3.2. Sĩ (Advisor - `a`)
- **Vị trí hợp lệ trong Cung**:
  - Đỏ (5 ô): `d9(84)`, `f9(86)`, `e8(76)`, `d7(66)`, `f7(68)`.
  - Đen (5 ô): `d0(3)`, `f0(5)`, `e1(13)`, `d2(21)`, `f2(23)`.
- **Bước đi chéo 1 ô**:
  - Delta: $(\pm 1, \pm 1)$.
  - Ô đích phải là 1 trong 5 ô Cung của phe mình và không chứa quân cùng màu.

### 3.3. Tượng (Elephant - `b`)
- **Bước đi chéo 2 ô**:
  - Delta: $(\pm 2, \pm 2)$.
- **Giới hạn sông (River)**:
  - Đỏ: $r \ge 5$ (không được lên hàng $\le 4$).
  - Đen: $r \le 4$ (không được xuống hàng $\ge 5$).
- **Mắt Tượng (Elephant Eye)**:
  - Toạ độ mắt: `eyeCol = fc + dc / 2`, `eyeRow = fr + dr / 2`.
  - Nếu `board[coordToSquare(eyeCol, eyeRow)] !== null` $\rightarrow$ bị cản mắt, không đi được.
- **Ô đích**: Ô đích không được chứa quân cùng màu.

### 3.4. Mã (Horse - `n`)
- **Bước đi chữ L**:
  - Đi dọc 2, ngang 1: $dr = \pm 2, dc = \pm 1$. Chân Mã: $(fc, fr + dr / 2)$.
  - Đi ngang 2, dọc 1: $dr = \pm 1, dc = \pm 2$. Chân Mã: $(fc + dc / 2, fr)$.
- **Cản chân Mã**:
  - Nếu ô chân Mã khác `null` $\rightarrow$ bị cản chân, không đi được.
- **Ô đích**: Nằm trong bàn cờ ($0 \le c < 9, 0 \le r < 10$) và không chứa quân cùng màu.

---

## 4. Cấu trúc File triển khai

```text
packages/xiangqi-core/
├── src/
│   ├── movegen/
│   │   ├── king.ts          # King moves + Flying General check
│   │   ├── advisor.ts       # Advisor moves
│   │   ├── elephant.ts      # Elephant moves + Eye blocking
│   │   ├── horse.ts         # Horse moves + Leg blocking
│   │   └── index.ts         # Re-export & generatePieceMoves dispatcher
│   ├── position.ts          # Integrate generatePieceMoves & hasFlyingGeneral
│   └── index.ts             # Export public API
└── tests/
    ├── movegen-king.spec.ts
    ├── movegen-advisor.spec.ts
    ├── movegen-elephant.spec.ts
    ├── movegen-horse.spec.ts
    └── position-movegen.spec.ts
```
