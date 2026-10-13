# Design Specification: Xiangqi Arena Room UI & Click-to-Move Gameplay

## 1. Overview & Objectives

This specification defines the transformation of `apps/web/app/page.tsx` from an internal FEN inspection view into a full-featured, immersive **Xiangqi Arena Game Room**. It replaces the legacy debug sidebar with a professional 3-column layout featuring interactive piece movement (Click-to-Move, rules not yet enforced), dynamic side selection with automatic 180° board rotation, video call preview cards with 60-second countdown timers, a functional chat box, and match control actions.

### 1.1 Acceptance Criteria
1. **Interactive Piece Movement (Click-to-Move)**:
   - Click piece $\rightarrow$ highlights selected square (`mask.png`).
   - Click destination square $\rightarrow$ moves piece (capturing any occupant) and marks origin/target highlights (`mask2.png`).
   - Click same piece $\rightarrow$ deselects.
   - Click another friendly piece $\rightarrow$ switches selection.
   - Free movement (no rule validation required at this stage).
2. **Side Selection & Board Orientation**:
   - Selecting Red ($\text{'r'}$) sets board perspective to Red at bottom (`orientation: 'r'`).
   - Selecting Black ($\text{'b'}$) rotates the board 180° putting Black at bottom (`orientation: 'b'`).
3. **Countdown Timers (60s)**:
   - 60-second turn countdown ticking every 1000ms for the active side.
   - Resets to 60s upon each completed move.
4. **Player & Video Call Cards**:
   - Two player cards (Opponent on top, Player on bottom).
   - Video area supporting local webcam preview or fallback animated martial-arts avatars.
   - Digital countdown readout turning red/urgent under 10 seconds.
5. **Real-time Chat Box**:
   - Message history with timestamps and sender identifiers.
   - Message input field with Enter-to-send support.
   - Quick chat phrases (e.g., "Xin chào!", "Nước cờ hay lắm!", "Chúc may mắn!").
6. **Match Control Actions**:
   - **Ván mới (New Game)**: Resets 32 pieces to initial starting position, resets timers to 60s, sets turn to Red.
   - **Xin hòa (Draw Offer)**: Modal / alert acknowledging draw request.
   - **Thoát (Leave Room)**: Modal / alert confirming room exit.

---

## 2. Decision Log

1. **Layout Strategy**:
   - *Decided*: 3-Column Arena Layout (Left: Video & Players; Center: Board & Match Controls; Right: Chat Box & Move Info).
   - *Alternatives considered*: 2-column stacked layout, floating overlay widgets.
   - *Rationale*: Matches industry standards (Lichess/Chess.com) with balanced visual hierarchy; cleanly isolates components for future WebRTC & WebSocket backend integration.
2. **Piece Interaction**:
   - *Decided*: Click-to-Move free navigation.
   - *Rationale*: Simple, responsive, works equally well on desktop mouse and mobile touchscreens without drag-and-drop coordinate drift.
3. **Timer Architecture**:
   - *Decided*: 60s per-turn countdown with cleanup on component unmount.
   - *Rationale*: Enforces brisk gameplay rhythm and provides realistic competitive feel.

---

## 3. Component Architecture & Hierarchy

```
apps/web/
├── app/
│   └── page.tsx                  # Main Arena Room page (state coordinator)
├── components/
│   ├── Board.tsx                 # SVG Board renderer
│   ├── PlayerCard.tsx            # Video/Avatar card + 60s timer + player info
│   ├── ChatBox.tsx               # Chat message list + input + quick chat chips
│   └── MatchControls.tsx         # New Game, Draw, Resign/Exit, Side selection
```

### 3.1 State Management (`app/page.tsx`)
```typescript
interface ArenaState {
  board: (Piece | null)[];                // 90-square piece array
  selectedSquare: number | null;          // 0..89 or null
  lastMove: { from: number; to: number } | null;
  sideToMove: 'r' | 'b';                  // Current turn
  playerSide: 'r' | 'b';                  // Local player choice ('r' or 'b')
  orientation: 'r' | 'b';                 // Matches playerSide
  redTime: number;                        // Remaining seconds (default 60)
  blackTime: number;                      // Remaining seconds (default 60)
  isTimerRunning: boolean;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  sender: 'you' | 'opponent' | 'system';
  text: string;
  time: string;
}
```

---

## 4. Sub-Components Specification

### 4.1 `PlayerCard.tsx`
- **Props**:
  - `name`: string
  - `title`: string (e.g. "Đại Kiện Tướng")
  - `color`: `'r' | 'b'`
  - `timeRemaining`: number (seconds)
  - `isActive`: boolean (whether it is this player's turn)
  - `isLocalPlayer`: boolean (if true, shows "Bật Camera" toggle button)
- **Features**:
  - WebRTC webcam preview toggle via `navigator.mediaDevices.getUserMedia` when `isLocalPlayer` is true.
  - Elegant avatar placeholder when camera is off.
  - Digital timer displaying `mm:ss` or `ss` seconds, glowing red when `<= 10`.

### 4.2 `MatchControls.tsx`
- **Props**:
  - `playerSide`: `'r' | 'b'`
  - `onSelectSide`: `(side: 'r' | 'b') => void`
  - `onNewGame`: `() => void`
  - `onOfferDraw`: `() => void`
  - `onLeaveRoom`: `() => void`
- **Features**:
  - Two-state side selector buttons: "🔴 Phe Đỏ" and "⚫ Phe Đen".
  - Action buttons: "Ván mới", "Xin hòa", "Thoát".

### 4.3 `ChatBox.tsx`
- **Props**:
  - `messages`: `ChatMessage[]`
  - `onSendMessage`: `(text: string) => void`
- **Features**:
  - Auto-scrolling message list.
  - Quick phrase chips: "Xin chào!", "Nước cờ hay!", "Cảm ơn!", "Chúc may mắn!".
  - Text input with submit button and keyboard Enter listener.

---

## 5. Testing & Verification

1. **Unit & Component Tests**:
   - `tests/gameplay.spec.tsx`:
     - Test initial board setup (32 pieces).
     - Test click piece selects square, click destination moves piece and updates `lastMove`.
     - Test capturing opponent piece removes opponent piece from board.
     - Test side selection toggles orientation between `'r'` and `'b'`.
     - Test "Ván mới" resets board back to starting FEN.
   - `tests/ChatBox.spec.tsx`:
     - Test typing text and clicking Send or pressing Enter adds new message.
     - Test clicking quick chat chip immediately sends message.
2. **Regression Verification**:
   - `pnpm test` passes across all workspace packages.
   - `pnpm lint` passes with 0 errors.
   - `pnpm build` completes production Next.js build cleanly.
