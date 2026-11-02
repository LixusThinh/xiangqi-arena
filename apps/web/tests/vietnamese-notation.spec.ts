import { Position, algebraicToSquare } from '@xiangqi-arena/xiangqi-core';
import { formatVietnameseMove } from '@/lib/ai/vietnamese-notation';

describe('formatVietnameseMove', () => {
  it('tạo ký hiệu chính xác cho các nước khai cuộc của Đỏ', () => {
    const pos = Position.initial();

    // Pháo 2 bình 5: h7 -> e7 (col 7, row 7 -> col 4, row 7)
    const p2b5 = formatVietnameseMove(pos, {
      from: algebraicToSquare('h7'),
      to: algebraicToSquare('e7'),
    });
    expect(p2b5).toBe('Pháo 2 bình 5');

    // Mã 8 tấn 7: b9 -> c7 (col 1, row 9 -> col 2, row 7)
    const m8t7 = formatVietnameseMove(pos, {
      from: algebraicToSquare('b9'),
      to: algebraicToSquare('c7'),
    });
    expect(m8t7).toBe('Mã 8 tấn 7');

    // Xe 1 tấn 1: i9 -> i8 (col 8, row 9 -> col 8, row 8)
    const x1t1 = formatVietnameseMove(pos, {
      from: algebraicToSquare('i9'),
      to: algebraicToSquare('i8'),
    });
    expect(x1t1).toBe('Xe 1 tấn 1');

    // Tốt 5 tấn 1: e6 -> e5 (col 4, row 6 -> col 4, row 5)
    const b5t1 = formatVietnameseMove(pos, {
      from: algebraicToSquare('e6'),
      to: algebraicToSquare('e5'),
    });
    expect(b5t1).toBe('Tốt 5 tấn 1');

    // Tượng 3 tấn 5: g9 -> e7 (col 6, row 9 -> col 4, row 7)
    const b3t5 = formatVietnameseMove(pos, {
      from: algebraicToSquare('g9'),
      to: algebraicToSquare('e7'),
    });
    expect(b3t5).toBe('Tượng 3 tấn 5');

    // Sĩ 4 tấn 5: f9 -> e8 (col 5, row 9 -> col 4, row 8)
    const s4t5 = formatVietnameseMove(pos, {
      from: algebraicToSquare('f9'),
      to: algebraicToSquare('e8'),
    });
    expect(s4t5).toBe('Sĩ 4 tấn 5');
  });

  it('tạo ký hiệu chính xác cho nước đi của Đen', () => {
    // Đen đi từ thế xuất phát (giả lập lượt Đen)
    const pos = Position.initial();

    // Mã 2 tấn 3 của Đen: b0 -> c2 (col 1, row 0 -> col 2, row 2)
    // Đen: col 1 là cột 2 (1 + 1), col 2 là cột 3 (2 + 1)
    const m2t3 = formatVietnameseMove(pos, {
      from: algebraicToSquare('b0'),
      to: algebraicToSquare('c2'),
    });
    expect(m2t3).toBe('Mã 2 tấn 3');

    // Pháo 2 bình 5 của Đen: b2 -> e2 (col 1, row 2 -> col 4, row 2)
    const p2b5 = formatVietnameseMove(pos, {
      from: algebraicToSquare('b2'),
      to: algebraicToSquare('e2'),
    });
    expect(p2b5).toBe('Pháo 2 bình 5');
  });

  it('phân biệt hai quân cùng loại cùng cột bằng Trước / Sau', () => {
    // Thế cờ có 2 Pháo Đỏ trên cùng cột e (col 4): một ở e7, một ở e3
    const fen = '4k4/9/9/9/4C4/9/9/4C4/9/4K4 r - - 0 1';
    const pos = Position.fromFen(fen);

    // Pháo ở e4 (row 4, gần đối phương hơn) = Trước
    // Pháo ở e7 (row 7, xa đối phương hơn) = Sau
    const moveFront = formatVietnameseMove(pos, {
      from: algebraicToSquare('e4'),
      to: algebraicToSquare('d4'),
    });
    expect(moveFront).toBe('Pháo trước bình 6');

    const moveBack = formatVietnameseMove(pos, {
      from: algebraicToSquare('e7'),
      to: algebraicToSquare('e6'),
    });
    expect(moveBack).toBe('Pháo sau tấn 1');
  });
});
