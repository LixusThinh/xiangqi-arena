'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import HeroBoard from '@/components/home/HeroBoard';
import FeatureCards from '@/components/home/FeatureCards';
import { getStoredSession, SESSION_CHANGED_EVENT } from '@/lib/auth-api';

const STEPS = [
  {
    title: 'Tạo phòng',
    body: 'Chọn màu quân, thời gian (10 phút hoặc 5 phút + 2 giây/nước), công khai hoặc riêng tư.',
  },
  {
    title: 'Mời đối thủ',
    body: 'Gửi mã phòng hoặc đường dẫn mời; các phòng công khai xuất hiện ngay trong Sảnh.',
  },
  {
    title: 'Vào ván đấu',
    body: 'Đủ 2 người là bắt đầu: đi quân, xin hòa, xin thua, gọi video ngay trên cùng một màn hình.',
  },
] as const;

export default function HomePage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const sync = () => setSignedIn(getStoredSession() !== null);
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, sync);
  }, []);

  return (
    <main className="bg-ink-950 text-paper-100 min-h-[calc(100vh-3.5rem)] pb-16 overflow-x-hidden">
      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12 md:py-16 grid items-center gap-8 md:gap-10 md:grid-cols-[1.1fr_minmax(0,460px)]">
        <div className="flex flex-col items-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-wood-700/60 bg-ink-900/90 px-3.5 py-1 text-xs font-semibold tracking-wider text-paper-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cinnabar-500" />
            CỜ TƯỚNG TRỰC TUYẾN VIỆT NAM
          </div>

          <h1 className="mt-4 text-[clamp(1.75rem,3.2vw+0.75rem,2.75rem)] font-extrabold leading-[1.2] tracking-tight text-paper-50 max-w-xl">
            Đấu cờ tướng trực tuyến chuẩn luật Việt Nam
          </h1>

          <p className="mt-3.5 max-w-lg text-sm sm:text-base leading-relaxed text-paper-300 font-normal">
            Trải nghiệm cờ tướng đậm chất truyền thống giấy dó, mực tàu, son đỏ. Chơi với máy thông minh, lập phòng thi đấu bạn bè có đồng hồ máy chủ chuẩn xác và gọi video trực tiếp.
          </p>

          {/* Nhóm nút hành động */}
          <div className="mt-7 flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Nút chính: Chơi với máy */}
            <Link
              href="/play-ai"
              className="flex min-h-[44px] items-center justify-center rounded-xl bg-cinnabar-700 hover:bg-cinnabar-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cinnabar-900/40 transition active:scale-[0.98]"
            >
              ⚔️ Chơi với máy
            </Link>

            {/* Nút phụ: Chơi online (theo trạng thái đăng nhập) */}
            {signedIn ? (
              <Link
                href="/lobby"
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-wood-700 bg-ink-900/80 px-5 py-2.5 text-sm font-semibold text-paper-200 transition hover:border-paper-400 hover:text-paper-100"
              >
                Vào Sảnh chơi online
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-wood-700 bg-ink-900/80 px-4 py-2.5 text-sm font-semibold text-paper-200 transition hover:border-paper-400 hover:text-paper-100"
                >
                  Tạo tài khoản
                </Link>
                <Link
                  href="/login"
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700/80 bg-ink-900/60 px-4 py-2.5 text-sm font-semibold text-paper-300 transition hover:border-paper-400 hover:text-paper-100"
                >
                  Đăng nhập
                </Link>
              </>
            )}

            {/* Chơi thử 2 người 1 máy */}
            <Link
              href="/practice"
              className="flex min-h-[44px] items-center px-3 py-2 text-sm font-semibold text-paper-400 transition hover:text-paper-100 hover:underline underline-offset-4"
            >
              Chơi thử 2 người 1 máy →
            </Link>
          </div>
        </div>

        {/* Bàn cờ chuyển động */}
        <div className="w-full">
          <HeroBoard />
        </div>
      </section>

      {/* Thẻ tính năng */}
      <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-12 border-t border-wood-900/60">
        <div className="mb-8">
          <h2 id="features-title" className="text-xl sm:text-2xl font-bold tracking-tight text-paper-100">
            Tinh hoa cờ tướng trong từng nước đi
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-paper-400">
            Hệ thống đầy đủ tính năng hiện đại phục vụ kỳ thủ từ tập luyện tới thi đấu đỉnh cao.
          </p>
        </div>
        <FeatureCards />
      </section>

      {/* Các bước bắt đầu */}
      <section aria-labelledby="steps-title" className="mx-auto max-w-6xl px-4 py-12 border-t border-wood-900/60">
        <div className="mb-8">
          <h2 id="steps-title" className="text-xl sm:text-2xl font-bold tracking-tight text-paper-100">
            Bắt đầu một ván đấu
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-paper-400">
            Chỉ với 3 bước đơn giản để cùng so tài trên bàn cờ tướng.
          </p>
        </div>
        <ol className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-wood-800/80 bg-ink-900/50 p-5 sm:p-6 shadow-md"
            >
              <span className="font-mono text-base font-bold text-cinnabar-500">
                0{i + 1}
              </span>
              <p className="mt-2 text-base font-bold text-paper-100">{step.title}</p>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-paper-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pt-8 border-t border-wood-900/60 text-xs text-paper-500 text-center sm:text-left">
        Xiangqi Arena · Đồ án Quản lý dự án CNTT · Tôn vinh nét đẹp cờ tướng Việt Nam
      </footer>
    </main>
  );
}
