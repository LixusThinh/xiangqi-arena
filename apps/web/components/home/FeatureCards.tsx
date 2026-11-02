'use client';

import React from 'react';

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export const FEATURES: FeatureItem[] = [
  {
    id: 'ai',
    title: 'Chơi với máy 3 mức',
    description:
      'Luyện tập mọi lúc không cần mạng hay đăng nhập. Động cơ Minimax + Alpha-Beta 3 cấp độ Dễ, Trung bình, Khó chạy mượt mà trên Web Worker.',
    icon: (
      <svg
        className="w-6 h-6 text-cinnabar-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693l-1.57-.393m15.6 0l1.19 4.76a1.5 1.5 0 01-1.455 1.864H4.465a1.5 1.5 0 01-1.455-1.864l1.19-4.76"
        />
      </svg>
    ),
  },
  {
    id: 'rules',
    title: 'Luật cờ tướng Việt Nam & Điều 23',
    description:
      'Máy chủ kiểm tra toàn bộ nước đi: cản Mã, ngòi Pháo, lộ mặt Tướng, chiếu bí, hết nước đi, và tự động xử thua/hòa lặp nước theo Điều 23.',
    icon: (
      <svg
        className="w-6 h-6 text-paper-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
  {
    id: 'clock',
    title: 'Đồng hồ do máy chủ tính',
    description:
      'Thời gian mỗi bên được quản lý chặt chẽ trên máy chủ sau từng nước đi; hết giờ máy chủ tự động xử thua, hoàn toàn độc lập với thiết bị người chơi.',
    icon: (
      <svg
        className="w-6 h-6 text-wood-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: 'video',
    title: 'Gọi video trong ván',
    description:
      'Bật camera và micro để đàm đạo trực tiếp với đối thủ ngay cạnh bàn cờ qua kết nối WebRTC bảo mật, chất lượng cao.',
    icon: (
      <svg
        className="w-6 h-6 text-cinnabar-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    id: 'history',
    title: 'Lịch sử & xem lại ván đấu',
    description:
      'Lưu trữ từng thế cờ và biên bản nước đi. Hỗ trợ xem lại ván đấu từng nước với ký hiệu tiếng Việt chuẩn xác (Pháo 2 bình 5, Mã 8 tấn 7...).',
    icon: (
      <svg
        className="w-6 h-6 text-paper-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
  },
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {FEATURES.map((f) => (
        <div
          key={f.id}
          className="flex flex-col justify-between rounded-2xl border border-wood-800/80 bg-ink-900/60 p-5 sm:p-6 transition hover:border-cinnabar-700/60 hover:bg-ink-900/90 shadow-lg"
        >
          <div>
            <div className="mb-4 inline-flex items-center justify-center rounded-xl border border-wood-700/60 bg-ink-950 p-2.5 shadow-inner">
              {f.icon}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-paper-100">
              {f.title}
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-paper-400">
              {f.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
