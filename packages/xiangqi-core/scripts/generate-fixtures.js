const fs = require('fs');
const path = require('path');
const { Position, algebraicToSquare, squareToAlgebraic } = require('../dist/index.js');

function createMove(fromAlg, toAlg) {
  const from = algebraicToSquare(fromAlg);
  const to = algebraicToSquare(toAlg);
  return {
    from,
    to,
    fromAlgebraic: fromAlg,
    toAlgebraic: toAlg,
  };
}

const testCases = [
  // ==========================================
  // 1. FR-08: Basic Move Constraints & Boundaries
  // ==========================================
  {
    id: 'TC-FR08-01',
    requirementId: 'FR-08',
    piece: 'k',
    color: 'r',
    description: 'Nước đi có ô xuất phát và ô đích trùng nhau (from === to)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e9', 'e9'),
    expectedLegal: false,
    reason: 'Quân cờ không thể di chuyển đến chính ô nó đang đứng.'
  },
  {
    id: 'TC-FR08-02',
    requirementId: 'FR-08',
    piece: 'k',
    color: 'r',
    emptySource: true,
    description: 'Ô xuất phát là ô trống, không có quân cờ',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e4', 'e5'),
    expectedLegal: false,
    reason: 'Không thể thực hiện nước đi khi ô xuất phát không chứa quân cờ.'
  },
  {
    id: 'TC-FR08-03',
    requirementId: 'FR-08',
    piece: 'n',
    color: 'r',
    description: 'Ô xuất phát là quân của đối phương (quân Đen khi đến lượt Đỏ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b0', 'a2'),
    expectedLegal: false,
    reason: 'Người chơi chỉ được phép di chuyển quân cờ thuộc phe của mình trong lượt đi.'
  },
  {
    id: 'TC-FR08-04',
    requirementId: 'FR-08',
    piece: 'k',
    color: 'r',
    description: 'Đi vào ô đang có quân đồng minh (Friendly fire)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e9', 'd9'),
    expectedLegal: false,
    reason: 'Quân cờ không được phép đi vào ô đang có quân cờ cùng màu đứng.'
  },
  {
    id: 'TC-FR08-05',
    requirementId: 'FR-08',
    piece: 'r',
    color: 'r',
    description: 'Nước đi có ô đích nằm ngoài biên bàn cờ (tọa độ âm)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: { from: 81, to: -1, fromAlgebraic: 'a9', toAlgebraic: 'out_of_bounds' },
    expectedLegal: false,
    reason: 'Nước đi ra ngoài phạm vi bàn cờ (sq < 0) là bất hợp lệ.'
  },
  {
    id: 'TC-FR08-06',
    requirementId: 'FR-08',
    piece: 'r',
    color: 'r',
    description: 'Nước đi có ô đích vượt quá giới hạn bàn cờ (tọa độ >= 90)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: { from: 89, to: 95, fromAlgebraic: 'i9', toAlgebraic: 'out_of_bounds' },
    expectedLegal: false,
    reason: 'Nước đi vượt quá 90 ô của bàn cờ (sq >= 90) là bất hợp lệ.'
  },

  // ==========================================
  // 2. FR-11: Tướng (King - k)
  // ==========================================
  {
    id: 'TC-FR11-K01',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ tiến 1 ô dọc trong Cung vào ô trống',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4K4/RNBA1ABNR r - - 0 1',
    move: createMove('e8', 'e7'),
    expectedLegal: true,
    reason: 'Tướng đi thẳng 1 ô trong phạm vi Cung tướng là hợp lệ.'
  },
  {
    id: 'TC-FR11-K02',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ đi ngang 1 ô trong Cung vào ô trống',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4K4/RNBA1ABNR r - - 0 1',
    move: createMove('e8', 'd8'),
    expectedLegal: true,
    reason: 'Tướng đi ngang 1 ô trong phạm vi Cung tướng là hợp lệ.'
  },
  {
    id: 'TC-FR11-K03',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ đi chéo 1 ô trong Cung (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4K4/RNBA1ABNR r - - 0 1',
    move: createMove('e8', 'd7'),
    expectedLegal: false,
    reason: 'Tướng chỉ được đi ngang hoặc dọc 1 ô, không được đi chéo.'
  },
  {
    id: 'TC-FR11-K04',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ đi 2 ô dọc trong Cung (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e9', 'e7'),
    expectedLegal: false,
    reason: 'Tướng chỉ được di chuyển đúng 1 ô mỗi nước đi.'
  },
  {
    id: 'TC-FR11-K05',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ đi ngang ra ngoài Cung sang phía bên trái (d9 -> c9)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBK1ABNR r - - 0 1',
    move: createMove('d9', 'c9'),
    expectedLegal: false,
    reason: 'Tướng không được phép di chuyển ra ngoài Cung (cột d..f).'
  },
  {
    id: 'TC-FR11-K06',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ tiến về phía trước ra khỏi Cung (e7 -> e6)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2K1C2/9/RNBA1ABNR r - - 0 1',
    move: createMove('e7', 'e6'),
    expectedLegal: false,
    reason: 'Tướng Đỏ không được phép đi ra ngoài Cung (hàng 7..9).'
  },
  {
    id: 'TC-FR11-K07',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ ăn quân địch trong phạm vi Cung',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/3pK4/RNBA1ABNR r - - 0 1',
    move: createMove('e8', 'd8'),
    expectedLegal: true,
    reason: 'Tướng được phép đi ngang 1 ô để ăn quân đối phương trong Cung.'
  },
  {
    id: 'TC-FR11-K08',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'b',
    description: 'Tướng đen tiến 1 ô dọc trong Cung (e0 -> e1)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e0', 'e1'),
    expectedLegal: true,
    reason: 'Tướng Đen đi thẳng 1 ô trong Cung (hàng 0..2) là hợp lệ.'
  },
  {
    id: 'TC-FR11-K09',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'b',
    description: 'Tướng đen đi tiến ra ngoài Cung phía dưới (d2 -> d3)',
    fen: 'rnb2abnr/9/1c1k1c3/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('d2', 'd3'),
    expectedLegal: false,
    reason: 'Tướng Đen không được phép đi ra ngoài Cung Đen (hàng 0..2).'
  },

  // ==========================================
  // 3. FR-11: Sĩ (Advisor - a)
  // ==========================================
  {
    id: 'TC-FR11-A01',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'r',
    description: 'Sĩ đỏ từ góc Cung đi chéo 1 ô vào tâm Cung (d9 -> e8)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('d9', 'e8'),
    expectedLegal: true,
    reason: 'Sĩ đi chéo 1 ô vào vị trí tâm Cung là hợp lệ.'
  },
  {
    id: 'TC-FR11-A02',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'r',
    description: 'Sĩ đỏ từ tâm Cung đi chéo 1 ô ra góc trên Cung (e8 -> d7)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4A4/RNB1KABNR r - - 0 1',
    move: createMove('e8', 'd7'),
    expectedLegal: true,
    reason: 'Sĩ đi chéo 1 ô từ tâm Cung ra góc Cung là hợp lệ.'
  },
  {
    id: 'TC-FR11-A03',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'r',
    description: 'Sĩ đỏ đi thẳng 1 ô dọc trong Cung (e8 -> e7) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4A4/RNB1KABNR r - - 0 1',
    move: createMove('e8', 'e7'),
    expectedLegal: false,
    reason: 'Sĩ chỉ được phép đi đường chéo, không được đi thẳng dọc.'
  },
  {
    id: 'TC-FR11-A04',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'r',
    description: 'Sĩ đỏ đi ngang 1 ô trong Cung (e8 -> d8) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4A4/RNB1KABNR r - - 0 1',
    move: createMove('e8', 'd8'),
    expectedLegal: false,
    reason: 'Sĩ chỉ được phép đi đường chéo, không được đi ngang.'
  },
  {
    id: 'TC-FR11-A05',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'r',
    description: 'Sĩ đỏ từ góc Cung đi chéo ra ngoài Cung (d7 -> c6)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C1A1C3/9/RNB1KABNR r - - 0 1',
    move: createMove('d7', 'c6'),
    expectedLegal: false,
    reason: 'Sĩ chỉ được hoạt động trong 5 vị trí cố định của Cung tướng.'
  },
  {
    id: 'TC-FR11-A06',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'r',
    description: 'Sĩ đỏ ăn quân địch tại tâm Cung (d9 -> e8)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4n4/RNBAKABNR r - - 0 1',
    move: createMove('d9', 'e8'),
    expectedLegal: true,
    reason: 'Sĩ được phép đi chéo 1 ô để ăn quân đối phương trong Cung.'
  },
  {
    id: 'TC-FR11-A07',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'b',
    description: 'Sĩ đen từ tâm Cung e1 đi chéo ra góc f0 (e1 -> f0)',
    fen: 'rnb1k1bnr/4a4/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e1', 'f0'),
    expectedLegal: true,
    reason: 'Sĩ Đen đi chéo 1 ô từ tâm Cung ra góc Cung là hợp lệ.'
  },
  {
    id: 'TC-FR11-A08',
    requirementId: 'FR-11',
    piece: 'a',
    color: 'b',
    description: 'Sĩ đen đi chéo 2 ô (e1 -> g3) (không hợp lệ)',
    fen: 'rnb1kabnr/4a4/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e1', 'g3'),
    expectedLegal: false,
    reason: 'Sĩ chỉ được đi chéo đúng 1 ô.'
  },

  // ==========================================
  // 4. FR-11: Tượng (Elephant - b)
  // ==========================================
  {
    id: 'TC-FR11-B01',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ đi chéo 2 ô chữ Điền không bị cản (c9 -> a7)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('c9', 'a7'),
    expectedLegal: true,
    reason: 'Tượng đi chéo 2 ô chữ Điền với mắt tượng thông suốt là hợp lệ.'
  },
  {
    id: 'TC-FR11-B02',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ đi chéo 2 ô chữ Điền ăn quân địch (c9 -> e7)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2n1C2/9/RNBAKABNR r - - 0 1',
    move: createMove('c9', 'e7'),
    expectedLegal: true,
    reason: 'Tượng được phép đi chéo 2 ô chữ Điền để ăn quân địch tại ô đích.'
  },
  {
    id: 'TC-FR11-B03',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ bị cản mắt tượng hướng Tây Bắc (ô b8 có quân)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/1P7/RNBAKABNR r - - 0 1',
    move: createMove('c9', 'a7'),
    expectedLegal: false,
    reason: 'Mắt tượng tại b8 bị cản bởi quân cờ, Tượng không thể di chuyển theo hướng này.'
  },
  {
    id: 'TC-FR11-B04',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ bị cản mắt tượng hướng Đông Bắc (ô d8 có quân)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/3p5/RNBAKABNR r - - 0 1',
    move: createMove('c9', 'e7'),
    expectedLegal: false,
    reason: 'Mắt tượng tại d8 bị cản bởi quân địch, Tượng không thể đi qua.'
  },
  {
    id: 'TC-FR11-B05',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ qua sông sang phần sân Đen (c5 -> e3) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/2B6/P1P1P1P1P/1C5C1/9/RN1AKABNR r - - 0 1',
    move: createMove('c5', 'e3'),
    expectedLegal: false,
    reason: 'Tượng không được phép vượt qua sông sang phần sân của đối phương.'
  },
  {
    id: 'TC-FR11-B06',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ đi chéo 1 ô (c9 -> b8) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('c9', 'b8'),
    expectedLegal: false,
    reason: 'Tượng chỉ được đi chéo đúng 2 ô (hình chữ Điền), không được đi 1 ô.'
  },
  {
    id: 'TC-FR11-B07',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'r',
    description: 'Tượng đỏ đi thẳng 2 ô dọc (c9 -> c7) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('c9', 'c7'),
    expectedLegal: false,
    reason: 'Tượng chỉ được đi chéo chữ Điền, không được đi thẳng.'
  },
  {
    id: 'TC-FR11-B08',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'b',
    description: 'Tượng đen bị cản mắt tượng hướng Đông Nam (ô d1 có quân)',
    fen: 'rnbakabnr/3p5/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('c0', 'e2'),
    expectedLegal: false,
    reason: 'Mắt tượng Đen tại d1 có quân cản, không thể di chuyển tới e2.'
  },
  {
    id: 'TC-FR11-B09',
    requirementId: 'FR-11',
    piece: 'b',
    color: 'b',
    description: 'Tượng đen đi chéo 2 ô trong phần sân Đen hợp lệ (c0 -> a2)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('c0', 'a2'),
    expectedLegal: true,
    reason: 'Tượng Đen đi chéo 2 ô chữ Điền trong phần sân Đen không bị cản là hợp lệ.'
  },

  // ==========================================
  // 5. FR-11: Lộ mặt Tướng (Flying General)
  // ==========================================
  {
    id: 'TC-FR11-FG01',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ bay ăn trực tiếp Tướng đen đối mặt trên cùng cột e khi thông suốt',
    fen: '4k4/9/9/9/9/9/9/9/9/4K4 r - - 0 1',
    move: createMove('e9', 'e0'),
    expectedLegal: true,
    reason: 'Hai Tướng đối mặt trực tiếp trên cùng cột e không có quân cản, Tướng được bay ăn Tướng đối phương.'
  },
  {
    id: 'TC-FR11-FG02',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ không thể bay ăn Tướng đen khi có quân cản ở giữa cột e',
    fen: '4k4/9/9/9/4P4/9/9/9/9/4K4 r - - 0 1',
    move: createMove('e9', 'e0'),
    expectedLegal: false,
    reason: 'Có quân tốt tại e4 chắn giữa cột e, Tướng không được phép bay ăn Tướng đối phương.'
  },
  {
    id: 'TC-FR11-FG03',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'b',
    description: 'Tướng đen bay ăn trực tiếp Tướng đỏ đối mặt trên cùng cột d khi thông suốt',
    fen: '3k5/9/9/9/9/9/9/9/9/3K5 b - - 0 1',
    move: createMove('d0', 'd9'),
    expectedLegal: true,
    reason: 'Hai Tướng đối mặt trực tiếp trên cột d không có quân cản, Tướng Đen bay ăn Tướng Đỏ hợp lệ.'
  },
  {
    id: 'TC-FR11-FG04',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ không thể bay ăn Tướng đen khi hai tướng ở khác cột (cột d và e)',
    fen: '4k4/9/9/9/9/9/9/9/9/3K5 r - - 0 1',
    move: createMove('d9', 'e0'),
    expectedLegal: false,
    reason: 'Hai Tướng không nằm trên cùng một cột, luật Lộ mặt tướng không áp dụng.'
  },
  {
    id: 'TC-FR11-FG05',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ bước ngang vào cột đối mặt trực diện không quân cản với Tướng đen (vi phạm luật Lộ mặt tướng - Chờ XQA-49)',
    fen: '3k5/9/9/9/9/9/9/9/9/4K4 r - - 0 1',
    move: createMove('e9', 'd9'),
    expectedLegal: false,
    reason: 'Nước đi khiến hai Tướng đối mặt trực tiếp mà không có quân cản ở giữa là phạm luật lộ mặt tướng (chờ xử lý trong XQA-49).'
  },
  {
    id: 'TC-FR11-FG06',
    requirementId: 'FR-11',
    piece: 'p',
    color: 'r',
    description: 'Quân cản duy nhất giữa 2 Tướng rời cột làm lộ mặt hai Tướng (vi phạm luật Lộ mặt tướng)',
    fen: '4k4/9/9/9/4P4/9/9/9/9/4K4 r - - 0 1',
    move: createMove('e4', 'd4'),
    expectedLegal: false,
    reason: 'Nước đi của quân cản làm lộ mặt trực diện hai Tướng là nước đi bất hợp lệ (cần XQA-45 cho nước đi của Tốt và XQA-49 cho kiểm tra chống lộ mặt Tướng).'
  },
  {
    id: 'TC-FR11-K10',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'r',
    description: 'Tướng đỏ không được đi chéo trong Cung (d9 -> c8)',
    fen: '4k4/9/9/9/9/9/9/9/4A4/3K5 r - - 0 1',
    move: createMove('d9', 'c8'),
    expectedLegal: false,
    reason: 'Tướng chỉ được di chuyển theo đường thẳng (ngang hoặc dọc), không được đi chéo theo FR-11.'
  },
  {
    id: 'TC-FR11-K11',
    requirementId: 'FR-11',
    piece: 'k',
    color: 'b',
    description: 'Tướng đen không được di chuyển rời khỏi phạm vi Cung tướng (d0 -> c0)',
    fen: '3k5/9/9/9/9/9/9/9/9/4K4 b - - 0 1',
    move: createMove('d0', 'c0'),
    expectedLegal: false,
    reason: 'Tướng bị giới hạn di chuyển trong phạm vi Cung (cột d-f, hàng 0-2), không được ra ngoài theo FR-11.'
  },

  // ==========================================
  // 5b. Điều 7.1b: Hết nước đi bị xử thua (Bí nước / Stalemate)
  // ==========================================
  {
    id: 'TC-7.1B-STALEMATE-01',
    kind: 'noLegalMoves',
    requirementId: 'Điều 7.1b',
    piece: 'k',
    color: 'b',
    description: 'Thế bí hợp lệ bên Đen (Stalemate) - Đen đến lượt đi không bị chiếu nhưng hết nước đi hợp lệ (xử thua theo Điều 7.1b)',
    fen: '3k5/9/9/2N6/9/9/9/9/9/4K4 b - - 0 1',
    expected: true,
    reason: 'Chứng minh: Đen chỉ có Tướng d0 không bị chiếu. Tướng d0 chỉ có 2 nước trong cung: (1) d0->e0 bị cấm do lộ mặt trực diện Tướng đỏ e9; (2) d0->d1 bị cấm do Mã đỏ c3 kiểm soát d1 (bước vào bị chiếu). Các hướng khác ra ngoài cung. Đen hết nước đi hợp lệ -> Bí nước bị xử thua theo Điều 7.1b (chờ XQA-49).'
  },
  {
    id: 'TC-7.1B-STALEMATE-02',
    kind: 'noLegalMoves',
    requirementId: 'Điều 7.1b',
    piece: 'k',
    color: 'r',
    description: 'Thế bí hợp lệ bên Đỏ (Stalemate) - Đỏ đến lượt đi không bị chiếu nhưng hết nước đi hợp lệ (xử thua theo Điều 7.1b)',
    fen: '4k4/9/9/9/9/9/2n6/9/9/3K5 r - - 0 1',
    expected: true,
    reason: 'Chứng minh: Đỏ chỉ có Tướng d9 không bị chiếu. Tướng d9 chỉ có 2 nước trong cung: (1) d9->e9 bị cấm do lộ mặt trực diện Tướng đen e0; (2) d9->d8 bị cấm do Mã đen c6 kiểm soát d8 (bước vào bị chiếu). Các hướng khác ra ngoài cung. Đỏ hết nước đi hợp lệ -> Bí nước bị xử thua theo Điều 7.1b (chờ XQA-49).'
  },

  // ==========================================
  // 6. FR-12: Mã (Horse - n)
  // ==========================================
  {
    id: 'TC-FR12-N01',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ nhảy chữ L hướng Bắc-Tây (b9 -> a7) không bị cản chân',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b9', 'a7'),
    expectedLegal: true,
    reason: 'Mã đi chữ L với ô chân mã b8 hoàn toàn trống là hợp lệ.'
  },
  {
    id: 'TC-FR12-N02',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ nhảy chữ L hướng Bắc-Đông (b9 -> c7) không bị cản chân',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b9', 'c7'),
    expectedLegal: true,
    reason: 'Mã đi chữ L với ô chân mã b8 hoàn toàn trống là hợp lệ.'
  },
  {
    id: 'TC-FR12-N03',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ bị cản chân phía Bắc (ô b8 có quân chắn)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/1P7/RNBAKABNR r - - 0 1',
    move: createMove('b9', 'a7'),
    expectedLegal: false,
    reason: 'Ô chân mã b8 có tốt đứng cản, Mã không thể nhảy hướng Bắc.'
  },
  {
    id: 'TC-FR12-N04',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ bị cản chân phía Nam (Mã tại e5, ô e6 có quân chắn)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/4N4/4P4/1C5C1/9/R1BAKABNR r - - 0 1',
    move: createMove('e5', 'd7'),
    expectedLegal: false,
    reason: 'Ô chân mã phía Nam e6 có quân cản, Mã không thể nhảy xuống d7.'
  },
  {
    id: 'TC-FR12-N05',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ bị cản chân phía Tây (Mã tại e5, ô d5 có quân chắn)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/3PN4/9/1C5C1/9/R1BAKABNR r - - 0 1',
    move: createMove('e5', 'c4'),
    expectedLegal: false,
    reason: 'Ô chân mã phía Tây d5 có quân cản, Mã không thể nhảy sang c4.'
  },
  {
    id: 'TC-FR12-N06',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ bị cản chân phía Đông (Mã tại e5, ô f5 có quân chắn)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/4NP3/9/1C5C1/9/R1BAKABNR r - - 0 1',
    move: createMove('e5', 'g6'),
    expectedLegal: false,
    reason: 'Ô chân mã phía Đông f5 có quân cản, Mã không thể nhảy sang g6.'
  },
  {
    id: 'TC-FR12-N07',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ nhảy chữ L ăn quân địch tại ô đích (b9 -> c7)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1Cn4C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b9', 'c7'),
    expectedLegal: true,
    reason: 'Mã nhảy hợp lệ ăn mã đen tại ô đích c7.'
  },
  {
    id: 'TC-FR12-N08',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ đi thẳng 1 ô (b9 -> b8) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b9', 'b8'),
    expectedLegal: false,
    reason: 'Mã không được phép đi thẳng 1 ô.'
  },
  {
    id: 'TC-FR12-N09',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'r',
    description: 'Mã đỏ đi thẳng 2 ô (b9 -> b7) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b9', 'b7'),
    expectedLegal: false,
    reason: 'Mã không được phép đi thẳng 2 ô.'
  },
  {
    id: 'TC-FR12-N10',
    requirementId: 'FR-12',
    piece: 'n',
    color: 'b',
    description: 'Mã đen nhảy qua sông sang sân Đỏ hợp lệ (c4 -> b6)',
    fen: 'r1bakabnr/9/1c5c1/p1p1p1p1p/2n6/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('c4', 'b6'),
    expectedLegal: true,
    reason: 'Mã Đen được phép vượt sông sang phần sân Đỏ theo hình chữ L không bị cản chân.'
  },

  // ==========================================
  // 7. FR-13: Xe (Chariot - r)
  // ==========================================
  {
    id: 'TC-FR13-R01',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ đi thẳng dọc thông suốt trên cột a (a9 -> a5)',
    fen: 'rnbakabnr/9/1c5c1/1p1p1p1p1/9/9/1P1P1P1P1/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('a9', 'a5'),
    expectedLegal: true,
    reason: 'Xe đi thẳng dọc không giới hạn ô khi đường đi hoàn toàn thông suốt.'
  },
  {
    id: 'TC-FR13-R02',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ đi ngang thông suốt trên hàng 9 (a9 -> d9)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/R3KABNR r - - 0 1',
    move: createMove('a9', 'd9'),
    expectedLegal: true,
    reason: 'Xe đi ngang không giới hạn ô khi các ô trên hàng thông suốt.'
  },
  {
    id: 'TC-FR13-R03',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ ăn quân địch ở cuối đường đi dọc thông suốt (a9 -> a0)',
    fen: 'r1bakabnr/9/1c5c1/1p1p1p1p1/9/9/1P1P1P1P1/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('a9', 'a0'),
    expectedLegal: true,
    reason: 'Xe được phép đi thẳng ăn quân đối phương ở cuối đường đi thông suốt.'
  },
  {
    id: 'TC-FR13-R04',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ bị cản bởi quân cờ đứng giữa đường dọc (a9 không thể tới a5 khi a6 có tốt)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('a9', 'a5'),
    expectedLegal: false,
    reason: 'Đường đi của Xe bị chặn bởi tốt đỏ tại a6, không thể đi xuyên qua.'
  },
  {
    id: 'TC-FR13-R05',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ bị cản bởi quân cờ đứng giữa đường ngang (a9 không thể tới d9 khi b9 có mã)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('a9', 'd9'),
    expectedLegal: false,
    reason: 'Đường ngang của Xe bị chặn bởi mã đỏ tại b9, không thể đi xuyên qua.'
  },
  {
    id: 'TC-FR13-R06',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ đi chéo 1 ô (a9 -> b8) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('a9', 'b8'),
    expectedLegal: false,
    reason: 'Xe chỉ được đi ngang hoặc dọc, tuyệt đối không được đi chéo.'
  },
  {
    id: 'TC-FR13-R07',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'b',
    description: 'Xe đen đi dọc thông suốt qua sông sang phần sân Đỏ (a0 -> a6)',
    fen: 'r1bakabnr/9/1c5c1/1p1p1p1p1/9/9/1P1P1P1P1/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('a0', 'a6'),
    expectedLegal: true,
    reason: 'Xe Đen được phép vượt sông sang phần sân Đỏ trên đường thẳng thông suốt.'
  },
  {
    id: 'TC-FR13-R08',
    requirementId: 'FR-13',
    piece: 'r',
    color: 'r',
    description: 'Xe đỏ nhảy qua 1 quân cản để tới ô trống (như Pháo) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('a9', 'a4'),
    expectedLegal: false,
    reason: 'Xe không được phép nhảy qua bất kỳ quân cờ nào.'
  },

  // ==========================================
  // 8. FR-13: Pháo (Cannon - c)
  // ==========================================
  {
    id: 'TC-FR13-C01',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ đi dọc không ăn quân khi đường đi thông suốt (b7 -> b4)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'b4'),
    expectedLegal: true,
    reason: 'Khi không ăn quân, Pháo di chuyển như Xe trên đường thẳng hoàn toàn thông suốt.'
  },
  {
    id: 'TC-FR13-C02',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ đi ngang không ăn quân khi đường đi thông suốt (b7 -> e7)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'e7'),
    expectedLegal: true,
    reason: 'Pháo đi ngang vào ô trống khi không có bất kỳ quân cản nào giữa đường.'
  },
  {
    id: 'TC-FR13-C03',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ ăn quân địch qua đúng 1 ngòi cản (b7 ăn mã đen b0 qua ngòi tốt đen b3)',
    fen: 'rnbakabnr/9/7c1/1p7/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'b0'),
    expectedLegal: true,
    reason: 'Pháo ăn quân đối phương khi có đúng 1 quân cản (ngòi) ở giữa.'
  },
  {
    id: 'TC-FR13-C04',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ ăn quân địch qua đúng 1 ngòi cản là quân đồng minh (ngòi tốt đỏ b6)',
    fen: 'rnbakabnr/9/7c1/9/9/1P7/P3P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'b0'),
    expectedLegal: true,
    reason: 'Ngòi pháo có thể là quân của bất kỳ bên nào (kể cả quân cùng màu).'
  },
  {
    id: 'TC-FR13-C05',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ ăn quân đối phương khi KHÔNG có ngòi cản (0 ngòi cản) (không hợp lệ)',
    fen: 'rnbakabnr/9/7c1/9/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'b0'),
    expectedLegal: false,
    reason: 'Pháo không thể ăn quân nếu không có đúng 1 ngòi cản ở giữa.'
  },
  {
    id: 'TC-FR13-C06',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ ăn quân đối phương khi có 2 ngòi cản ở giữa (không hợp lệ)',
    fen: 'rnbakabnr/9/7c1/1p7/9/1P7/P3P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'b0'),
    expectedLegal: false,
    reason: 'Pháo có 2 quân cản ở giữa (tốt đỏ b6 và tốt đen b3) nên không thể ăn quân.'
  },
  {
    id: 'TC-FR13-C07',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ nhảy qua 1 ngòi cản tới ô TRỐNG (không có quân để ăn) (không hợp lệ)',
    fen: 'rnbakabnr/9/7c1/1p7/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'b1'),
    expectedLegal: false,
    reason: 'Pháo chỉ được nhảy qua ngòi khi ô đích là quân đối phương (nước ăn quân).'
  },
  {
    id: 'TC-FR13-C08',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'r',
    description: 'Pháo đỏ đi chéo 1 ô (b7 -> c6) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('b7', 'c6'),
    expectedLegal: false,
    reason: 'Pháo chỉ được di chuyển ngang hoặc dọc, không được đi chéo.'
  },
  {
    id: 'TC-FR13-C09',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'b',
    description: 'Pháo đen ăn pháo đỏ qua đúng 1 ngòi cản tốt đen (b2 ăn b7 qua b3)',
    fen: 'rnbakabnr/9/1c5c1/1p7/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('b2', 'b7'),
    expectedLegal: true,
    reason: 'Pháo Đen ăn quân đỏ qua đúng 1 ngòi cản tại b3 là hợp lệ.'
  },
  {
    id: 'TC-FR13-C10',
    requirementId: 'FR-13',
    piece: 'c',
    color: 'b',
    description: 'Pháo đen bị cản đường khi đi thường không ăn quân (b2 không thể đi tới b4 khi b3 có quân)',
    fen: 'rnbakabnr/9/1c5c1/1p7/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('b2', 'b4'),
    expectedLegal: false,
    reason: 'Pháo đi không ăn quân gặp vật cản tại b3 nên không thể đi tiếp.'
  },

  // ==========================================
  // 9. FR-13: Tốt (Pawn / Soldier - p)
  // ==========================================
  {
    id: 'TC-FR13-P01',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ chưa qua sông tiến thẳng 1 ô (e6 -> e5)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e6', 'e5'),
    expectedLegal: true,
    reason: 'Tốt chưa qua sông được phép tiến thẳng 1 ô về phía trước.'
  },
  {
    id: 'TC-FR13-P02',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ chưa qua sông đi ngang 1 ô (e6 -> d6) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e6', 'd6'),
    expectedLegal: false,
    reason: 'Tốt chưa qua sông chỉ được tiến thẳng, tuyệt đối không được đi ngang.'
  },
  {
    id: 'TC-FR13-P03',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ chưa qua sông đi lùi 1 ô (e6 -> e7) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e6', 'e7'),
    expectedLegal: false,
    reason: 'Tốt không bao giờ được phép đi lùi trong bất kỳ trường hợp nào.'
  },
  {
    id: 'TC-FR13-P04',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ đã qua sông tiến thẳng 1 ô (e4 -> e3)',
    fen: 'rnbakabnr/9/1c5c1/p1p3p1p/4P4/9/P1P3P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e4', 'e3'),
    expectedLegal: true,
    reason: 'Tốt đã qua sông được phép tiến thẳng 1 ô.'
  },
  {
    id: 'TC-FR13-P05',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ đã qua sông đi ngang sang trái 1 ô (e4 -> d4)',
    fen: 'rnbakabnr/9/1c5c1/p1p3p1p/4P4/9/P1P3P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e4', 'd4'),
    expectedLegal: true,
    reason: 'Tốt đã qua sông được phép đi ngang 1 ô sang trái.'
  },
  {
    id: 'TC-FR13-P06',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ đã qua sông đi ngang sang phải 1 ô (e4 -> f4)',
    fen: 'rnbakabnr/9/1c5c1/p1p3p1p/4P4/9/P1P3P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e4', 'f4'),
    expectedLegal: true,
    reason: 'Tốt đã qua sông được phép đi ngang 1 ô sang phải.'
  },
  {
    id: 'TC-FR13-P07',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ đã qua sông đi lùi 1 ô (e4 -> e5) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p3p1p/4P4/9/P1P3P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e4', 'e5'),
    expectedLegal: false,
    reason: 'Tốt đã qua sông vẫn không bao giờ được phép đi lùi.'
  },
  {
    id: 'TC-FR13-P08',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ tại hàng đáy đối phương đi ngang 1 ô (e0 -> d0)',
    fen: 'rnb1Pabnr/9/1c5c1/p1p1p1p1p/9/9/P1P3P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: createMove('e0', 'd0'),
    expectedLegal: true,
    reason: 'Tốt ở hàng đáy vẫn được phép di chuyển ngang 1 ô.'
  },
  {
    id: 'TC-FR13-P09',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'r',
    description: 'Tốt đỏ tại hàng đáy đối phương cố tiến thẳng ra ngoài biên (không hợp lệ)',
    fen: 'rnb1Pabnr/9/1c5c1/p1p1p1p1p/9/9/P1P3P1P/1C5C1/9/RNBAKABNR r - - 0 1',
    move: { from: 4, to: -5, fromAlgebraic: 'e0', toAlgebraic: 'out_of_bounds' },
    expectedLegal: false,
    reason: 'Tốt ở hàng đáy không thể tiến tiếp ra ngoài bàn cờ.'
  },
  {
    id: 'TC-FR13-P10',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'b',
    description: 'Tốt đen chưa qua sông tiến thẳng 1 ô xuống dưới (e3 -> e4)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e3', 'e4'),
    expectedLegal: true,
    reason: 'Tốt Đen chưa qua sông tiến thẳng 1 ô xuống phía dưới là hợp lệ.'
  },
  {
    id: 'TC-FR13-P11',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'b',
    description: 'Tốt đen chưa qua sông đi ngang 1 ô (e3 -> d3) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e3', 'd3'),
    expectedLegal: false,
    reason: 'Tốt Đen chưa qua sông tuyệt đối không được đi ngang.'
  },
  {
    id: 'TC-FR13-P12',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'b',
    description: 'Tốt đen đã qua sông đi ngang sang phải 1 ô (e5 -> f5)',
    fen: 'rnbakabnr/9/1c5c1/p1p3p1p/9/4p4/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e5', 'f5'),
    expectedLegal: true,
    reason: 'Tốt Đen sau khi qua sông được phép đi ngang 1 ô.'
  },
  {
    id: 'TC-FR13-P13',
    requirementId: 'FR-13',
    piece: 'p',
    color: 'b',
    description: 'Tốt đen đã qua sông đi lùi lên trên (e5 -> e4) (không hợp lệ)',
    fen: 'rnbakabnr/9/1c5c1/p1p3p1p/9/4p4/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1',
    move: createMove('e5', 'e4'),
    expectedLegal: false,
    reason: 'Tốt Đen không bao giờ được phép đi lùi.'
  }
];

