import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import PlayAiView from '@/components/ai/PlayAiView';
import * as aiGameApi from '@/lib/ai-game-api';
import * as authApi from '@/lib/auth-api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/play-ai',
}));

describe('PlayAiView - Lưu ván chơi với máy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('chưa đăng nhập: bấm "Lưu ván" mở modal yêu cầu đăng nhập kèm link /login?next=%2Fplay-ai', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue(null);

    render(<PlayAiView />);

    // Vào ván đấu
    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    // Bấm Lưu ván
    const saveButton = screen.getByRole('button', { name: /Lưu ván/i });
    fireEvent.click(saveButton);

    // Modal hiển thị
    expect(screen.getByText('Đăng nhập để lưu ván')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /Đăng nhập/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login?next=%2Fplay-ai');
  });

  it('đã đăng nhập: hiển thị khối "Ván đã lưu", cho phép Tiếp tục và Xoá', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue({
      accessToken: 'dummy-token',
      refreshToken: 'dummy-refresh',
      expiresAt: Date.now() + 3600000,
      user: {
        id: '1',
        username: 'player1',
        displayName: 'Player One',
        role: 'PLAYER',
        rating: 1200,
      },
    });

    const mockSavedGames: aiGameApi.AiGameSummary[] = [
      {
        id: '101',
        level: 'EASY',
        playerColor: 'r',
        plyCount: 2,
        updatedAt: '2026-11-02T07:00:00.000Z',
      },
    ];

    jest.spyOn(aiGameApi, 'listSavedAiGames').mockResolvedValue(mockSavedGames);
    jest.spyOn(aiGameApi, 'deleteAiGame').mockResolvedValue(undefined);
    jest.spyOn(aiGameApi, 'getAiGame').mockResolvedValue({
      id: '101',
      userId: '1',
      level: 'EASY',
      playerColor: 'r',
      initialFen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1',
      moves: [
        { from: 'b7', to: 'e7' },
        { from: 'b0', to: 'c2' },
      ],
      currentFen: 'r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR r - - 2 2',
      plyCount: 2,
      status: 'IN_PROGRESS',
      result: null,
      createdAt: '2026-11-02T06:50:00.000Z',
      updatedAt: '2026-11-02T07:00:00.000Z',
    });

    render(<PlayAiView />);

    await waitFor(() => {
      expect(screen.getByTestId('saved-games-section')).toBeInTheDocument();
      expect(screen.getByTestId('saved-game-101')).toBeInTheDocument();
    });

    const item = screen.getByTestId('saved-game-101');
    expect(within(item).getByText(/2 nước/i)).toBeInTheDocument();

    // Bấm Tiếp tục
    const resumeBtn = within(item).getByRole('button', { name: /Tiếp tục/i });
    await act(async () => {
      fireEvent.click(resumeBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Đến lượt bạn \(Đỏ\)/i)).toBeInTheDocument();
    });
  });

  it('xoá ván có modal xác nhận', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue({
      accessToken: 'dummy-token',
      refreshToken: 'dummy-refresh',
      expiresAt: Date.now() + 3600000,
      user: {
        id: '1',
        username: 'player1',
        displayName: 'Player One',
        role: 'PLAYER',
        rating: 1200,
      },
    });

    const mockSavedGames: aiGameApi.AiGameSummary[] = [
      {
        id: '102',
        level: 'HARD',
        playerColor: 'b',
        plyCount: 4,
        updatedAt: '2026-11-02T07:15:00.000Z',
      },
    ];

    jest.spyOn(aiGameApi, 'listSavedAiGames').mockResolvedValue(mockSavedGames);
    const deleteSpy = jest.spyOn(aiGameApi, 'deleteAiGame').mockResolvedValue(undefined);

    render(<PlayAiView />);

    await waitFor(() => {
      expect(screen.getByTestId('saved-game-102')).toBeInTheDocument();
    });

    // Bấm Xoá trên item
    const item = screen.getByTestId('saved-game-102');
    const deleteBtn = within(item).getByRole('button', { name: /Xoá/i });
    fireEvent.click(deleteBtn);

    // Modal xác nhận xuất hiện
    expect(screen.getByText('Xoá ván đã lưu?')).toBeInTheDocument();

    // Xác nhận xoá trong modal
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Xoá' });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(deleteSpy).toHaveBeenCalledWith('102');
  });

  it('đã đăng nhập: bấm "Lưu ván" lưu ngay và hiển thị thông báo đã lưu', async () => {
    jest.spyOn(authApi, 'getStoredSession').mockReturnValue({
      accessToken: 'dummy-token',
      refreshToken: 'dummy-refresh',
      expiresAt: Date.now() + 3600000,
      user: {
        id: '1',
        username: 'player1',
        displayName: 'Player One',
        role: 'PLAYER',
        rating: 1200,
      },
    });

    jest.spyOn(aiGameApi, 'listSavedAiGames').mockResolvedValue([]);
    jest.spyOn(aiGameApi, 'createAiGame').mockResolvedValue({
      id: '201',
      userId: '1',
      level: 'MEDIUM',
      playerColor: 'r',
      initialFen: '...',
      moves: [],
      currentFen: '...',
      plyCount: 0,
      status: 'IN_PROGRESS',
      result: null,
      createdAt: '2026-11-02T07:20:00.000Z',
      updatedAt: '2026-11-02T07:20:00.000Z',
    });
    const updateSpy = jest.spyOn(aiGameApi, 'updateAiGame').mockResolvedValue({
      id: '201',
      userId: '1',
      level: 'MEDIUM',
      playerColor: 'r',
      initialFen: '...',
      moves: [],
      currentFen: '...',
      plyCount: 0,
      status: 'IN_PROGRESS',
      result: null,
      createdAt: '2026-11-02T07:20:00.000Z',
      updatedAt: '2026-11-02T07:20:00.000Z',
    });

    render(<PlayAiView />);

    fireEvent.click(screen.getByRole('button', { name: /Vào ván đấu/i }));

    const saveBtn = screen.getByRole('button', { name: /Lưu ván/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('save-status')).toHaveTextContent(/Đã lưu lúc/i);
    });
    expect(updateSpy).toHaveBeenCalled();
  });
});
