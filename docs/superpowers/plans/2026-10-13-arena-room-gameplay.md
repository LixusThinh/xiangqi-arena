# Implementation Plan: Xiangqi Arena Room UI & Click-to-Move Gameplay

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `apps/web/app/page.tsx` into a 3-column Xiangqi Arena Room with interactive piece movement (Click-to-Move, free movement without rule enforcement), turn-based 60-second countdown timers, dynamic side selection with automatic 180° board rotation, player/webcam cards, functional chat box, and match control modals.

**Architecture:** Next.js 14 App Router client component coordinating four modular UI components: `<PlayerCard />` (video/timer), `<Board />` (SVG renderer with click-to-move), `<MatchControls />` (side selection & actions), and `<ChatBox />` (local message stream). State uses pure React hooks with deterministic transition rules for piece selection, capturing, turn switching, and timer intervals.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Jest, React Testing Library, `@xiangqi-arena/xiangqi-core`.

**Spec:** [`docs/superpowers/specs/2026-10-13-arena-room-gameplay-design.md`](file:///C:/Users/lamphatdev/Desktop/xiangqi-arena/docs/superpowers/specs/2026-10-13-arena-room-gameplay-design.md)

## Global Constraints

- **Workspace Protocol**: `apps/web` must consume `@xiangqi-arena/xiangqi-core` via `"@xiangqi-arena/xiangqi-core": "workspace:*"`.
- **Pure Dependency Rule**: No changes to `@xiangqi-arena/xiangqi-core` or `@xiangqi-arena/server` beyond non-breaking additions: specifically, `type Side = Color` and `Position.initial()` were added to `@xiangqi-arena/xiangqi-core` for seamless board integration and type alignment.
- **Coordinate System**: 90 squares ($0..89$), row 0 is Black base ($y = 10$ px when Red view), row 9 is Red base ($y = 730$ px when Red view).
- **Single Source of Truth for Orientation**: `orientation = playerSide`.
- **Deterministic Click-to-Move**:
  - Selecting piece $\rightarrow$ highlights `selectedSquare`.
  - Re-clicking same piece $\rightarrow$ deselects.
  - Clicking friendly piece B $\rightarrow$ switches selection to B (no friendly fire).
  - Clicking empty square or opponent piece $\rightarrow$ moves/captures, records `lastMove = { from, to }`, toggles `sideToMove`, and resets active turn timer to 60s.
- **Timer Rules**: 60 seconds per turn for active side only, stops at 0 without negative numbers, clean `useEffect` intervals.
- **All tests pass**: `pnpm test` from monorepo root must pass across all packages (`server`, `xiangqi-core`, `web`).

---

### Task 1: Custom Modal Component (`Modal.tsx`) & Unit Tests

**Files:**
- Create: `apps/web/components/Modal.tsx`
- Test: `apps/web/tests/Modal.spec.tsx`

**Interfaces:**
- Consumes: None (pure React/DOM).
- Produces: `<Modal />` component supporting confirm and notice modes.

- [ ] **Step 1: Write failing component tests for Modal**

Create `apps/web/tests/Modal.spec.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../components/Modal';

describe('<Modal />', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} title="Xác nhận" message="Nội dung" onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, message, and action buttons when open', () => {
    render(
      <Modal isOpen={true} title="Ván mới" message="Bắt đầu ván mới?" onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(screen.getByText('Ván mới')).toBeInTheDocument();
    expect(screen.getByText('Bắt đầu ván mới?')).toBeInTheDocument();
    expect(screen.getByText('Xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Hủy')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const handleConfirm = jest.fn();
    render(
      <Modal isOpen={true} title="Thoát" message="Rời phòng?" onConfirm={handleConfirm} onCancel={jest.fn()} />
    );
    fireEvent.click(screen.getByText('Xác nhận'));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const handleCancel = jest.fn();
    render(
      <Modal isOpen={true} title="Thoát" message="Rời phòng?" onConfirm={jest.fn()} onCancel={handleCancel} />
    );
    fireEvent.click(screen.getByText('Hủy'));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('supports notice-only mode without cancel button', () => {
    render(
      <Modal isOpen={true} title="Xin hòa" message="Đã gửi đề nghị hòa" isNotice={true} onConfirm={jest.fn()} />
    );
    expect(screen.getByText('Đóng')).toBeInTheDocument();
    expect(screen.queryByText('Hủy')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/Modal.spec.tsx`
Expected: FAIL (`Cannot find module '../components/Modal'`).

- [ ] **Step 3: Implement `apps/web/components/Modal.tsx`**

Create `apps/web/components/Modal.tsx`:
```tsx
'use client';

import React from 'react';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isNotice?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function Modal({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isNotice = false,
  onConfirm,
  onCancel,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-100 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-amber-400">{title}</h3>
        <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 mt-2">
          {!isNotice && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-lg shadow-amber-500/20"
          >
            {isNotice ? 'Đóng' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/Modal.spec.tsx`
Expected: PASS (5/5 tests passing).

- [ ] **Step 5: Commit Modal component**

```bash
git add apps/web/components/Modal.tsx apps/web/tests/Modal.spec.tsx
git commit -m "feat(web): implement accessible custom Modal component [XQA-43]"
```

---

### Task 2: Match Controls Component (`MatchControls.tsx`) & Unit Tests

**Files:**
- Create: `apps/web/components/MatchControls.tsx`
- Test: `apps/web/tests/MatchControls.spec.tsx`

**Interfaces:**
- Consumes: None (pure React/Tailwind).
- Produces: `<MatchControls />` component with side selector and match actions.

- [ ] **Step 1: Write failing component tests for MatchControls**

Create `apps/web/tests/MatchControls.spec.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchControls from '../components/MatchControls';

describe('<MatchControls />', () => {
  it('renders side selector buttons and action buttons', () => {
    render(
      <MatchControls
        playerSide="r"
        onSelectSide={jest.fn()}
        onNewGame={jest.fn()}
        onOfferDraw={jest.fn()}
        onLeaveRoom={jest.fn()}
      />
    );

    expect(screen.getByText(/Phe Đỏ/i)).toBeInTheDocument();
    expect(screen.getByText(/Phe Đen/i)).toBeInTheDocument();
    expect(screen.getByText(/Ván mới/i)).toBeInTheDocument();
    expect(screen.getByText(/Xin hòa/i)).toBeInTheDocument();
    expect(screen.getByText(/Thoát/i)).toBeInTheDocument();
  });

  it('triggers onSelectSide when side buttons are clicked', () => {
    const handleSelectSide = jest.fn();
    render(
      <MatchControls
        playerSide="r"
        onSelectSide={handleSelectSide}
        onNewGame={jest.fn()}
        onOfferDraw={jest.fn()}
        onLeaveRoom={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Phe Đen/i));
    expect(handleSelectSide).toHaveBeenCalledWith('b');

    fireEvent.click(screen.getByText(/Phe Đỏ/i));
    expect(handleSelectSide).toHaveBeenCalledWith('r');
  });

  it('triggers match action callbacks', () => {
    const handleNewGame = jest.fn();
    const handleOfferDraw = jest.fn();
    const handleLeaveRoom = jest.fn();

    render(
      <MatchControls
        playerSide="r"
        onSelectSide={jest.fn()}
        onNewGame={handleNewGame}
        onOfferDraw={handleOfferDraw}
        onLeaveRoom={handleLeaveRoom}
      />
    );

    fireEvent.click(screen.getByText(/Ván mới/i));
    expect(handleNewGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Xin hòa/i));
    expect(handleOfferDraw).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Thoát/i));
    expect(handleLeaveRoom).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/MatchControls.spec.tsx`
Expected: FAIL (`Cannot find module '../components/MatchControls'`).

- [ ] **Step 3: Implement `apps/web/components/MatchControls.tsx`**

Create `apps/web/components/MatchControls.tsx`:
```tsx
'use client';

import React from 'react';
import { Side } from '@xiangqi-arena/xiangqi-core';

export interface MatchControlsProps {
  playerSide: Side;
  onSelectSide: (side: Side) => void;
  onNewGame: () => void;
  onOfferDraw: () => void;
  onLeaveRoom: () => void;
  className?: string;
}

export default function MatchControls({
  playerSide,
  onSelectSide,
  onNewGame,
  onOfferDraw,
  onLeaveRoom,
  className = '',
}: MatchControlsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 w-full max-w-[560px] p-3 bg-slate-800/90 border border-slate-700/80 rounded-xl shadow-lg backdrop-blur ${className}`}>
      {/* Chọn phe */}
      <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
        <button
          type="button"
          onClick={() => onSelectSide('r')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            playerSide === 'r'
              ? 'bg-red-600 text-white shadow-md shadow-red-900/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          Phe Đỏ
        </button>
        <button
          type="button"
          onClick={() => onSelectSide('b')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            playerSide === 'b'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
          Phe Đen
        </button>
      </div>

      {/* Nút thao tác trận đấu */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewGame}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/30 transition-colors shadow-sm"
        >
          🔄 Ván mới
        </button>
        <button
          type="button"
          onClick={onOfferDraw}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors shadow-sm"
        >
          🤝 Xin hòa
        </button>
        <button
          type="button"
          onClick={onLeaveRoom}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition-colors shadow-sm"
        >
          🚪 Thoát
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/MatchControls.spec.tsx`
Expected: PASS (3/3 tests passing).

- [ ] **Step 5: Commit MatchControls component**

```bash
git add apps/web/components/MatchControls.tsx apps/web/tests/MatchControls.spec.tsx
git commit -m "feat(web): implement MatchControls component with side selector [XQA-43]"
```

---

### Task 3: Player Card Component with Timer & Webcam Preview (`PlayerCard.tsx`) & Unit Tests

**Files:**
- Create: `apps/web/components/PlayerCard.tsx`
- Test: `apps/web/tests/PlayerCard.spec.tsx`

**Interfaces:**
- Consumes: None (pure React/Tailwind/Web APIs).
- Produces: `<PlayerCard />` component displaying player avatar or webcam video, title, side badge, and turn-based countdown timer.

- [ ] **Step 1: Write failing component tests for PlayerCard**

Create `apps/web/tests/PlayerCard.spec.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerCard from '../components/PlayerCard';

describe('<PlayerCard />', () => {
  it('renders player name, title, side badge, and formatted time', () => {
    render(
      <PlayerCard
        name="Kỳ Vương Đối Thủ"
        title="Đại Kiện Tướng"
        side="b"
        timeRemaining={45}
        isActive={true}
        isLocalPlayer={false}
      />
    );

    expect(screen.getByText('Kỳ Vương Đối Thủ')).toBeInTheDocument();
    expect(screen.getByText('Đại Kiện Tướng')).toBeInTheDocument();
    expect(screen.getByText('Phe Đen')).toBeInTheDocument();
    expect(screen.getByText('00:45')).toBeInTheDocument();
  });

  it('renders camera toggle button for local player', () => {
    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={60}
        isActive={false}
        isLocalPlayer={true}
      />
    );

    expect(screen.getByText(/Camera/i)).toBeInTheDocument();
  });

  it('highlights timer with red styling when time is 10 seconds or less', () => {
    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={8}
        isActive={true}
        isLocalPlayer={true}
      />
    );

    const timer = screen.getByText('00:08');
    expect(timer.className).toMatch(/text-red-400|text-red-500/);
  });

  it('displays timeout state when time is 0', () => {
    render(
      <PlayerCard
        name="Bạn"
        title="Cao Thủ"
        side="r"
        timeRemaining={0}
        isActive={true}
        isLocalPlayer={true}
      />
    );

    expect(screen.getByText('Hết giờ!')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/PlayerCard.spec.tsx`
Expected: FAIL (`Cannot find module '../components/PlayerCard'`).

- [ ] **Step 3: Implement `apps/web/components/PlayerCard.tsx`**

Create `apps/web/components/PlayerCard.tsx`:
```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Side } from '@xiangqi-arena/xiangqi-core';

export interface PlayerCardProps {
  name: string;
  title: string;
  side: Side;
  timeRemaining: number;
  isActive: boolean;
  isLocalPlayer?: boolean;
  className?: string;
}

export default function PlayerCard({
  name,
  title,
  side,
  timeRemaining,
  isActive,
  isLocalPlayer = false,
  className = '',
}: PlayerCardProps) {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const toggleCamera = async () => {
    if (isCameraOn) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsCameraOn(false);
      setCameraError(null);
    } else {
      try {
        setCameraError(null);
        if (navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setIsCameraOn(true);
        } else {
          setCameraError('Thiết bị không hỗ trợ');
        }
      } catch {
        setCameraError('Không có camera');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isCameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOn]);

  const formattedTime =
    timeRemaining <= 0
      ? '00:00'
      : `00:${timeRemaining.toString().padStart(2, '0')}`;

  const isLowTime = timeRemaining <= 10 && timeRemaining > 0;
  const isTimeOut = timeRemaining <= 0;

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
        isActive
          ? 'bg-slate-800/95 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
          : 'bg-slate-800/70 border-slate-700/70 opacity-90'
      } ${className}`}
    >
      {/* Khung Video / Avatar */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 flex items-center justify-center">
        {isCameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
            <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
              {side === 'r' ? '🔴' : '⚫'}
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {isLocalPlayer ? (cameraError ? cameraError : 'Webcam tắt') : 'Kỳ thủ trực tuyến'}
            </span>
          </div>
        )}

        {/* Nút Bật/Tắt Camera cho người chơi */}
        {isLocalPlayer && (
          <button
            type="button"
            onClick={toggleCamera}
            className={`absolute bottom-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide transition-all backdrop-blur ${
              isCameraOn
                ? 'bg-red-600/80 hover:bg-red-500 text-white'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600'
            }`}
          >
            {isCameraOn ? '📹 Tắt Camera' : '📷 Bật Camera'}
          </button>
        )}
      </div>

      {/* Thông tin người chơi & Đồng hồ 60s */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                side === 'r' ? 'bg-red-500 shadow-sm shadow-red-500' : 'bg-slate-300'
              }`}
            />
            <h4 className="text-xs font-bold text-slate-100 truncate">{name}</h4>
          </div>
          <span className="text-[11px] text-slate-400 truncate">{title}</span>
          <span className="text-[10px] text-slate-400">
            {side === 'r' ? 'Phe Đỏ' : 'Phe Đen'}
          </span>
        </div>

        {/* Đồng hồ số */}
        <div className="flex flex-col items-end">
          <div
            className={`px-3 py-1 rounded-lg font-mono font-bold text-sm tracking-wider border transition-all ${
              isTimeOut
                ? 'bg-red-950/80 border-red-700 text-red-400'
                : isLowTime
                ? 'bg-red-950/60 border-red-600 text-red-400 animate-pulse'
                : isActive
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {formattedTime}
          </div>
          {isTimeOut && (
            <span className="text-[10px] font-semibold text-red-400 mt-0.5">
              Hết giờ!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/PlayerCard.spec.tsx`
Expected: PASS (4/4 tests passing).

- [ ] **Step 5: Commit PlayerCard component**

```bash
git add apps/web/components/PlayerCard.tsx apps/web/tests/PlayerCard.spec.tsx
git commit -m "feat(web): implement PlayerCard component with turn timer and webcam preview [XQA-43]"
```

---

### Task 4: Chat Box Component with Quick Chat Chips (`ChatBox.tsx`) & Unit Tests

**Files:**
- Create: `apps/web/components/ChatBox.tsx`
- Test: `apps/web/tests/ChatBox.spec.tsx`

**Interfaces:**
- Consumes: None (pure React/Tailwind).
- Produces: `<ChatBox />` component with message stream, input field, and quick-chat phrases.

- [ ] **Step 1: Write failing component tests for ChatBox**

Create `apps/web/tests/ChatBox.spec.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatBox, { ChatMessage } from '../components/ChatBox';

describe('<ChatBox />', () => {
  const initialMessages: ChatMessage[] = [
    {
      id: '1',
      sender: 'system',
      senderName: 'Hệ thống',
      text: 'Chào mừng bạn đến với Xiangqi Arena!',
      time: '12:00',
    },
    {
      id: '2',
      sender: 'opponent',
      senderName: 'Đối thủ',
      text: 'Chúc may mắn!',
      time: '12:01',
    },
  ];

  it('renders message history', () => {
    render(<ChatBox messages={initialMessages} onSendMessage={jest.fn()} />);

    expect(screen.getByText('Chào mừng bạn đến với Xiangqi Arena!')).toBeInTheDocument();
    expect(screen.getByText('Chúc may mắn!')).toBeInTheDocument();
  });

  it('submits typed message on submit click and Enter key press', () => {
    const handleSend = jest.fn();
    render(<ChatBox messages={initialMessages} onSendMessage={handleSend} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value: 'Nước đi hay quá!' } });
    fireEvent.submit(input.closest('form')!);

    expect(handleSend).toHaveBeenCalledWith('Nước đi hay quá!');
  });

  it('does not submit empty or whitespace-only messages', () => {
    const handleSend = jest.fn();
    render(<ChatBox messages={initialMessages} onSendMessage={handleSend} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.submit(input.closest('form')!);

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('submits quick-chat phrase when a quick phrase chip is clicked', () => {
    const handleSend = jest.fn();
    render(<ChatBox messages={initialMessages} onSendMessage={handleSend} />);

    const quickChip = screen.getByText('Xin chào!');
    fireEvent.click(quickChip);

    expect(handleSend).toHaveBeenCalledWith('Xin chào!');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/ChatBox.spec.tsx`
Expected: FAIL (`Cannot find module '../components/ChatBox'`).

- [ ] **Step 3: Implement `apps/web/components/ChatBox.tsx`**

Create `apps/web/components/ChatBox.tsx`:
```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  sender: 'you' | 'opponent' | 'system';
  senderName: string;
  text: string;
  time: string;
}

export interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  className?: string;
}

const QUICK_CHIPS = ['Xin chào!', 'Nước cờ hay!', 'Chúc may mắn!', 'Cảm ơn!'];

export default function ChatBox({
  messages,
  onSendMessage,
  className = '',
}: ChatBoxProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  return (
    <div
      className={`flex flex-col h-full bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden backdrop-blur ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/80 flex items-center justify-between">
        <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
          💬 Trò chuyện phòng đấu
        </h3>
        <span className="text-[10px] text-slate-400">Cục bộ</span>
      </div>

      {/* Danh sách tin nhắn */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 min-h-[220px] max-h-[360px] text-xs">
        {messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div
                key={msg.id}
                className="text-center py-1 px-2.5 rounded-full bg-slate-900/60 text-slate-400 text-[11px] border border-slate-800 self-center"
              >
                {msg.text}
              </div>
            );
          }

          const isYou = msg.sender === 'you';
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                isYou ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <span className="text-[10px] text-slate-400 px-1 mb-0.5">
                {msg.senderName} • {msg.time}
              </span>
              <div
                className={`py-1.5 px-3 rounded-2xl leading-relaxed text-xs shadow-sm ${
                  isYou
                    ? 'bg-amber-600 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-slate-700 text-slate-100 rounded-tl-none border border-slate-600'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick chat chips */}
      <div className="px-3 py-2 border-t border-slate-700/50 flex gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSendMessage(chip)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-slate-700 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/ChatBox.spec.tsx`
Expected: PASS (4/4 tests passing).

- [ ] **Step 5: Commit ChatBox component**

```bash
git add apps/web/components/ChatBox.tsx apps/web/tests/ChatBox.spec.tsx
git commit -m "feat(web): implement ChatBox component with quick chips [XQA-43]"
```

---

### Task 5: Enhance `<Board />` Component with `board` Array Prop Support

**Files:**
- Modify: `apps/web/components/Board.tsx`
- Modify: `apps/web/tests/Board.spec.tsx`

**Interfaces:**
- Consumes: `Piece`, `isValidSquare`, `Position` from `@xiangqi-arena/xiangqi-core`.
- Produces: Enhanced `<Board />` component accepting either `board: (Piece | null)[]`, `position: Position`, or `fen: string`.

- [ ] **Step 1: Write tests for direct `board` array prop**

Add test in `apps/web/tests/Board.spec.tsx`:
```tsx
  it('renders directly with a raw board array prop', () => {
    const initialBoard = Position.initial().board;
    render(<Board board={initialBoard} />);
    const pieces = screen.getAllByTestId(/^piece-/);
    expect(pieces).toHaveLength(32);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/Board.spec.tsx`
Expected: FAIL or TypeScript error on `board` prop.

- [ ] **Step 3: Update `apps/web/components/Board.tsx`**

Modify `Board.tsx`:
Add `board?: (Piece | null)[];` to `BoardProps`.
In component body:
```tsx
export interface BoardProps {
  /** Mảng 90 ô quân cờ trực tiếp từ state */
  board?: (Piece | null)[];

  /** Chuỗi FEN. Nếu không truyền board hoặc position, component sẽ parse FEN này. */
  fen?: string;

  /** Đối tượng Position từ @xiangqi-arena/xiangqi-core. */
  position?: Position;

  /** Hướng nhìn: 'r' = Đỏ ở dưới (mặc định), 'b' = Đen ở dưới */
  orientation?: 'r' | 'b';

  /** Ô cờ đang được chọn (0..89) */
  selectedSquare?: number | null;

  /** Nước đi gần nhất để highlight { from, to } */
  lastMove?: { from: number; to: number } | null;

  /** Callback khi click vào bất kỳ ô nào */
  onSquareClick?: (square: number) => void;

  /** CSS class tùy biến */
  className?: string;
}
```
Resolve `boardArray`:
```tsx
  const { currentPos, error } = useMemo(() => {
    if (board) {
      return { currentPos: null, error: null };
    }
    if (position) {
      return { currentPos: position, error: null };
    }
    const fenStringToUse = fen ?? STARTING_FEN;
    try {
      return { currentPos: Position.fromFen(fenStringToUse), error: null };
    } catch (err) {
      return {
        currentPos: null,
        error: err instanceof Error ? err.message : 'Invalid FEN',
      };
    }
  }, [board, position, fen]);

  if (!board && (error || !currentPos)) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 ${className}`}>
        <p className="font-semibold">FEN không hợp lệ</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  const boardArray = board ?? currentPos!.board;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/Board.spec.tsx`
Expected: PASS (All tests pass).

- [ ] **Step 5: Commit Board component enhancement**

```bash
git add apps/web/components/Board.tsx apps/web/tests/Board.spec.tsx
git commit -m "feat(web): support direct board array prop in Board component [XQA-43]"
```

---

### Task 6: Arena Room Integration in `apps/web/app/page.tsx` & Gameplay Logic

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/tests/gameplay.spec.tsx`

**Interfaces:**
- Consumes: `<Board />`, `<PlayerCard />`, `<MatchControls />`, `<ChatBox />`, `<Modal />`, `Position`, `Side`, `Piece`.
- Produces: Complete Xiangqi Arena room page at `/` with deterministic click-to-move, 60s turn timer, side selection rotation, and local chat.

- [ ] **Step 1: Write integration tests for gameplay in `tests/gameplay.spec.tsx`**

Create `apps/web/tests/gameplay.spec.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ArenaPage from '../app/page';

describe('Xiangqi Arena Game Room Page', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders 3-column layout with 2 player cards, board, and chat box', () => {
    render(<ArenaPage />);
    expect(screen.getByText(/Xiangqi Arena/i)).toBeInTheDocument();
    expect(screen.getByText(/Kỳ Vương Đối Thủ/i)).toBeInTheDocument();
    expect(screen.getByText(/Bạn/i)).toBeInTheDocument();
    expect(screen.getByText(/Trò chuyện phòng đấu/i)).toBeInTheDocument();
  });

  it('selects piece on click and deselects on clicking the same piece', () => {
    render(<ArenaPage />);
    // Initial Red King is at sq 85
    const redKing = screen.getByTestId('piece-85');
    fireEvent.click(redKing);

    // Selected mask is rendered
    expect(screen.getByTestId('selected-mask')).toBeInTheDocument();

    // Re-clicking deselects
    fireEvent.click(redKing);
    expect(screen.queryByTestId('selected-mask')).not.toBeInTheDocument();
  });

  it('switches selection when clicking another friendly piece without moving', () => {
    render(<ArenaPage />);
    const redKing = screen.getByTestId('piece-85');
    const redAdvisor = screen.getByTestId('piece-84');

    fireEvent.click(redKing);
    expect(screen.getByTestId('selected-mask')).toHaveAttribute('y', '730');

    // Click friendly piece 84
    fireEvent.click(redAdvisor);
    expect(screen.getByTestId('selected-mask')).toHaveAttribute('x', expect.stringContaining('250'));
  });

  it('moves piece to empty square, updates lastMove, and switches turn', () => {
    render(<ArenaPage />);
    // Select Red Cannon at sq 73 (c1 in starting fen)
    const redCannon = screen.getByTestId('piece-73');
    fireEvent.click(redCannon);

    // Click empty destination sq 64
    const emptyCell = screen.getByTestId('cell-64');
    fireEvent.click(emptyCell);

    // Piece has moved to 64
    expect(screen.getByTestId('piece-64')).toBeInTheDocument();
    expect(screen.queryByTestId('piece-73')).not.toBeInTheDocument();
  });

  it('captures opponent piece when clicking opponent piece with piece selected', () => {
    render(<ArenaPage />);
    // Select Red Cannon at 73
    const redCannon = screen.getByTestId('piece-73');
    fireEvent.click(redCannon);

    // Free movement test: click Black Rook at sq 0
    const blackRook = screen.getByTestId('piece-0');
    fireEvent.click(blackRook);

    // Cannon is now at sq 0, old piece at 0 was captured
    expect(screen.getByTestId('piece-0')).toHaveAttribute('data-piece', 'rc');
  });

  it('toggles board perspective when side is selected', () => {
    render(<ArenaPage />);
    // Click Phe Đen
    fireEvent.click(screen.getByText(/Phe Đen/i));

    // King coordinates are now inverted
    const redKing = screen.getByTestId('piece-85');
    expect(redKing).toHaveAttribute('y', '10');
  });

  it('counts down turn timer by 1s every 1000ms for active player', () => {
    render(<ArenaPage />);
    expect(screen.getAllByText('00:60').length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText('00:58')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xiangqi-arena/web test tests/gameplay.spec.tsx`
Expected: FAIL (new UI elements not yet present on `page.tsx`).

- [ ] **Step 3: Implement `apps/web/app/page.tsx`**

Replace `apps/web/app/page.tsx` with complete implementation:
```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Board from '@/components/Board';
import PlayerCard from '@/components/PlayerCard';
import MatchControls from '@/components/MatchControls';
import ChatBox, { ChatMessage } from '@/components/ChatBox';
import Modal from '@/components/Modal';
import { Position, Side, Piece } from '@xiangqi-arena/xiangqi-core';

export default function ArenaPage() {
  // Bàn cờ và lượt đi
  const [board, setBoard] = useState<(Piece | null)[]>(() => Position.initial().board);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [sideToMove, setSideToMove] = useState<Side>('r');

  // Phe người chơi & Góc nhìn (Single Source of Truth)
  const [playerSide, setPlayerSide] = useState<Side>('r');
  const orientation: Side = playerSide;

  // Đồng hồ đếm ngược theo lượt 60s
  const [redTime, setRedTime] = useState(60);
  const [blackTime, setBlackTime] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Tin nhắn trò chuyện
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'sys-1',
      sender: 'system',
      senderName: 'Hệ thống',
      text: 'Chào mừng bạn đến với Xiangqi Arena!',
      time: 'Vừa xong',
    },
    {
      id: 'opp-1',
      sender: 'opponent',
      senderName: 'Kỳ Vương Đối Thủ',
      text: 'Chào bạn, chúc ván đấu hay!',
      time: 'Vừa xong',
    },
  ]);

  // Quản lý Modal thông báo
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isNotice?: boolean;
    action?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Turn-based 60s countdown timer
  useEffect(() => {
    if (!isTimerRunning) return;

    const timer = setInterval(() => {
      if (sideToMove === 'r') {
        setRedTime((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sideToMove, isTimerRunning]);

  // Click-to-Move Handler
  const handleSquareClick = (sq: number) => {
    const clickedPiece = board[sq];

    // 1. Chưa chọn quân
    if (selectedSquare === null) {
      if (clickedPiece) {
        setSelectedSquare(sq);
      }
      return;
    }

    const currentPiece = board[selectedSquare];
    if (!currentPiece) {
      setSelectedSquare(null);
      return;
    }

    // 2. Click lại chính quân đang chọn -> Hủy chọn
    if (sq === selectedSquare) {
      setSelectedSquare(null);
      return;
    }

    // 3. Click quân cùng phe -> Chuyển lựa chọn (không ăn quân cùng phe)
    if (clickedPiece && clickedPiece.color === currentPiece.color) {
      setSelectedSquare(sq);
      return;
    }

    // 4. Click ô đích (ô trống hoặc quân đối phương) -> Di chuyển / Ăn quân
    const newBoard = [...board];
    newBoard[sq] = currentPiece;
    newBoard[selectedSquare] = null;

    setBoard(newBoard);
    setLastMove({ from: selectedSquare, to: sq });
    setSelectedSquare(null);

    // Chuyển lượt đi và reset timer của lượt mới về 60s
    if (sideToMove === 'r') {
      setSideToMove('b');
      setBlackTime(60);
    } else {
      setSideToMove('r');
      setRedTime(60);
    }
  };

  // Nút hành động Ván mới
  const handleNewGameRequest = () => {
    setModalConfig({
      isOpen: true,
      title: 'Bắt đầu ván mới?',
      message: 'Toàn bộ quân cờ và thời gian sẽ được đặt lại từ đầu.',
      isNotice: false,
      action: () => {
        setBoard(Position.initial().board);
        setSelectedSquare(null);
        setLastMove(null);
        setSideToMove('r');
        setRedTime(60);
        setBlackTime(60);
        setIsTimerRunning(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            senderName: 'Hệ thống',
            text: 'Ván cờ mới đã bắt đầu!',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setModalConfig((m) => ({ ...m, isOpen: false }));
      },
    });
  };

  // Nút Xin hòa
  const handleOfferDrawRequest = () => {
    setModalConfig({
      isOpen: true,
      title: 'Xin hòa ván đấu',
      message: 'Bạn đã gửi lời đề nghị hòa (Chế độ chơi thử nghiệm cục bộ).',
      isNotice: true,
      action: () => setModalConfig((m) => ({ ...m, isOpen: false })),
    });
  };

  // Nút Thoát
  const handleLeaveRoomRequest = () => {
    setModalConfig({
      isOpen: true,
      title: 'Rời phòng đấu?',
      message: 'Bạn có chắc chắn muốn rời khỏi phòng cờ tướng này không?',
      isNotice: false,
      action: () => {
        setModalConfig((m) => ({ ...m, isOpen: false }));
      },
    });
  };

  // Gửi tin nhắn chat
  const handleSendMessage = (text: string) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'you',
      senderName: 'Bạn',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 md:p-6 select-none">
      {/* Top Header */}
      <header className="w-full max-w-7xl flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">♟️</span>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-amber-400 tracking-tight">
              Xiangqi Arena
            </h1>
            <p className="text-xs text-slate-400">Đấu trường cờ tướng trực tuyến</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Lượt: <span className="font-bold text-amber-300">{sideToMove === 'r' ? 'Đỏ' : 'Đen'}</span>
          </div>
        </div>
      </header>

      {/* 3-Column Arena Layout */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: Player Cards & Video (3 cols) */}
        <section className="lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1">
          {/* Đối thủ (Black nếu bạn là Red, Red nếu bạn là Black) */}
          <PlayerCard
            name="Kỳ Vương Đối Thủ"
            title="Đại Kiện Tướng • ELO 2150"
            side={playerSide === 'r' ? 'b' : 'r'}
            timeRemaining={playerSide === 'r' ? blackTime : redTime}
            isActive={sideToMove === (playerSide === 'r' ? 'b' : 'r')}
            isLocalPlayer={false}
          />

          {/* Người chơi (Bạn) */}
          <PlayerCard
            name="Bạn"
            title="Kiện Tướng • ELO 1980"
            side={playerSide}
            timeRemaining={playerSide === 'r' ? redTime : blackTime}
            isActive={sideToMove === playerSide}
            isLocalPlayer={true}
          />
        </section>

        {/* CỘT GIỮA: Bàn cờ trung tâm & Match Controls (6 cols) */}
        <section className="lg:col-span-6 flex flex-col items-center gap-4 order-1 lg:order-2">
          <Board
            board={board}
            orientation={orientation}
            selectedSquare={selectedSquare}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
          />

          <MatchControls
            playerSide={playerSide}
            onSelectSide={setPlayerSide}
            onNewGame={handleNewGameRequest}
            onOfferDraw={handleOfferDrawRequest}
            onLeaveRoom={handleLeaveRoomRequest}
          />
        </section>

        {/* CỘT PHẢI: Khung Chat (3 cols) */}
        <section className="lg:col-span-3 flex flex-col h-[560px] order-3">
          <ChatBox messages={messages} onSendMessage={handleSendMessage} className="h-full" />
        </section>
      </div>

      {/* Custom Modal */}
      <Modal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        isNotice={modalConfig.isNotice}
        onConfirm={modalConfig.action ?? (() => setModalConfig((m) => ({ ...m, isOpen: false })))}
        onCancel={() => setModalConfig((m) => ({ ...m, isOpen: false }))}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xiangqi-arena/web test tests/gameplay.spec.tsx`
Expected: PASS (All gameplay integration tests pass).

- [ ] **Step 5: Commit Arena page implementation**

```bash
git add apps/web/app/page.tsx apps/web/tests/gameplay.spec.tsx
git commit -m "feat(web): integrate 3-column Arena Room with click-to-move and turn timer [XQA-43]"
```

---

### Task 7: Monorepo Verification & Documentation

**Files:**
- Modify: `apps/web/README.md`

**Interfaces:**
- Consumes: All tests across packages.
- Produces: Updated documentation and clean build.

- [ ] **Step 1: Run full monorepo test suite**

Run: `pnpm test`
Expected: PASS across all workspace packages (`@xiangqi-arena/server`, `@xiangqi-arena/xiangqi-core`, `@xiangqi-arena/web`).

- [ ] **Step 2: Run full monorepo lint suite**

Run: `pnpm lint`
Expected: PASS with 0 lint errors across all packages.

- [ ] **Step 3: Run full monorepo build suite**

Run: `pnpm build`
Expected: PASS across core, server, and web.

- [ ] **Step 4: Update `apps/web/README.md`**

Document:
- 3-column Arena Room layout (`PlayerCard`, `Board`, `MatchControls`, `ChatBox`, `Modal`).
- Click-to-Move mechanics and interaction rules.
- Turn-based 60s countdown timer.
- Local webcam preview and track cleanup.
- Component props and usage.

- [ ] **Step 5: Commit documentation update**

```bash
git add apps/web/README.md
git commit -m "docs(web): document Arena Room components, click-to-move, and timer [XQA-43]"
```
