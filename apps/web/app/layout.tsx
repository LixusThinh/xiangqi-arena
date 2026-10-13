import type { Metadata } from 'next';
import './globals.css';

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
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
