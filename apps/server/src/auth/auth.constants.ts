/** Thời hạn access JWT (giây). Phải khớp `expiresIn` trả về cho FE. */
export const ACCESS_TOKEN_TTL_SEC = 900;

/** Thời hạn mặc định của refresh token (giây) = 7 ngày. Đổi bằng biến môi trường REFRESH_TOKEN_TTL_SEC. */
export const DEFAULT_REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

/** Số byte ngẫu nhiên của refresh token; base64url của 32 byte = 43 ký tự. */
export const REFRESH_TOKEN_BYTES = 32;
