'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import { adminApi, type AdminUserItem } from '@/lib/admin-api';

export default function AdminUsersTab({ currentUserId }: { currentUserId?: string | null }) {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<AdminUserItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(
    async (currentPage = page, searchQuery = search) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApi.getUsers({
          page: currentPage,
          q: searchQuery.trim() || undefined,
        });
        setUsers(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        setError((err as Error).message || 'Không thể tải danh sách người dùng.');
      } finally {
        setLoading(false);
      }
    },
    [page, search],
  );

  useEffect(() => {
    void fetchUsers(page, search);
  }, [page, fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchUsers(1, search);
  };

  const handleConfirmAction = async () => {
    if (!actionTarget) return;
    const newStatus = actionTarget.accountStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    setActionLoading(true);
    setError(null);
    try {
      const updated = await adminApi.updateUserStatus(actionTarget.id, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setActionTarget(null);
    } catch (err) {
      setError((err as Error).message || 'Thao tác cập nhật trạng thái thất bại.');
      setActionTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div data-testid="admin-users-tab" className="flex flex-col gap-4">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo username, tên hiển thị hoặc email…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
        >
          Tìm kiếm
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Tài khoản</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3 text-right">Rating</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Đang tải danh sách người dùng…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Không tìm thấy người dùng nào.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = currentUserId === u.id;
                const isAdmin = u.role === 'ADMIN';
                const canLock = !isSelf && !isAdmin;

                return (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{u.displayName}</div>
                      <div className="text-[10px] text-slate-500">@{u.username}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-400">{u.rating}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          u.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {u.accountStatus === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.accountStatus === 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={!canLock || actionLoading}
                          onClick={() => setActionTarget(u)}
                          title={
                            isSelf
                              ? 'Không thể tự khóa tài khoản của chính mình'
                              : isAdmin
                                ? 'Không thể khóa tài khoản quản trị viên khác'
                                : 'Khóa tài khoản'
                          }
                          className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Khóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setActionTarget(u)}
                          className="rounded-lg border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
                        >
                          Mở khóa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-slate-400">
            Trang {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={actionTarget !== null}
        title={actionTarget?.accountStatus === 'ACTIVE' ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
        message={
          actionTarget?.accountStatus === 'ACTIVE'
            ? `Bạn có chắc muốn khóa tài khoản "${actionTarget?.username}"? Toàn bộ phiên đăng nhập của người này sẽ bị thu hồi và họ không thể đăng nhập cho tới khi được mở khóa.`
            : `Bạn có chắc muốn mở khóa tài khoản "${actionTarget?.username}"? Người này sẽ có thể đăng nhập lại vào hệ thống.`
        }
        confirmText={actionTarget?.accountStatus === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
        cancelText="Hủy"
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setActionTarget(null)}
      />
    </div>
  );
}
