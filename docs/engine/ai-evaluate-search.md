# AI: hàm đánh giá + Minimax Alpha-Beta (XQA-80, XQA-81)

Code: `packages/xiangqi-core/src/ai/` · Test: `packages/xiangqi-core/tests/ai-evaluate.spec.ts`, `ai-search.spec.ts` · Story XQA-23 · Epic XQA-7.

## 1. Vì sao đặt trong `xiangqi-core`

AI chỉ cần sinh nước hợp lệ và áp/hoàn nước của engine, không phụ thuộc Nest/React/DB. Đặt ở `src/ai/` để test chạy luôn trong job CI hiện có (CI đang gọi riêng từng package). Khi AI lớn lên (mức độ khó, opening book, chạy trong Web Worker) có thể tách thành package `xiangqi-ai`; khi đó phải thêm bước test vào CI.

## 2. Hàm đánh giá – `evaluate(position)` (XQA-80)

Điểm theo góc nhìn **bên tới lượt** (quy ước negamax): dương là bên tới lượt đang hơn.

### Giá trị quân (có nguồn)

Bảng "consensus" nhân 100:

| Quân | Giá trị | Ghi chú |
|---|---|---|
| Xe | 900 | |
| Pháo | 450 | |
| Mã | 400 | |
| Tượng | 250 | |
| Sĩ | 200 | |
| Tốt chưa qua sông | 100 | |
| Tốt đã qua sông | 200 | về lại 100 khi xuống hàng đáy đối phương |
| Tướng | không tính | mất Tướng = hết nước, xử trong tìm kiếm |

Nguồn:
- pychess.org, trang Xiangqi, mục *Piece Values*: Xe 9, Mã 4, Pháo 4.5, Tốt 1 trước sông hoặc ở hàng cuối và 2 sau khi qua sông, Sĩ 2, Tượng 2.5.
- xiangqi.com, bài *The Value of the Pieces in Xiangqi (Chinese Chess)*: cùng bảng, ghi Tượng 2 hoặc 2.5 và Xe 9 đến 10; bài cũng nói các con số này mang tính quy ước và lý thuyết tàn cuộc có thể thay đổi đánh giá.

Nhóm chọn Tượng = 2.5 theo pychess.

### Thưởng vị trí (heuristic của nhóm, không có nguồn ngoài)

Cố ý nhỏ (tối đa vài chục điểm) để AI không đổi quân lấy vị trí:
- Mã: +6 mỗi cột gần cột giữa, +15 khi đã qua sông.
- Pháo: +4 mỗi cột gần cột giữa.
- Xe: +3 mỗi cột gần cột giữa, +10 khi đã qua sông.
- Tốt đã qua sông: +5 mỗi cột gần cột giữa, +20 khi ở 3 cột giữa và áp sát cung đối phương.

Bảng giá trị vị trí chi tiết kiểu ElephantEye có thể thay vào sau (XQA-100), nhớ ghi nguồn.

### Kiểm thử (AC XQA-80)

- Đối xứng Đỏ/Đen: đảo màu + lật bàn + đổi bên đi → điểm không đổi, kiểm trên 40 thế cờ sinh ngẫu nhiên có seed.
- Đối xứng trái–phải, đổi dấu khi đổi bên đi, thế khởi đầu = 0, mất Xe ≈ −900.

## 3. Tìm kiếm – `searchBestMove(position, { depth, maxTimeMs? })` (XQA-81)

- Negamax + cắt tỉa Alpha-Beta, độ sâu tính theo nửa nước.
- Chỉ duyệt `position.generateLegalMoves()` → không bao giờ trả nước sai luật (AC1).
- Sắp xếp nước MVV-LVA: ăn quân giá trị cao bằng quân giá trị thấp trước.
- Hết nước hợp lệ = bên tới lượt thua (chiếu bí hoặc hết nước, Điều 7.1). Điểm thắng `MATE_SCORE − ply` để ưu tiên thắng sớm.
- Nút lá chỉ chấm điểm, không sinh nước. Đánh đổi: thế hết nước đúng ở nút lá chấm theo vật chất; đổi lại, độ sâu 3 từ thế khởi đầu chạy khoảng 0,1 giây trên máy dev, giữa ván dưới 0,2 giây (AC2 yêu cầu ≤ 2 giây).
- `maxTimeMs` (tùy chọn): quá giờ thì dừng và trả nước tốt nhất đã tìm (`timedOut: true`).
- Chưa có: quiescence search, bảng transposition, iterative deepening, xét lặp nước Điều 23 trong cây (để XQA-100).

### Bộ thế cờ kiểm tra "không bỏ nước ăn Xe miễn phí" (XQA-23 AC2)

Xe ăn Xe theo cột · Mã ăn Xe · Pháo ăn Xe qua ngòi · Đen ăn Xe Đỏ · Thế có nước chiếu thêm nhịp (AI có thể chiếu trước rồi vẫn ăn Xe). Kèm thế "tránh mất quân": không lấy Xe ăn Tốt có Xe bảo vệ.
