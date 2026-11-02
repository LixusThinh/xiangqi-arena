'use client';

import React, { useEffect, useState } from 'react';
import { getStoredSession, SESSION_CHANGED_EVENT, type AuthUser } from '@/lib/auth-api';
import AdminDashboardTab from './AdminDashboardTab';
import AdminUsersTab from './AdminUsersTab';
import AdminMatchesTab from './AdminMatchesTab';
import AdminReportsTab from './AdminReportsTab';

type TabKey = 'dashboard' | 'users' | 'matches' | 'reports';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Tổng quan', icon: '📊' },
  { key: 'users', label: 'Người dùng', icon: '👥' },
  { key: 'matches', label: 'Ván đấu', icon: '⚔️' },
  { key: 'reports', label: 'Báo cáo', icon: '🚩' },
];

export default function AdminView() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  useEffect(() => {
    const sync = () => {
      setUser(getStoredSession()?.user ?? null);
      setMounted(true);
    };
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!mounted) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100">
        <div className="py-12 text-center text-sm text-slate-400">Đang kiểm tra quyền truy cập…</div>
      </main>
    );
  }

  // AC-31-02: Chưa đăng nhập hoặc role !== 'ADMIN'
  if (!user || user.role !== 'ADMIN') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-12 text-slate-100">
        <div
          data-testid="admin-forbidden-message"
          className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-xl backdrop-blur"
        >
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-500/20 text-2xl text-rose-400">
            🚫
          </div>
          <h1 className="text-xl font-bold text-rose-300">Từ chối truy cập</h1>
          <p className="mt-2 text-sm text-slate-300">Bạn không có quyền vào trang này.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 text-slate-100 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-amber-300 sm:text-3xl">
              Quản trị hệ thống
            </h1>
            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              ADMIN
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Giám sát số liệu, quản lý người chơi, lịch sử ván đấu và xử lý báo cáo vi phạm.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          Đăng nhập với tư cách: <span className="font-semibold text-slate-200">{user.displayName}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex overflow-x-auto border-b border-slate-800">
        <div className="flex gap-2 pb-px">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                data-testid={`admin-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-t-xl border-t border-x px-4 py-2.5 text-xs font-bold transition ${
                  isActive
                    ? 'border-slate-800 bg-slate-900/90 text-amber-300 shadow'
                    : 'border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && <AdminDashboardTab />}
        {activeTab === 'users' && <AdminUsersTab currentUserId={user.id} />}
        {activeTab === 'matches' && <AdminMatchesTab />}
        {activeTab === 'reports' && <AdminReportsTab />}
      </div>
    </main>
  );
}
