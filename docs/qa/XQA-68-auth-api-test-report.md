# Báo cáo kiểm thử API Auth (XQA-68)

| Mục | Nội dung |
|---|---|
| Ticket | XQA-68 – QA: API test Auth (register/login/me/refresh/logout) |
| Story | XQA-19 – Đăng xuất và giữ phiên đăng nhập |
| Đối chiếu | `docs/api/auth.md` (Contract v0.2), FR-01, FR-02, FR-03, NFR-04 |
| Bộ test | `apps/server/test/auth-api.e2e.spec.ts` (Jest + supertest) |
| Chạy | `corepack pnpm --filter @xiangqi-arena/server test` · CI: job **🧪 Test Suite & QA Rules Harness**, bước *Run server test suite* |
| Ngày chạy | 21/10/2026 |
| Kết quả | **44/44 Pass** · 0 Bug mới |

## 1. Phạm vi và cách test

Test dựng toàn bộ `AppModule` thật (controller, `ValidationPipe`, `ApiExceptionFilter`, `AuthJwtGuard`, CORS) qua `configureApp`, gửi HTTP request bằng supertest và kiểm tra status code, mã lỗi `code` và format lỗi chung của contract.

**Giới hạn cần biết:** PostgreSQL được thay bằng `test/support/in-memory-prisma.ts` vì CI chưa có service database. Bộ giả lập mô phỏng ràng buộc unique (lỗi P2002) và các truy vấn Auth đang dùng, nhưng **không** kiểm migration, kiểu cột hay hành vi transaction thật. Trước nghiệm thu release 1.1 cần chạy smoke test trên môi trường có PostgreSQL thật (`corepack pnpm dev`): đăng ký → đăng nhập → refresh → logout → `/auth/me` trả 401.

## 2. Độ phủ theo Acceptance Criteria

| AC XQA-68 | Trạng thái | Bằng chứng |
|---|---|---|
| Phủ ca lỗi 400 | Đạt | TC-05…14, 21…23, 37, 41, 43 |
| Phủ ca lỗi 401 | Đạt | TC-19, 20, 27…32, 35, 36, 38, 39, 40 |
| Phủ ca lỗi 409 | Đạt | TC-15, 16 |
| Chạy trong CI | Đạt | file `*.e2e.spec.ts` khớp `testRegex` của `apps/server/jest.config.cjs`, chạy chung `pnpm --filter server test` |

Ngoài AC còn phủ 403 `ACCOUNT_LOCKED` (TC-24, 33) và 404 (TC-44).

## 3. Danh sách test case

Cột *Actual* ghi kết quả lần chạy ngày 21/10/2026.

