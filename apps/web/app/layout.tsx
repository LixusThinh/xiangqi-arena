import type { Metadata } from 'next';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'Xiangqi Arena - Chinese Chess',
  description: 'Online Chinese Chess platform with real-time gameplay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
