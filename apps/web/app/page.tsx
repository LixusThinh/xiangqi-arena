'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Board from '@/components/board/Board';
import { getStoredSession, SESSION_CHANGED_EVENT } from '@/lib/auth-api';

/** Thế cờ minh họa: Pháo đầu (Pháo 2 bình 5) vừa đi, highlight nước cuối. */
const PREVIEW_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1';
const PREVIEW_LAST_MOVE = { from: 7 * 9 + 7, to: 7 * 9 + 4 };

const FEATURES = [
  {
    title: 'Luật cờ tướng Việt Nam',
    body: 'Máy chủ kiểm mọi nước đi: cản mã, ngòi pháo, lộ mặt tướng, chiếu bí, hết nước, và xử lặp nước theo Điều 23.',
  },
  {
    title: 'Đồng hồ do máy chủ tính',
    body: 'Thời gian mỗi bên được trừ trên máy chủ sau từng nước; hết giờ thì máy chủ xử thua, không phụ thuộc trình duyệt.',
  },
  {
    title: 'Gọi video trong ván',
    body: 'Bật camera và micro để nói chuyện với đối thủ ngay cạnh bàn cờ, hình và tiếng đi thẳng giữa hai máy.',
  },
  {
    title: 'Giữ ván khi rớt mạng',
    body: 'Mất kết nối vẫn có 60 giây để vào lại đúng thế cờ; mọi ván đã chơi được lưu trong Lịch sử.',
  },
] as const;

const STEPS = [
  { title: 'Tạo phòng', body: 'Chọn màu quân, thời gian (10 phút hoặc 5 phút + 2 giây/nước), công khai hay riêng tư.' },
  { title: 'Mời đối thủ', body: 'Gửi mã phòng hoặc link mời; phòng công khai hiện ngay trong Sảnh.' },
  { title: 'Vào ván', body: 'Đủ 2 người là bắt đầu: đi quân, xin hòa, xin thua, gọi video ngay trên một màn hình.' },
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
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <section className="grid items-center gap-10 py-10 md:grid-cols-[1fr_minmax(0,420px)] md:py-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">Cờ tướng trực tuyến</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-5xl">
            Đấu cờ tướng với bạn bè, ngay trên trình duyệt
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
            Tạo phòng, gửi mã cho đối thủ và vào ván trong vài giây. Máy chủ giữ luật, giữ giờ và lưu lại từng ván để bạn
            xem lại sau.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {signedIn ? (
              <Link
                href="/lobby"
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
              >
                Vào Sảnh chơi online
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
                >
                  Tạo tài khoản
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-400/60 hover:text-amber-200"
                >
                  Đăng nhập
                </Link>
              </>
            )}
            <Link
              href="/practice"
              className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-300 underline-offset-4 transition hover:text-amber-200 hover:underline"
            >
              Chơi thử 2 người 1 máy →
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[420px]" aria-hidden="true">
          <Board fen={PREVIEW_FEN} lastMove={PREVIEW_LAST_MOVE} className="pointer-events-none" />
        </div>
      </section>

      <section aria-labelledby="features-title" className="border-t border-slate-800 py-12">
        <h2 id="features-title" className="text-2xl font-bold text-slate-50">
          Có gì trong Xiangqi Arena
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-l-2 border-amber-400/60 pl-4">
              <dt className="font-semibold text-slate-100">{f.title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="steps-title" className="border-t border-slate-800 py-12">
        <h2 id="steps-title" className="text-2xl font-bold text-slate-50">
          Bắt đầu một ván
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <span className="font-mono text-sm font-bold text-amber-300">0{i + 1}</span>
              <p className="mt-2 font-semibold text-slate-100">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500">
        Xiangqi Arena · Đồ án Quản lý dự án CNTT
      </footer>
    </main>
  );
}
