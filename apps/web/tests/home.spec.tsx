import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../app/page';
import HeroBoard, { HERO_OPENING_MOVES } from '@/components/home/HeroBoard';
import { Position, algebraicToSquare, type Move } from '@xiangqi-arena/xiangqi-core';

describe('Trang chủ mới (Việc 2)', () => {
  it('toàn bộ các nước khai cuộc của HeroBoard đều hợp lệ theo engine', () => {
    const pos = Position.initial();
    expect(HERO_OPENING_MOVES.length).toBeGreaterThanOrEqual(6);
    expect(HERO_OPENING_MOVES.length).toBeLessThanOrEqual(10);

    for (const [fromAlg, toAlg] of HERO_OPENING_MOVES) {
      const move: Move = {
        from: algebraicToSquare(fromAlg),
        to: algebraicToSquare(toAlg),
      };
      const isLegal = pos.isLegalMove(move);
      expect(isLegal).toBe(true);
      pos.applyMove(move);
    }
  });

  it('hiển thị đầy đủ tiêu đề, nút hành động chính (Chơi với máy, Chơi online, Chơi thử)', () => {
    render(<HomePage />);

    // Tiêu đề hero
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/Đấu cờ tướng trực tuyến chuẩn luật Việt Nam/i);

    // Nút chính: Chơi với máy
    const aiButton = screen.getByRole('link', { name: /Chơi với máy/i });
    expect(aiButton).toBeInTheDocument();
    expect(aiButton).toHaveAttribute('href', '/play-ai');

    // Nút Tạo tài khoản, Đăng nhập, Chơi thử
    expect(screen.getByRole('link', { name: 'Tạo tài khoản' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Chơi thử 2 người 1 máy/i })).toHaveAttribute('href', '/practice');
  });

  it('hiển thị đầy đủ 5 thẻ tính năng với nội dung chuẩn', () => {
    render(<HomePage />);

    expect(screen.getByText('Chơi với máy 3 mức')).toBeInTheDocument();
    expect(screen.getByText(/Luật cờ tướng Việt Nam & Điều 23/i)).toBeInTheDocument();
    expect(screen.getByText('Đồng hồ do máy chủ tính')).toBeInTheDocument();
    expect(screen.getByText('Gọi video trong ván')).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử & xem lại ván đấu/i)).toBeInTheDocument();
  });

  it('HeroBoard hỗ trợ nút tạm dừng / chạy tiếp', () => {
    render(<HeroBoard />);

    const toggleBtn = screen.getByRole('button', { name: /Tạm dừng chạy bàn cờ/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Tiếp tục chạy bàn cờ/i })).toBeInTheDocument();
  });

  it('HeroBoard tôn trọng prefers-reduced-motion', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<HeroBoard />);
    expect(screen.getByText(/Khai cuộc: Pháo đầu vs Bình phong Mã/i)).toBeInTheDocument();

    window.matchMedia = originalMatchMedia;
  });
});
