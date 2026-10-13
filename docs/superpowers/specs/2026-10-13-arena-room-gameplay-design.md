# Design Specification: Xiangqi Arena Room UI & Click-to-Move Gameplay

## 1. Overview & Objectives

This specification defines the transformation of `apps/web/app/page.tsx` from an internal FEN inspection view into a full-featured, immersive **Xiangqi Arena Game Room**. It replaces the legacy debug sidebar with a professional 3-column layout featuring interactive piece movement (Click-to-Move, rules not yet enforced), dynamic side selection with automatic 180° board rotation, video call preview cards with 60-second countdown timers, a functional chat box, and match control actions.

### 1.1 Scope & Boundaries (MVP)
* **In Scope**:
  * Single-session client-side game room running in the browser.
  * Free Click-to-Move piece movement with deterministic interaction rules (selection, switching, capturing, deselecting).
  * Turn-based 60-second countdown timer.
  * Single source of truth for board orientation derived from `playerSide`.
  * Local webcam preview for the player with proper media track cleanup.
  * Local chat box with auto-scroll and quick-chat chips.
  * Custom modal dialogs for New Game, Draw Offer, and Exit actions.
* **Explicit Non-Goals (Post-MVP)**:
  * Xiangqi movement rule validation (rook lines, cannon hurdles, palace restrictions) — deferred to engine validator tickets.
  * Real-time network synchronization between separate players via WebSocket / backend.
  * Peer-to-peer remote video streaming via WebRTC.
  * Server-side persistence of chat or game state.
  * Resign action (deferred until game ending state machine is formalized).

---

## 2. Detailed Requirements & Edge Cases (P0, P1, P2)

### 2.1 Click-to-Move Interaction Rules (P0)
Interaction operates as a deterministic finite-state machine on the 90-square board:
1. **Selecting a piece**:
   - When `selectedSquare === null`, clicking any square containing a piece sets `selectedSquare = sq` and renders `mask.png` over that square.
   - Clicking an empty square does nothing.
2. **Deselecting**:
   - Clicking the currently selected piece again (`sq === selectedSquare`) deselects it (`selectedSquare = null`).
3. **Switching selection**:
   - Clicking any other piece of the **same side** (`piece.color === currentPiece.color`) immediately switches selection to the newly clicked piece (`selectedSquare = sq`).
   - Friendly fire is strictly forbidden: a piece can never capture a friendly piece.
4. **Moving to an empty square**:
   - When a piece is selected, clicking an empty square moves the piece from `selectedSquare` to `sq`.
5. **Capturing an opponent piece**:
   - When a piece is selected, clicking a square containing an **opponent piece** (`piece.color !== currentPiece.color`) moves the friendly piece to `sq` and removes the opponent piece from the board.
6. **Move finalization**:
   - Upon completing a valid move (steps 4 or 5):
     - Update `board` state with new piece positions.
     - Set `lastMove = { from: selectedSquare, to: sq }` (rendered with `mask2.png` at both squares).
     - Clear `selectedSquare = null`.
     - Toggle `sideToMove`: `'r'` $\rightarrow$ `'b'` or `'b'` $\rightarrow$ `'r'`.
     - Reset the active turn timer to 60 seconds.

### 2.2 Turn-Based 60-Second Countdown Timer (P0)
1. **Turn-based rhythm**:
   - Each turn has a 60-second countdown allowance.
   - Only the timer for the active player (`sideToMove`) counts down. The inactive player's timer remains paused.
   - When a move is completed, the timer for the player who just moved stops, and the timer for the incoming player resets to 60 seconds and starts ticking.
2. **Timeout handling**:
   - When the active timer reaches `0`, it stops (never negative) and displays a visible "Hết giờ!" (Time out) badge.
3. **Reset**:
   - Triggering "Ván mới" resets both timers to 60 seconds, sets `sideToMove = 'r'`, and restarts the timer.
4. **Lifecycle & Cleanliness**:
   - Timer interval is created via `useEffect` with proper `clearInterval` cleanup to prevent memory leaks and duplicate concurrent intervals on React re-renders.

### 2.3 Board Coordinates, Orientation & Single Source of Truth (P0)
1. **Fixed logical board array**:
   - The board state is stored as a fixed 90-element array `(Piece | null)[]` where index `sq = row * 9 + col` ($0 \le sq \le 89$).
   - Initialized directly from `@xiangqi-arena/xiangqi-core` via `Position.initial().board`.
2. **Single Source of Truth**:
   - `orientation` is a derived value, not a separate mutable state:
     ```typescript
     const orientation: 'r' | 'b' = playerSide;
     ```
   - Changing `playerSide` updates the player cards and board perspective (`orientation`), but does **not** alter the underlying board array indices, piece positions, or `sideToMove`.
3. **Coordinate mapping & piece uprightness**:
   - In Red view (`orientation === 'r'`), Row 0 (Black baseline) is top ($y = 10$ px), Row 9 (Red baseline) is bottom ($y = 730$ px).
   - In Black view (`orientation === 'b'`), Row 0 is bottom ($y = 730$ px), Row 9 is top ($y = 10$ px).
   - Piece images remain strictly upright (never rotated upside down).
   - Clicking a square at either orientation maps to the exact same logical `sq` index ($0..89$).

### 2.4 Webcam Preview vs Remote Video (P1)
1. **Local Player**:
   - Displays a camera toggle button ("Bật Camera" / "Tắt Camera").
   - When enabled, invokes `navigator.mediaDevices.getUserMedia({ video: true, audio: false })` and attaches the stream to a `<video autoPlay playsInline muted />` element.
   - If denied or device unavailable, renders a clear fallback notification and keeps avatar.
   - When toggled off or on component unmount, all media tracks (`stream.getTracks().forEach(t => t.stop())`) are properly closed.
