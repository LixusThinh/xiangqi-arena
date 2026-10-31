'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredSession, SESSION_CHANGED_EVENT, type AuthUser } from '@/lib/auth-api';
import { logout } from '@/lib/session';

/** Mục điều hướng chính. `match` xác định khi nào mục được tô là trang hiện tại. */
export const NAV_ITEMS = [
  { href: '/', label: 'Trang chủ', match: (p: string) => p === '/' },
  { href: '/lobby', label: 'Sảnh', match: (p: string) => p.startsWith('/lobby') || p.startsWith('/room') },
  { href: '/history', label: 'Lịch sử', match: (p: string) => p.startsWith('/history') },
  { href: '/practice', label: 'Chơi thử', match: (p: string) => p.startsWith('/practice') },
] as const;

/**
 * Trang tự có khung riêng nên không hiện header chung:
 * đăng nhập / đăng ký (form giữa màn hình), màn đang đánh (dành chỗ cho bàn cờ), chơi thử, wireframe.
 */
export function hidesAppHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/practice') ||
    pathname.startsWith('/flow') ||
    /^\/room\/[^/]+\/play\/?$/.test(pathname)
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredSession()?.user ?? null);
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (hidesAppHeader(pathname)) return null;
  const current = pathname ?? '/';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Xiangqi Arena – về trang chủ">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-sm font-bold text-amber-300">
            象
          </span>
          <span className="hidden text-base font-extrabold tracking-tight text-amber-300 sm:inline">Xiangqi Arena</span>
        </Link>

        <nav aria-label="Điều hướng chính" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.match(current);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-slate-800 text-amber-200' : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-[10rem] truncate text-sm text-slate-300 md:inline" title={user.displayName}>
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={() => {
                  void logout().then(() => router.push('/'));
                }}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-amber-400/60 hover:text-amber-200"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:text-amber-200"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
