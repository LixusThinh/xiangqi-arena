import type { LoginInput, RegisterInput } from './auth-api';

export type AuthField = keyof LoginInput | keyof RegisterInput;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

function utf8ByteLength(value: string): number {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    byteLength +=
      codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return byteLength;
}

function passwordError(password: string): string | undefined {
  const characterCount = Array.from(password).length;
  if (characterCount < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  if (characterCount > 72 || utf8ByteLength(password) > 72) {
    return 'Mật khẩu không được vượt quá 72 ký tự hoặc 72 byte UTF-8.';
  }
  return undefined;
}

export function validateLogin(input: LoginInput): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!input.identifier.trim()) {
    errors.identifier = 'Vui lòng nhập tên đăng nhập hoặc email.';
  }

  const error = passwordError(input.password);
  if (error) errors.password = error;
  return errors;
}

export function validateRegister(input: RegisterInput): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const username = input.username.trim();
  const email = input.email.trim();
  const displayName = input.displayName.trim();

  if (
    username.length < 3 ||
    username.length > 30 ||
    !/^[A-Za-z0-9_]+$/.test(username)
  ) {
    errors.username =
      'Tên đăng nhập phải có 3–30 ký tự, chỉ gồm chữ cái tiếng Anh, số hoặc dấu _.';
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.email = 'Vui lòng nhập email hợp lệ (tối đa 254 ký tự).';
  }
  if (displayName.length < 1 || displayName.length > 80) {
    errors.displayName = 'Tên hiển thị phải có từ 1 đến 80 ký tự.';
  }

  const error = passwordError(input.password);
  if (error) errors.password = error;
  return errors;
}
