'use client';

import React, { useEffect, useState } from 'react';
import { adminApi, type AdminDashboardData } from '@/lib/admin-api';

export default function AdminDashboardTab() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getDashboard()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Không thể tải số liệu bảng điều khiển.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-400">Đang tải số liệu tổng quan…</div>;
  }
  if (error || !data) {
    return <div className="py-8 text-center text-sm text-rose-300">{error ?? 'Lỗi tải dữ liệu.'}</div>;
  }

  const cards = [
    { title: 'Tổng người dùng', value: data.totalUsers, icon: '👥', color: 'border-slate-800 text-slate-100' },
    { title: 'Tổng ván đấu', value: data.totalMatches, icon: '⚔️', color: 'border-slate-800 text-slate-100' },
    { title: 'Ván đấu hôm nay', value: data.todayMatches, icon: '📅', color: 'border-amber-500/30 text-amber-300' },
    { title: 'Báo cáo đang chờ (OPEN)', value: data.openReports, icon: '🚩', color: data.openReports > 0 ? 'border-rose-500/40 text-rose-300' : 'border-slate-800 text-slate-100' },
    { title: 'Kỳ thủ đang online', value: data.onlineUsers, icon: '🟢', color: 'border-emerald-500/30 text-emerald-300' },
  ];

  return (
    <div data-testid="admin-dashboard-tab" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.title}
          className={`flex items-center gap-4 rounded-2xl border bg-slate-900/60 p-5 shadow-lg backdrop-blur ${c.color}`}
        >
          <span className="text-3xl">{c.icon}</span>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">{c.title}</p>
            <p className="mt-1 text-2xl font-extrabold">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
