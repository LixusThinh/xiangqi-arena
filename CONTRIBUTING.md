# Quy ước làm việc

## Branch

| Branch | Dùng cho | Ai được push trực tiếp |
|---|---|---|
| `main` | Bản đã release (tag 1.0 / 1.1 / 1.2 = Jira Version) | Không ai – chỉ merge từ `develop` khi release |
| `develop` | Nhánh tích hợp | Không ai – chỉ qua Pull Request |
| `feature/XQT-<số>-<mô-tả-ngắn>` | Tính năng | Người làm issue |
| `fix/XQT-<số>-<mô-tả>` | Sửa bug | Người làm issue |
| `test/XQT-<số>-<mô-tả>` | Test / fixture | QA |

Ví dụ: `feature/XQT-96-board-render`

## Commit

`<type>(<scope>): <mô tả> [XQT-<số>]`

- type: `feat` · `fix` · `test` · `docs` · `refactor` · `chore`
- scope: `web` · `server` · `core` · `ci` · `docs`

Ví dụ: `feat(core): parseFen + toFen round-trip [XQT-92]`

Có mã `XQT-<số>` thì Jira tự gắn commit/PR vào issue (khi đã nối GitHub với Jira).

## Pull Request

1. PR luôn vào `develop`, không vào `main`.
2. Tối thiểu **1 reviewer khác owner** approve.
3. CI phải xanh (khi CI đã có – XQT-83 / W1-14).
4. Mỗi PR một việc. Không gộp nhiều issue không liên quan vào một PR.
5. Không commit `.env`, mật khẩu, token.

## Definition of Done (Project Overview §31)

Code build được · test liên quan pass · đủ Acceptance Criteria của issue · reviewer/tester kiểm được.
