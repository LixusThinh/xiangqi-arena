'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  AuthApiError,
  AuthSession,
  authApi,
  clearSession,
  saveSession,
} from '@/lib/auth-api';
import {
  AuthField,
  AuthFieldErrors,
  validateLogin,
  validateRegister,
} from '@/lib/auth-validation';
import { safeNextPath } from '@/lib/session';

const AUTH_FIELDS: readonly AuthField[] = [
  'identifier',
  'username',
  'email',
  'displayName',
  'password',
];

interface AuthFormProps {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === 'register';
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearErrors = (field?: keyof AuthFieldErrors) => {
    if (field) {
      setFieldErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[field];
        return nextErrors;
      });
    } else {
      setFieldErrors({});
    }
    setApiError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError('');

    let session: AuthSession;

    setIsSubmitting(true);
    try {
      if (isRegister) {
        const input = { username, email, password, displayName };
        const errors = validateRegister(input);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        session = await authApi.register(input);
      } else {
        const input = { identifier, password };
        const errors = validateLogin(input);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        session = await authApi.login(input);
      }

      try {
        const user = await authApi.me(session.accessToken);
        saveSession(session, user);
      } catch (error) {
        clearSession();
        throw error;
      }
      // Bị route guard đưa về /login?next=/room/ABC → đăng nhập xong quay lại đúng trang đó
      router.push(safeNextPath(new URLSearchParams(window.location.search).get('next')));
    } catch (error) {
      if (error instanceof AuthApiError && error.fields.length > 0) {
        // Backend trả 400 kèm details[] → đánh dấu đúng ô bị lỗi.
        const serverErrors: AuthFieldErrors = {};
        for (const field of error.fields) {
          if ((AUTH_FIELDS as readonly string[]).includes(field)) {
            serverErrors[field as AuthField] = 'Giá trị chưa hợp lệ.';
          }
        }
        setFieldErrors(serverErrors);
      }
      setApiError(
        error instanceof Error
          ? error.message
          : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName =
    'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20';

  const fieldError = (field: keyof AuthFieldErrors) =>
    fieldErrors[field] ? (
      <p id={`${field}-error`} className="mt-1.5 text-sm text-rose-300">
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-lg font-bold text-amber-300">
            象棋
          </span>
          <span>
            <span className="block text-lg font-extrabold tracking-tight text-amber-300">
              Xiangqi Arena
            </span>
            <span className="block text-xs text-slate-400">Đấu trường cờ tướng</span>
          </span>
        </Link>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {isRegister
                ? 'Đăng ký để sẵn sàng bước vào bàn cờ.'
                : 'Đăng nhập để tiếp tục cuộc chơi của bạn.'}
            </p>
          </div>

          {apiError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {isRegister ? (
              <>
                <div>
                  <label htmlFor="displayName" className="text-sm font-medium text-slate-200">
                    Tên hiển thị
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    autoComplete="name"
                    maxLength={80}
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      clearErrors('displayName');
                    }}
                    aria-invalid={Boolean(fieldErrors.displayName)}
                    aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
                    className={inputClassName}
                    placeholder="Tên của bạn"
                  />
                  {fieldError('displayName')}
                </div>

                <div>
                  <label htmlFor="username" className="text-sm font-medium text-slate-200">
                    Tên đăng nhập
                  </label>
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    maxLength={30}
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      clearErrors('username');
                    }}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                    className={inputClassName}
                    placeholder="Ví dụ: kythu123"
                  />
                  {fieldError('username')}
                </div>

                <div>
                  <label htmlFor="email" className="text-sm font-medium text-slate-200">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearErrors('email');
                    }}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    className={inputClassName}
                    placeholder="ban@example.com"
                  />
                  {fieldError('email')}
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="identifier" className="text-sm font-medium text-slate-200">
                  Tên đăng nhập hoặc email
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    clearErrors('identifier');
                  }}
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
                  className={inputClassName}
                  placeholder="player1 hoặc player@example.com"
                />
                {fieldError('identifier')}
              </div>
            )}

            <div>
              <label htmlFor="password" className="text-sm font-medium text-slate-200">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                maxLength={72}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearErrors('password');
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={inputClassName}
                placeholder="Ít nhất 8 ký tự"
              />
              {fieldError('password')}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang xử lý…'
                : isRegister
                  ? 'Tạo tài khoản'
                  : 'Đăng nhập'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <Link
              href={isRegister ? '/login' : '/register'}
              className="font-semibold text-amber-300 hover:text-amber-200"
            >
              {isRegister ? 'Đăng nhập' : 'Đăng ký'}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
