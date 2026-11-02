export interface FenPreset {
  id: string;
  name: string;
  description: string;
  fen: string;
}

export const FEN_PRESETS: FenPreset[] = [
  {
    id: 'initial',
    name: 'Khởi đầu (Standard Initial)',
    description: 'Thế cờ 32 quân khởi đầu tiêu chuẩn WXF',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
  },
  {
    id: 'midgame-1',
    name: 'Trung cuộc 1: Pháo đầu đối Bình Phong Mã',
    description: 'Khai cuộc chuyển trung cuộc, Mã đen c7, Mã đỏ g2, Pháo đỏ e2',
    fen: 'r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b - - 0 4',
  },
  {
    id: 'midgame-2',
    name: 'Trung cuộc 2: Giao tranh qua sông',
    description: 'Thế trận đối công quyết liệt, Chốt qua sông, Xe Pháo dâng cao',
    fen: '2bakab2/9/1cn2n2c/p1p1C1p1p/4p4/2P6/P3P1P1P/1C1K2N2/9/RNBA1AB1R r - - 0 12',
  },
  {
    id: 'endgame-1',
    name: 'Tàn cuộc: Đơn Xa Mã chốt đối Sĩ Tượng bền',
    description: 'Tàn cuộc kinh điển với số lượng quân thưa thớt kiểm tra ô trống',
    fen: '3k1ab2/4a4/4b4/9/9/9/4R4/4K4/4A4/2B1AB3 r - - 0 35',
  },
];
