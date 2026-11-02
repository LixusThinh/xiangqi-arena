import type { Metadata } from 'next';
import './globals.css';
import AuthGuard from '@/components/auth/AuthGuard';
import AppHeader from '@/components/layout/AppHeader';

export const metadata: Metadata = {
  title: 'Xiangqi Arena – Cờ tướng trực tuyến',
  description: 'Chơi cờ tướng trực tuyến: tạo phòng, mời bạn, đồng hồ do máy chủ tính, gọi video trong ván.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AppHeader />
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
