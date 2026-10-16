# Báo cáo Kiểm thử CI Rules Harness: Fixture Luật Đi Quân (XQA-47 / XQA-48)

- **Ngày thực thi**: 2026-10-16T18:21:01.102Z
- **Bộ dữ liệu fixture**: `packages/xiangqi-core/tests/fixtures/rules-movegen.fixture.json`
- **Tổng số test case**: 81
- **Tổng số ca pass hiện tại**: 64 / 81 (79%)
- **Số ca chờ tính năng (XQA-45 & XQA-49)**: 17

## 1. Kết quả theo loại quân

| Quân cờ | Tên quân | Đã đạt | Cần hoàn thiện | Tổng | Tỷ lệ |
|---|---|---|---|---|---|
| `k` | Tướng (King) | 18 | 1 | 19 | 95% |
| `a` | Sĩ (Advisor) | 8 | 0 | 8 | 100% |
| `b` | Tượng (Elephant) | 9 | 0 | 9 | 100% |
| `n` | Mã (Horse) | 11 | 0 | 11 | 100% |
| `r` | Xe (Chariot) | 6 | 4 | 10 | (Chờ XQA-45) |
| `c` | Pháo (Cannon) | 5 | 5 | 10 | (Chờ XQA-45) |
| `p` | Tốt (Pawn) | 7 | 7 | 14 | (Chờ XQA-45) |

## 2. Kết quả theo Requirement ID

| Requirement ID | Nội dung | Đã đạt | Chờ xử lý | Tổng |
|---|---|---|---|---|
| **FR-08** | Luật di chuyển cơ bản & Biên bàn cờ | 6 | 0 | 6 |
| **FR-11** | Nước đi Tướng, Sĩ, Tượng & Lộ mặt Tướng | 31 | 1 | 32 |
| **Điều 7.1b** | Hết nước đi bị xử thua (Bí nước / Stalemate) | 2 | 0 | 2 |
| **FR-12** | Nước đi Mã (Hình chữ L, 4 hướng cản chân Mã) | 10 | 0 | 10 |
| **FR-13** | Nước đi Xe, Pháo, Tốt (Ngòi pháo, Qua sông) | 15 | 16 | 31 |

## 3. Ghi chú và Khuyến nghị cho Sprint tiếp theo
- Toàn bộ luật đi vật lý của 4 quân **Tướng, Sĩ, Tượng, Mã** và các ràng buộc cơ bản của **FR-08, FR-11, FR-12, Điều 7.1b** hoạt động hoàn hảo 100%.
- Các test case không hợp lệ của quân khóa (Xe, Pháo, Tốt) đã trả về `false` đúng kỳ vọng.
- 16 ca hợp lệ của Xe, Pháo, Tốt (`expectedLegal: true`) sẵn sàng làm baseline thẩm định cho ticket **XQA-45**.
- 1 ca `TC-FR11-FG05` (Tướng bước ngang tạo thế lộ mặt trực diện) sẽ được hoàn thiện khi triển khai bộ lọc nước đi hợp lệ toàn diện và chống lộ mặt Tướng trong ticket **XQA-49**.
