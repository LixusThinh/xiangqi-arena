# Thiết kế Tính năng Nút "Quay lại" (Undo Move) - Xiangqi Arena

- **Mã tính năng / Nhánh**: `update/XQA-42-undo-move`
- **Ngày lập**: 14/10/2026
- **Trạng thái**: Đã phê duyệt (Approved)

---

## 1. Tóm tắt yêu cầu (Understanding Summary)
- **Mục đích**: Cho phép người chơi hoàn tác (undo) nước đi vừa thực hiện trên bàn cờ trong phòng đấu (Arena Room) để sửa sai hoặc phân tích thế cờ.
- **Phạm vi hoàn tác**: Hoàn tác từng nửa nước (1 ply) gần nhất. Khi bấm quay lại, đổi lại lượt đi về cho bên vừa đi và khôi phục lại vị trí quân cờ (bao gồm cả quân bị ăn nếu có).
- **Hành vi tương tác**: 
  - Thực thi ngay lập tức khi click nút "Quay lại" trên thanh `MatchControls`.
  - Tự động `disabled` khi chưa có nước đi nào (đầu ván).
  - Khôi phục `lastMove` trước đó (hoặc xóa highlight nếu đã lùi về ván ban đầu).
  - Hủy chọn ô đang chọn (`selectedSquare = null`).
  - Đặt lại đồng hồ 60s cho bên vừa được trả lại lượt đi.
  - Ghi thông báo hệ thống vào `ChatBox`: *"Đã quay lại nước đi"*.

---

## 2. Giả định kỹ thuật (Assumptions)
1. Tận dụng trực tiếp engine `Position` từ gói `@xiangqi-arena/xiangqi-core` (thông qua `applyMove` và `undoMove`) để đảm bảo toàn vẹn trạng thái cờ, Zobrist hash và lượt đi.
2. Trạng thái `undoHistory` được quản lý ở cấp độ trang `ArenaPage` (`apps/web/app/page.tsx`).
3. Khi người chơi bắt đầu ván mới (`onNewGame`), toàn bộ lịch sử `undoHistory` sẽ được xóa trắng.

---

## 3. Nhật ký quyết định (Decision Log)
| Quyết định | Các phương án cân nhắc | Lý do lựa chọn |
|---|---|---|
| **Hoàn tác 1 nửa nước (1 ply)** | Lùi 1 ply vs Lùi 2 plies (1 vòng đi) | Phù hợp với chế độ chơi tự do/luyện tập, cho phép người dùng lùi từng bước một về bất kỳ thời điểm nào. |
| **Thao tác ngay lập tức** | Thực thi ngay vs Mở modal xác nhận | Tránh gián đoạn trải nghiệm người dùng; trạng thái disabled ngăn ngừa việc bấm nhầm khi chưa có nước đi. |
| **Sử dụng engine `Position.undoMove()`** | Dùng `MoveUndo` stack vs Lưu mảng full snapshot (Memento) | Tiết kiệm bộ nhớ, đảm bảo đồng bộ hoàn hảo với các chỉ số engine (halfmove clock, lượt đi, Zobrist hash). |
| **Trực quan hóa & Thông báo** | Reset 60s + highlight nước cũ + chat thông báo vs Chỉ đổi bàn cờ | Cung cấp phản hồi xúc giác và thông tin rõ ràng cho người chơi trong phòng. |

---

## 4. Thiết kế chi tiết (Detailed Design)

### 4.1. Nâng cấp `MatchControls.tsx`
Bổ sung 2 props mới:
```typescript
export interface MatchControlsProps {
  playerSide: Side;
  onSelectSide: (side: Side) => void;
  onNewGame: () => void;
  onOfferDraw: () => void;
  onLeaveRoom: () => void;
  onUndoMove?: () => void; // Callback khi click Quay lại
  canUndo?: boolean;       // Trạng thái khả dụng của nút
  className?: string;
}
```

Nút bấm được đặt trong cụm thao tác trận đấu:
```tsx
<button
  type="button"
  disabled={!canUndo}
  onClick={onUndoMove}
  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shadow-sm ${
    canUndo
      ? 'bg-slate-700 hover:bg-slate-600 text-sky-300 border border-sky-500/30'
      : 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700'
  }`}
>
  ↩️ Quay lại
</button>
```

### 4.2. Quản lý trạng thái tại `apps/web/app/page.tsx`
1. **Khởi tạo trạng thái**:
   ```typescript
   interface UndoRecord {
     undo: MoveUndo;
     prevLastMove: { from: number; to: number } | null;
   }
   const [position, setPosition] = useState<Position>(() => Position.initial());
   const [undoHistory, setUndoHistory] = useState<UndoRecord[]>([]);
   ```

2. **Khi thực hiện nước đi (`handleSquareClick`)**:
   ```typescript
   const move = { from: selectedSquare, to: sq };
   const undoInfo = position.applyMove(move);
   setUndoHistory((prev) => [...prev, { undo: undoInfo, prevLastMove: lastMove }]);
   setBoard([...position.board]);
   setSideToMove(position.sideToMove);
   setLastMove(move);
   setSelectedSquare(null);
   // Reset turn timer cho bên tiếp theo
   ```

3. **Khi thực hiện hoàn tác (`handleUndoMove`)**:
   ```typescript
   if (undoHistory.length === 0) return;
   const nextHistory = [...undoHistory];
   const lastRecord = nextHistory.pop()!;
   position.undoMove(lastRecord.undo);

   setUndoHistory(nextHistory);
   setBoard([...position.board]);
   setSideToMove(position.sideToMove);
   setLastMove(lastRecord.prevLastMove);
   setSelectedSquare(null);

   // Reset timer cho bên vừa được trả lượt
   if (position.sideToMove === 'r') {
     setRedTimer(60);
   } else {
     setBlackTimer(60);
   }

   // Thông báo chat
   handleSendMessage('Đã quay lại nước đi.');
   ```

4. **Khi bắt đầu ván mới (`onNewGame`)**:
   - Khởi tạo lại `Position.initial()`.
   - `setUndoHistory([])`.
   - `setLastMove(null)`.

---

## 5. Chiến lược kiểm thử (Testing Strategy)
1. **Unit Tests (`apps/web/tests/MatchControls.spec.tsx`)**:
   - Kiểm tra render nút "Quay lại".
   - Kiểm tra trạng thái disabled khi `canUndo = false`.
   - Kiểm tra gọi callback `onUndoMove` khi `canUndo = true`.
2. **Integration Tests (`apps/web/tests/gameplay.spec.tsx`)**:
   - Kiểm tra thực hiện nước đi $\rightarrow$ nút "Quay lại" kích hoạt $\rightarrow$ bấm nút $\rightarrow$ bàn cờ và lượt đi khôi phục về trạng thái trước đó.
   - Kiểm tra hoàn tác nước đi ăn quân $\rightarrow$ quân cờ bị ăn phục hồi đúng tọa độ.
   - Kiểm tra hoàn tác toàn bộ các nước đi về ván ban đầu.