2. **Opponent Card**:
   - Displays an animated warrior avatar placeholder with opponent credentials (e.g. "Kỳ Vương Đối Thủ", ELO 2150).

### 2.5 Local Chat Box (P1)
1. **State & Features**:
   - Stored in component state `messages: ChatMessage[]`.
   - Initialized with friendly system welcome messages.
   - Supports keyboard `Enter` to submit. Empty or whitespace-only messages are rejected.
   - Quick-chat action chips: *"Xin chào!"*, *"Nước cờ hay lắm!"*, *"Chúc may mắn!"*, *"Cảm ơn!"*.
   - Auto-scrolls to the newest message upon receiving/sending.

### 2.6 Match Control Modals & Highlight Layering (P1)
1. **Modal Actions**:
   - **Ván mới (New Game)**: Custom modal asking for confirmation. Upon confirm: resets board to 32 pieces via `Position.initial().board`, clears `selectedSquare` and `lastMove`, sets `sideToMove = 'r'`, resets timers to 60s, and adds a system message to chat.
   - **Xin hòa (Draw Offer)**: Custom modal informing: *"Bạn đã gửi lời đề nghị hòa (Chế độ chơi thử nghiệm cục bộ)"*.
   - **Thoát (Leave Room)**: Custom modal asking for confirmation before resetting room or navigating.
2. **Highlight Layering Priority**:
   - `mask2.png` (last move from & to) renders on Layer 2.
   - `mask.png` (selected square) renders on Layer 2b (stacking on top of `mask2.png` if selecting a square that was part of the last move).
   - CSS ring/border fallback ensures highlights are visible even if image assets are delayed.

### 2.7 Responsive Design & Accessibility (P2)
1. **Layout**:
   - Desktop ($\ge 1024$px): 3-column grid (Left: Video/Players; Center: Board & Controls; Right: Chat & Match Info).
   - Mobile / Tablet ($< 1024$px): Stacked layout with Board centered at top, player badges and controls directly accessible, and collapsible/tabbed chat below.
2. **Accessibility & Contrast**:
   - High contrast dark-mode theme (amber/red accents for Red, slate/cyan accents for Black).
   - Clear visual indication for active turn and timer under 10 seconds (red flashing).

---

## 3. Data Structures & Types

Reusing `@xiangqi-arena/xiangqi-core` definitions:
```typescript
import { Piece, Side, Position } from '@xiangqi-arena/xiangqi-core';

export interface ChatMessage {
  id: string;
  sender: 'you' | 'opponent' | 'system';
  senderName: string;
  text: string;
  time: string;
}

export interface ArenaState {
  board: (Piece | null)[];
  selectedSquare: number | null;
  lastMove: { from: number; to: number } | null;
  sideToMove: Side;
  playerSide: Side;
  redTime: number;
  blackTime: number;
  isTimerRunning: boolean;
  messages: ChatMessage[];
  modalState: {
    isOpen: boolean;
    type: 'newGame' | 'draw' | 'exit' | null;
    title: string;
    message: string;
  };
}
```

---

## 4. Component Structure

```
apps/web/
├── app/
│   └── page.tsx                  # Main Arena Game Room (orchestrator)
├── components/
│   ├── Board.tsx                 # Enhanced SVG Board renderer with Click-to-Move
│   ├── PlayerCard.tsx            # Video/Avatar card + 60s countdown timer
│   ├── ChatBox.tsx               # Chat message list + quick chat chips + input
│   ├── MatchControls.tsx         # Side selector (Red/Black) + Match action buttons
│   └── Modal.tsx                 # Accessible custom confirmation modal
```

---

## 5. Testing & Verification Plan

### 5.1 Automated Unit & Component Tests
1. **`tests/Board.spec.tsx` & `tests/gameplay.spec.tsx`**:
   - Initial render has 32 pieces matching standard setup.
   - Click friendly piece $\rightarrow$ sets `selectedSquare` and shows `mask.png`.
   - Click same piece $\rightarrow$ deselects (`selectedSquare = null`).
   - Click friendly piece B while friendly piece A is selected $\rightarrow$ switches selection to B without moving.
   - Click empty square with piece selected $\rightarrow$ moves piece, sets `lastMove`, and switches turn.
   - Click opponent piece with piece selected $\rightarrow$ captures opponent piece, updates `board`, sets `lastMove`.
   - Cannot capture friendly piece.
   - Movement and coordinate mapping function identically in both `'r'` and `'b'` orientations.
2. **`tests/timer.spec.tsx` / `tests/page.spec.tsx`**:
   - Active player timer decreases by 1s every second. Inactive player timer does not decrease.
   - Move resets incoming player timer to 60s and toggles active clock.
   - Reaching 0 stops timer and displays timeout indicator without negative numbers.
3. **`tests/ChatBox.spec.tsx`**:
   - Sending text appends message.
   - Empty/whitespace-only input does not dispatch message.
   - Clicking quick-chat button appends expected message text.
4. **`tests/MatchControls.spec.tsx`**:
   - Clicking "Phe Đỏ" / "Phe Đen" triggers side selection callback.
   - Clicking "Ván mới", "Xin hòa", "Thoát" opens corresponding modal.

### 5.2 Build & Linter Verification
- `pnpm test` (monorepo root: core, server, web).
- `pnpm lint` (0 errors across monorepo).
- `pnpm build` (production build passes).