| TC | Requirement | Mô tả / Input | Expected | Actual | Status |
|---|---|---|---|---|---|
| TC-AUTH-API-01 | FR-01 | Đăng ký hợp lệ | 201, có accessToken + refreshToken, `user` không có password | Như expected | Pass |
| TC-AUTH-API-02 | NFR-04 | Kiểm tra bản ghi sau đăng ký | `passwordHash` là bcrypt cost 12, khác plaintext | Như expected | Pass |
| TC-AUTH-API-03 | FR-01 | Username/email viết hoa, có khoảng trắng | Lưu chữ thường, đã trim | Như expected | Pass |
| TC-AUTH-API-04 | NFR-05 | Gửi thêm `role: "ADMIN"`, `rating: 3000` | Field lạ bị bỏ, role PLAYER, rating 1200 | Như expected | Pass |
| TC-AUTH-API-05 | FR-01 | Thiếu username | 400 VALIDATION_ERROR, `details` có `username` | Như expected | Pass |
| TC-AUTH-API-06 | FR-01 | Username 2 ký tự | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-07 | FR-01 | Username 31 ký tự | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-08 | FR-01 | Username `ng<script>` | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-09 | FR-01 | Email `not-an-email` | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-10 | FR-01 | Password 7 ký tự | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-11 | FR-01 | Password 73 ký tự | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-12 | FR-01 | Password 25 ký tự `ệ` (75 byte UTF-8) | 400 VALIDATION_ERROR (giới hạn 72 byte bcrypt) | Như expected | Pass |
| TC-AUTH-API-13 | FR-01 | displayName chỉ khoảng trắng | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-14 | FR-01 | displayName 81 ký tự | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-15 | FR-01 | Username trùng, khác hoa/thường | 409 AUTH_IDENTIFIER_TAKEN | Như expected | Pass |
| TC-AUTH-API-16 | FR-01 | Email trùng, khác hoa/thường | 409 AUTH_IDENTIFIER_TAKEN, không tạo user thứ 2 | Như expected | Pass |
| TC-AUTH-API-17 | FR-02 | Đăng nhập bằng username | 200 + session | Như expected | Pass |
| TC-AUTH-API-18 | FR-02 | Đăng nhập bằng email viết hoa | 200 | Như expected | Pass |
| TC-AUTH-API-19 | FR-02 | Sai mật khẩu | 401 AUTH_INVALID_CREDENTIALS | Như expected | Pass |
| TC-AUTH-API-20 | FR-02, NFR-04 | So sánh lỗi "không có user" với "sai mật khẩu" | Body giống hệt nhau | Như expected | Pass |
| TC-AUTH-API-21 | FR-02 | Thiếu identifier | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-22 | FR-02 | Thiếu password | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-23 | FR-02 | identifier chỉ khoảng trắng | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-24 | BR-06 | Tài khoản LOCKED, đúng mật khẩu | 403 ACCOUNT_LOCKED, không tạo phiên | Như expected | Pass |
| TC-AUTH-API-25 | FR-02 | Đăng nhập thành công | `lastLoginAt` được cập nhật | Như expected | Pass |
| TC-AUTH-API-26 | FR-02 | `/auth/me` với token hợp lệ | 200, khớp `user` lúc đăng ký | Như expected | Pass |
| TC-AUTH-API-27 | NFR-04 | `/auth/me` không có header | 401 AUTH_TOKEN_MISSING | Như expected | Pass |
| TC-AUTH-API-28 | NFR-04 | Header `Token abc` | 401 AUTH_TOKEN_INVALID | Như expected | Pass |
| TC-AUTH-API-29 | NFR-04 | `Bearer not-a-jwt` | 401 AUTH_TOKEN_INVALID | Như expected | Pass |
| TC-AUTH-API-30 | NFR-04 | JWT ký bằng secret lạ | 401 AUTH_TOKEN_INVALID | Như expected | Pass |
| TC-AUTH-API-31 | NFR-04 | JWT hết hạn | 401 AUTH_TOKEN_EXPIRED | Như expected | Pass |
| TC-AUTH-API-32 | NFR-04 | JWT kiểu v0.1 (không có `sid`) | 401 AUTH_TOKEN_INVALID | Như expected | Pass |
| TC-AUTH-API-33 | BR-06 | Khóa tài khoản sau khi đã đăng nhập, gọi `/auth/me` | 403 ACCOUNT_LOCKED | Như expected | Pass |
| TC-AUTH-API-34 | XQA-19 AC1 | Refresh hợp lệ | 200, cả 2 token mới, token mới gọi `/auth/me` được | Như expected | Pass |
| TC-AUTH-API-35 | XQA-19 AC1 | Dùng lại refresh token đã đổi | 401 AUTH_REFRESH_INVALID | Như expected | Pass |
| TC-AUTH-API-36 | XQA-19 | Refresh token không tồn tại | 401 AUTH_REFRESH_INVALID | Như expected | Pass |
| TC-AUTH-API-37 | XQA-19 | Refresh thiếu body | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-38 | XQA-19 | Phiên quá hạn tuyệt đối | 401 AUTH_REFRESH_EXPIRED | Như expected | Pass |
| TC-AUTH-API-39 | FR-03 | Logout rồi dùng access token cũ | 204, sau đó 401 AUTH_SESSION_REVOKED | Như expected | Pass |
| TC-AUTH-API-40 | FR-03 | Logout rồi dùng refresh token cũ | 401 AUTH_REFRESH_INVALID | Như expected | Pass |
| TC-AUTH-API-41 | FR-03 | Logout thiếu body | 400 VALIDATION_ERROR | Như expected | Pass |
| TC-AUTH-API-42 | FR-02, FR-03 | Đăng nhập lại sau logout | Phiên mới gọi `/auth/me` được | Như expected | Pass |
| TC-AUTH-API-43 | Contract | Body JSON hỏng | 400 VALIDATION_ERROR theo format chung | Như expected | Pass |
| TC-AUTH-API-44 | Contract | Route không tồn tại | 404 NOT_FOUND theo format chung | Như expected | Pass |

## 4. Kiểm tra độ nhạy của bộ test

Để chắc bộ test bắt được lỗi thật chứ không pass vô điều kiện: tạm tắt điều kiện `revokedAt` trong `AuthJwtGuard` → TC-AUTH-API-39 **fail** đúng như mong đợi; khôi phục code → pass lại.

## 5. Ghi nhận, chưa phải bug

| # | Ghi nhận | Đề xuất |
|---|---|---|
| 1 | FR-01 ghi "đăng ký xong chuyển đến trang đăng nhập", nhưng API (contract D-05) trả session đăng nhập luôn. | BA (XQA-84 SRS v2) chốt một hướng; nếu giữ hành vi hiện tại thì sửa câu chữ FR-01 thành change request. |
| 2 | FR-19 ghi rating khởi đầu 1000, schema đang để mặc định 1200. | Như trên, chốt trong SRS v2. |
| 3 | Chưa có giới hạn số lần đăng nhập sai (NFR-04 "Brute Force"). | Ngoài phạm vi XQA-68; đưa vào backlog bảo mật. |
