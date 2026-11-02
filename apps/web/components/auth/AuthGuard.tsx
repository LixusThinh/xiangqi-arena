'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { getStoredSession, SESSION_CHANGED_EVENT } from '@/lib/auth-api';
import { loginPathFor } from '@/lib/session';

/**
 * Các trang chỉ dành cho người đã đăng nhập (XQA-67, FR-03).
 * Thêm trang mới cần đăng nhập thì thêm tiền tố vào đây.
 */
export const PROTECTED_PATH_PREFIXES = ['/lobby', '/room', '/history', '/profile'] as const;

export function isProtectedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Route guard phía client. Token nằm trong localStorage nên middleware (chạy trên server)
 * không đọc được; guard chạy trong root layout và:
 * - chưa đăng nhập vào trang cần đăng nhập → về /login?next=<trang đang mở>;
 * - đang ở trang cần đăng nhập mà phiên bị xóa (logout, refresh thất bại, tab khác logout) → về /login.
 * Access token hết hạn nhưng phiên còn refresh được thì KHÔNG đá ra (lib/session.ts tự refresh).
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const protectedPath = isProtectedPath(pathname);
  const [allowed, setAllowed] = useState(!protectedPath);

  useEffect(() => {
    if (!protectedPath) {
      setAllowed(true);
      return;
    }
    const check = () => {
      if (getStoredSession()) {
        setAllowed(true);
      } else {
        setAllowed(false);
        router.replace(loginPathFor(`${window.location.pathname}${window.location.search}`));
      }
    };
    check();
    window.addEventListener(SESSION_CHANGED_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, [protectedPath, pathname, router]);

  if (protectedPath && !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Đang kiểm tra đăng nhập…
      </main>
    );
  }
  return <>{children}</>;
}
