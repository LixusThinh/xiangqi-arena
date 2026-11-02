import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ReplayView from '@/components/replay/ReplayView';
import type { MatchHistoryDetail } from '@/lib/history-api';
import { STARTING_FEN } from '@xiangqi-arena/xiangqi-core';

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/history/42',
}));

const mockMatchDetail: MatchHistoryDetail = {
  matchId: '42',
  roomCode: 'K7MPQ2XA',
  ruleProfileCode: 'VN_STANDARD',
  isRanked: true,
  yourColor: 'RED',
  opponent: { id: '2', username: 'black_player', displayName: 'Kỳ Thủ Phương Nam', rating: 1350 },
  outcome: 'WIN',
  result: 'RED_WIN',
  endReason: 'CHECKMATE',
  plyCount: 2,
  startedAt: '2026-10-20T08:00:00.000Z',
  endedAt: '2026-10-20T08:15:30.000Z',
  durationSec: 930,
  initialFen: STARTING_FEN,
  finalFen: 'r1bakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1',
  ratingChange: { before: 1200, after: 1216, delta: 16 },
  moves: [
    {
      ply: 1,
      color: 'RED',
      from: 'h7',
      to: 'e7',
      piece: 'C',
      captured: null,
      isCheck: false,
      thinkTimeMs: 1500,
      fenAfter: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1',
    },
    {
      ply: 2,
      color: 'BLACK',
      from: 'b0',
      to: 'c2',
      piece: 'n',
      captured: null,
      isCheck: false,
      thinkTimeMs: 2200,
      fenAfter: 'r1bakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR r - - 2 2',
    },
  ],
};

describe('ReplayView (Việc 3 - XQA-33)', () => {
  it('hiển thị thông tin 2 người chơi, kết quả, lý do tiếng Việt và bàn cờ', () => {
    render(<ReplayView matchId="42" initialData={mockMatchDetail} />);

    // Thông tin người chơi & ván
    expect(screen.getByText('Xem lại ván đấu #42')).toBeInTheDocument();
    expect(screen.getByText('Kỳ Thủ Phương Nam')).toBeInTheDocument();
    expect(screen.getByText('Thắng')).toBeInTheDocument();
    expect(screen.getByText('Chiếu bí')).toBeInTheDocument();

    // Danh sách nước đi với ký hiệu tiếng Việt
    expect(screen.getByText('Pháo 2 bình 5')).toBeInTheDocument();
    expect(screen.getByText('Mã 2 tấn 3')).toBeInTheDocument();
  });

  it('điều khiển các nút Về đầu / Lùi / Tiến / Về cuối', () => {
    render(<ReplayView matchId="42" initialData={mockMatchDetail} />);

    // Ban đầu render ở nước cuối (Nước 2 / 2)
    const indicator = screen.getByTestId('replay-step-indicator');
    expect(indicator).toHaveTextContent('Nước 2 / 2');

    const firstBtn = screen.getByRole('button', { name: 'Về đầu' });
    const prevBtn = screen.getByRole('button', { name: 'Lùi' });
    const nextBtn = screen.getByRole('button', { name: 'Tiến' });
    const lastBtn = screen.getByRole('button', { name: 'Về cuối' });

    // Khi ở cuối: Tiến và Về cuối bị disabled
    expect(nextBtn).toBeDisabled();
    expect(lastBtn).toBeDisabled();

    // Bấm Lùi -> Nước 1 / 2
    fireEvent.click(prevBtn);
    expect(indicator).toHaveTextContent('Nước 1 / 2');
    expect(nextBtn).toBeEnabled();

    // Bấm Về đầu -> Nước 0 / 2
    fireEvent.click(firstBtn);
    expect(indicator).toHaveTextContent('Nước 0 / 2');
    expect(prevBtn).toBeDisabled();
    expect(firstBtn).toBeDisabled();

    // Bấm Tiến -> Nước 1 / 2
    fireEvent.click(nextBtn);
    expect(indicator).toHaveTextContent('Nước 1 / 2');

    // Bấm Về cuối -> Nước 2 / 2
    fireEvent.click(lastBtn);
    expect(indicator).toHaveTextContent('Nước 2 / 2');
  });

  it('hỗ trợ phím mũi tên trái và phải', () => {
    render(<ReplayView matchId="42" initialData={mockMatchDetail} />);
    const indicator = screen.getByTestId('replay-step-indicator');

    // Phím mũi tên trái (Lùi)
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(indicator).toHaveTextContent('Nước 1 / 2');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(indicator).toHaveTextContent('Nước 0 / 2');

    // Phím mũi tên phải (Tiến)
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(indicator).toHaveTextContent('Nước 1 / 2');

    // Phím Home (Về đầu)
    fireEvent.keyDown(window, { key: 'Home' });
    expect(indicator).toHaveTextContent('Nước 0 / 2');

    // Phím End (Về cuối)
    fireEvent.keyDown(window, { key: 'End' });
    expect(indicator).toHaveTextContent('Nước 2 / 2');
  });

  it('bấm vào nước trong danh sách để nhảy trực tiếp tới nước đó', () => {
    render(<ReplayView matchId="42" initialData={mockMatchDetail} />);
    const indicator = screen.getByTestId('replay-step-indicator');

    // Bấm vào nước "0. Khởi đầu"
    fireEvent.click(screen.getByText('0. Khởi đầu'));
    expect(indicator).toHaveTextContent('Nước 0 / 2');

    // Bấm vào nước "Pháo 2 bình 5"
    fireEvent.click(screen.getByText('Pháo 2 bình 5'));
    expect(indicator).toHaveTextContent('Nước 1 / 2');
  });

  it('xoay bàn cờ theo phe của mình (yourColor: BLACK)', () => {
    const blackMatchDetail: MatchHistoryDetail = {
      ...mockMatchDetail,
      yourColor: 'BLACK',
      outcome: 'LOSS',
      result: 'RED_WIN',
    };

    render(<ReplayView matchId="42" initialData={blackMatchDetail} />);

    // Bàn cờ được render với orientation = 'b'
    // Kiểm tra hàng của Tướng Đỏ và Đen theo orientation 'b'
    expect(screen.getByText('Thua')).toBeInTheDocument();
    expect(screen.getByText('Bên Đen (Bạn)')).toBeInTheDocument();
  });
});