// Gán status và blockedBy cho từng testcase theo đặc tả
for (const tc of testCases) {
  if (tc.kind === 'noLegalMoves') {
    tc.status = 'pending';
    tc.blockedBy = 'XQA-49';
  } else if (tc.id === 'TC-FR11-FG05') {
    tc.status = 'pending';
    tc.blockedBy = 'XQA-49';
  } else if (tc.id === 'TC-FR11-FG06') {
    tc.status = 'pending';
    tc.blockedBy = 'XQA-45';
  } else if (['r', 'c', 'p'].includes(tc.piece)) {
    tc.status = 'pending';
    tc.blockedBy = 'XQA-45';
  } else {
    tc.status = 'active';
    tc.blockedBy = null;
  }
}

// Validate all test cases against engine parser
console.log(`Checking ${testCases.length} test cases...`);
let validCount = 0;
let invalidCount = 0;
let activeCount = 0;
let pendingCount = 0;
const piecesSet = new Set();
const reqSet = new Set();

for (const tc of testCases) {
  if (tc.piece) piecesSet.add(tc.piece);
  reqSet.add(tc.requirementId);
  if (tc.status === 'active') activeCount++; else pendingCount++;
  if (tc.expectedLegal !== undefined) {
    if (tc.expectedLegal) validCount++; else invalidCount++;
  } else if (tc.expected !== undefined) {
    validCount++;
  }

  try {
    const pos = Position.fromFen(tc.fen);
    if (tc.move && tc.move.from >= 0 && tc.move.from < 90) {
      const piece = pos.board[tc.move.from];
      if (!tc.emptySource) {
        if (!piece) {
          throw new Error(`Piece missing at 'from' square ${tc.move.from} (${tc.move.fromAlgebraic}) in ${tc.id}`);
        }
        if (piece.type !== tc.piece) {
          throw new Error(`Expected piece ${tc.piece} but found ${piece.type} in ${tc.id}`);
        }
      }
    }
  } catch (err) {
    console.error(`Validation failed for ${tc.id}:`, err.message);
    process.exit(1);
  }
}

console.log('All test cases validated successfully!');
console.log(`Total: ${testCases.length} (Active: ${activeCount}, Pending: ${pendingCount})`);
console.log(`Pieces covered: ${Array.from(piecesSet).join(', ')} (count: ${piecesSet.size})`);
console.log(`Requirements covered: ${Array.from(reqSet).join(', ')}`);

const fixtureOutput = {
  name: 'Xiangqi Rules & Move Generation Test Fixtures',
  version: '1.0.0',
  description: 'Bộ fixture JSON chuẩn kiểm tra luật đi quân Cờ Tướng (FR-08, FR-11, FR-12, FR-13, Điều 7.1b) cho test harness CI',
  metadata: {
    totalTestCases: testCases.length,
    activeCount,
    pendingCount,
    validCasesCount: validCount,
    invalidCasesCount: invalidCount,
    requirementsCovered: Array.from(reqSet),
    piecesCovered: Array.from(piecesSet),
  },
  testCases
};

const paths = [
  path.join(__dirname, '..', 'tests', 'fixtures', 'rules-movegen.fixture.json'),
];

for (const p of paths) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(fixtureOutput, null, 2), 'utf-8');
  console.log(`Saved fixture JSON to: ${p}`);
}

