# docs

- [REST Auth Contract v0.2](./api/auth.md) — register, login, refresh, logout, current-user.
- [Game Contract v0.1](./api/game.md) — trạng thái ván, đi quân, kiểm tra server-side (XQA-74).
- [REST Room Contract v0.1](./api/room.md) — tạo phòng, Sảnh, vào/rời phòng, phòng hiện tại (XQA-69).
- [Engine Board & FEN Design v0.1](./engine/board-fen-zobrist.md) — Board representation, FEN parser/exporter, apply/undo move, Zobrist hashing (XQA-42).
- [AI: hàm đánh giá + Minimax Alpha-Beta](./engine/ai-evaluate-search.md) — XQA-80, XQA-81, có nguồn bảng giá trị quân.
- [AI 3 mức độ khó + benchmark tự đấu](./engine/ai-difficulty-benchmark.md) — XQA-100: EASY/MEDIUM/HARD, quiescence, Khó thắng Dễ 90%/20 ván.
- [RepetitionJudge phần 1](./engine/repetition-judge.md) — lặp nước, chiếu mãi, bắt mãi theo Điều 23 (XQA-78).
- [Engine Rules & MoveGen Spec v0.1](./engine/rules-and-movegen-spec.md) — Hướng dẫn kiến trúc & giải thuật cản mã, ngòi pháo, lộ mặt tướng, MoveGen và kiểm tra chiếu bí.

## Quản lý dự án

- [WBS](./project/XQA-56-wbs.md) — 52 work package map về 14 Epic / 27 Story Jira (XQA-56).
- [Lịch 7 sprint & Gantt](./project/XQA-56-schedule-gantt.md) — milestone, đường găng, tải theo người ([ảnh Gantt](./project/XQA-56-gantt.svg)).
- [RACI](./project/XQA-56-raci.md) — 8 thành viên × 52 work package.
- [Risk Register v2](./project/XQA-56-risk-register-v2.md) — 27 rủi ro, cập nhật 26/10.
- [Sprint 1 Review + Issue log](./project/XQA-82-sprint1-review.md) — XQA-82.
- [Screen flow](./project/xqa-61-screen-flow.md) — XQA-61.
- [SRS v2.1 – AC release 1.2–1.4](./project/XQA-104-srs-v2.1-ac-release-1.2-1.4.md) — AC Cho/Khi/Thì cho Story Sprint 4–5, 9 câu hỏi chờ PM chốt (XQA-104, bản nháp).

Tài liệu đi kèm code:

## Kiểm thử (QA)

- [Test case Lịch sử ván – FR-17](./qa/XQA-99-test-cases-lich-su.md) — 17 TC API + giao diện (XQA-99).
- [Test case Chat, Report, Admin – FR-23…29](./qa/XQA-112-test-cases-chat-report-admin.md) — 30 TC, có XSS, rate limit, 403 admin (XQA-112).
- [Bộ 10 thế cờ mẫu (FEN)](./qa/XQA-113-bo-10-the-co-mau.md) — demo + test, có spec load từng FEN (XQA-113, PR riêng).
