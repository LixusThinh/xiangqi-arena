import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import PlayAiView from '@/components/ai/PlayAiView';
import type { AiClient } from '@/lib/ai/ai-client';
import { algebraicToSquare, type Move } from '@xiangqi-arena/xiangqi-core';

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/play-ai',
}));

describe('Chơi với máy (/play-ai)', () => {
  it('hiển thị màn hình chọn mức độ khó và màu quân với đầy đủ mô tả', () => {
    render(<PlayAiView />);

    expect(screen.getByRole('heading', { name: /Chơi cờ tướng với máy/i })).toBeInTheDocument();
    expect(screen.getByText('Dễ')).toBeInTheDocument();
    expect(screen.getByText('Trung bình')).toBeInTheDocument();
    expect(screen.getByText('Khó')).toBeInTheDocument();

    expect(screen.getByText(/Tính toán 1 nước/i)).toBeInTheDocument();
    expect(screen.getByText(/Tính toán 2 nước/i)).toBeInTheDocument();
    expect(screen.getByText(/Tính toán 3 nước/i)).toBeInTheDocument();

    expect(screen.getByText(/Cầm Đỏ \(Đi trước\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Cầm Đen \(Đi sau\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vào ván đấu/i })).toBeInTheDocument();
  });

  it('vào ván khi cầm Đỏ: người chơi đi trước, máy trả lời nước đi, có thể Đi lại', async () => {
    let resolveAiMove: (move: Move | null) => void = () => {};
    const mockAiClient: AiClient = {
      computeMove: jest.fn().mockImplementation(() => {
        return new Promise<Move | null>((resolve) => {
          resolveAiMove = resolve;
        });
      }),
      terminate: jest.fn(),
    };

    render(<PlayAiView initialSide="r" initialLevel="EASY" aiClient={mockAiClient} />);

    // Bấm vào ván
    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    // Ban đầu: Lượt của bạn (Đỏ)
    expect(screen.getByText(/Đến lượt bạn \(Đỏ\)/i)).toBeInTheDocument();
    // Nút Đi lại chưa được bấm vì chưa có nước nào
    expect(screen.getByRole('button', { name: /Đi lại/i })).toBeDisabled();

    // Người chơi đi nước đầu tiên: Pháo 2 bình 5 (h7 -> e7)
    const h7 = algebraicToSquare('h7');
    const e7 = algebraicToSquare('e7');

    const h7Square = screen.getByTestId(`piece-${h7}`);
    fireEvent.click(h7Square);

    const e7Square = screen.getByTestId(`cell-${e7}`);
    fireEvent.click(e7Square);

    // Sau khi người đi: có chỉ báo "Máy đang nghĩ…"
    expect(screen.getByTestId('ai-thinking-indicator')).toBeInTheDocument();
    expect(mockAiClient.computeMove).toHaveBeenCalledTimes(1);

    // Trong khi máy đang nghĩ: người chơi click không làm gì
    const b9Square = screen.getByTestId(`piece-${algebraicToSquare('b9')}`);
    fireEvent.click(b9Square);

    // Máy trả nước đi giả: Mã 2 tấn 3 của Đen (b0 -> c2)
    const blackMove: Move = {
      from: algebraicToSquare('b0'),
      to: algebraicToSquare('c2'),
    };

    await act(async () => {
      resolveAiMove(blackMove);
    });

    // Sau khi máy đi xong: máy hết nghĩ, quay lại lượt của bạn (Đỏ)
    await waitFor(() => {
      expect(screen.queryByTestId('ai-thinking-indicator')).not.toBeInTheDocument();
      expect(screen.getByText(/Đến lượt bạn \(Đỏ\)/i)).toBeInTheDocument();
    });

    // Biên bản ván cờ có 2 nước đi
    const moveList = screen.getByTestId('ai-move-list');
    expect(moveList).toHaveTextContent('Pháo 2 bình 5');
    expect(moveList).toHaveTextContent('Mã 2 tấn 3');

    // Nút Đi lại bây giờ đã được kích hoạt
    const undoButton = screen.getByRole('button', { name: /Đi lại/i });
    expect(undoButton).toBeEnabled();

    // Bấm Đi lại
    fireEvent.click(undoButton);

    // Đã lùi lại cả 2 nước, biên bản trống và nút Đi lại bị disabled
    expect(moveList).toHaveTextContent(/Chưa có nước đi nào/i);
    expect(undoButton).toBeDisabled();
  });

  it('vào ván khi cầm Đen: máy cầm Đỏ đi nước đầu tiên', async () => {
    let resolveAiMove: (move: Move | null) => void = () => {};
    const mockAiClient: AiClient = {
      computeMove: jest.fn().mockImplementation(() => {
        return new Promise<Move | null>((resolve) => {
          resolveAiMove = resolve;
        });
      }),
      terminate: jest.fn(),
    };

    render(<PlayAiView initialSide="b" initialLevel="HARD" aiClient={mockAiClient} />);

    // Chọn cầm Đen và bắt đầu
    fireEvent.click(screen.getByText(/Cầm Đen \(Đi sau\)/i));
    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    // Ngay khi vào ván, máy đang nghĩ nước đầu tiên
    expect(screen.getByTestId('ai-thinking-indicator')).toBeInTheDocument();

    // Máy đi Pháo 2 bình 5 (h7 -> e7)
    await act(async () => {
      resolveAiMove({
        from: algebraicToSquare('h7'),
        to: algebraicToSquare('e7'),
      });
    });

    // Đến lượt bạn (Đen)
    await waitFor(() => {
      expect(screen.queryByTestId('ai-thinking-indicator')).not.toBeInTheDocument();
      expect(screen.getByText(/Đến lượt bạn \(Đen\)/i)).toBeInTheDocument();
    });

    const moveList = screen.getByTestId('ai-move-list');
    expect(moveList).toHaveTextContent('Pháo 2 bình 5');
  });

  it('người chơi đầu hàng hiển thị hộp thoại kết thúc ván', async () => {
    const mockAiClient: AiClient = {
      computeMove: jest.fn().mockResolvedValue(null),
      terminate: jest.fn(),
    };

    render(<PlayAiView initialSide="r" aiClient={mockAiClient} />);

    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    // Bấm Đầu hàng
    fireEvent.click(screen.getByRole('button', { name: /Đầu hàng/i }));

    // Hiện modal xác nhận đầu hàng
    expect(screen.getByRole('heading', { name: 'Đầu hàng?' })).toBeInTheDocument();

    // Xác nhận đầu hàng trong modal
    fireEvent.click(screen.getByRole('button', { name: 'Đầu hàng' }));

    // Hiện modal kết quả kết thúc ván
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ván đấu kết thúc' })).toBeInTheDocument();
      expect(screen.getByText(/Máy đã thắng — Người chơi đầu hàng\./i)).toBeInTheDocument();
    });
  });

  it('ngăn chặn nước đi sai luật', async () => {
    const mockAiClient: AiClient = {
      computeMove: jest.fn().mockResolvedValue(null),
      terminate: jest.fn(),
    };

    render(<PlayAiView initialSide="r" aiClient={mockAiClient} />);
    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    // Chọn Xe ở i9
    const i9Square = screen.getByTestId(`piece-${algebraicToSquare('i9')}`);
    fireEvent.click(i9Square);

    // Cố gắng nhảy Xe tới e7 (nước sai luật của Xe vì có quân chắn và đi xiên)
    const e7Square = screen.getByTestId(`cell-${algebraicToSquare('e7')}`);
    fireEvent.click(e7Square);

    // Vẫn ở lượt bạn, không có nước đi nào được thực hiện
    expect(mockAiClient.computeMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('ai-move-list')).toHaveTextContent(/Chưa có nước đi nào/i);
  });

  it('cho phép đổi quân chọn và bỏ chọn khi click lại quân đó', async () => {
    const mockAiClient: AiClient = {
      computeMove: jest.fn().mockResolvedValue(null),
      terminate: jest.fn(),
    };

    render(<PlayAiView initialSide="r" aiClient={mockAiClient} />);
    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    const h7Piece = screen.getByTestId(`piece-${algebraicToSquare('h7')}`);
    const b7Piece = screen.getByTestId(`piece-${algebraicToSquare('b7')}`);

    // Click chọn Pháo h7 -> có mask selected
    fireEvent.click(h7Piece);
    expect(screen.getByTestId('selected-mask')).toBeInTheDocument();

    // Click chọn sang Pháo b7 -> vẫn có mask selected
    fireEvent.click(b7Piece);
    expect(screen.getByTestId('selected-mask')).toBeInTheDocument();

    // Click lại chính Pháo b7 -> bỏ chọn
    fireEvent.click(b7Piece);
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();
  });

  it('nút Ván mới mở popup xác nhận và đưa về màn hình chọn', async () => {
    const mockAiClient: AiClient = {
      computeMove: jest.fn().mockResolvedValue(null),
      terminate: jest.fn(),
    };

    render(<PlayAiView initialSide="r" aiClient={mockAiClient} />);
    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    // Bấm nút Ván mới
    fireEvent.click(screen.getByRole('button', { name: 'Ván mới' }));
    expect(screen.getByRole('heading', { name: 'Bắt đầu ván mới?' })).toBeInTheDocument();

    // Đồng ý
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }));

    // Đã quay về màn hình chọn
    expect(screen.getByRole('heading', { name: /Chơi cờ tướng với máy/i })).toBeInTheDocument();
  });
});
