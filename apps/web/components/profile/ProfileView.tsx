'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthApiError, getStoredSession } from '@/lib/auth-api';
import { getProfile, updateProfile, type UserProfileResponse } from '@/lib/profile-api';
import ProfileAvatar from './ProfileAvatar';

export interface ProfileViewProps {
  /** Nếu truyền username thì xem hồ sơ của username đó; nếu không thì xem hồ sơ của chính mình */
  username?: string;
}

function formatJoinDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

export default function ProfileView({ username: targetUsername }: ProfileViewProps) {
  const [sessionUser, setSessionUser] = useState(() => getStoredSession()?.user ?? null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chế độ chỉnh sửa (chỉ khả dụng khi là hồ sơ của chính mình)
  const [isEditing, setIsEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Xác định username cần tải
  const effectiveUsername = targetUsername || sessionUser?.username;
  const isOwnProfile = Boolean(
    sessionUser && (!targetUsername || sessionUser.username === targetUsername),
  );

  useEffect(() => {
    const syncSession = () => setSessionUser(getStoredSession()?.user ?? null);
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  useEffect(() => {
    if (!effectiveUsername) {
      setLoading(false);
      setLoadError('Không tìm thấy thông tin tài khoản.');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    getProfile(effectiveUsername)
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setDisplayNameInput(data.displayName);
        setBioInput(data.bio ?? '');
        setAvatarUrlInput(data.avatarUrl ?? '');
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof AuthApiError && err.code === 'USER_NOT_FOUND') {
          setLoadError(`Không tìm thấy người chơi '${effectiveUsername}'.`);
        } else {
          setLoadError(err instanceof Error ? err.message : 'Không thể tải hồ sơ người chơi.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveUsername]);

  const handleStartEdit = () => {
    if (!profile) return;
    setDisplayNameInput(profile.displayName);
    setBioInput(profile.bio ?? '');
    setAvatarUrlInput(profile.avatarUrl ?? '');
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!profile) return;
    setDisplayNameInput(profile.displayName);
    setBioInput(profile.bio ?? '');
    setAvatarUrlInput(profile.avatarUrl ?? '');
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    const trimmedName = displayNameInput.trim();
    if (trimmedName.length < 1 || trimmedName.length > 80) {
      setSaveError('Tên hiển thị phải từ 1 đến 80 ký tự sau khi bỏ khoảng trắng thừa.');
      return;
    }

    if (bioInput.length > 500) {
      setSaveError('Tiểu sử không được vượt quá 500 ký tự.');
      return;
    }

    const trimmedAvatar = avatarUrlInput.trim();
    if (trimmedAvatar !== '') {
      if (!trimmedAvatar.startsWith('https://')) {
        setSaveError('Đường dẫn ảnh đại diện phải bắt đầu bằng https://');
        return;
      }
      if (trimmedAvatar.length > 2048) {
        setSaveError('Đường dẫn ảnh đại diện không được vượt quá 2048 ký tự.');
        return;
      }
    }

    try {
      setSaving(true);
      const res = await updateProfile({
        displayName: trimmedName,
        bio: bioInput,
        avatarUrl: trimmedAvatar,
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: res.displayName,
              bio: res.bio,
              avatarUrl: res.avatarUrl,
            }
          : null,
      );

      // Cập nhật state sessionUser nếu tên thay đổi
      if (sessionUser && sessionUser.displayName !== res.displayName) {
        setSessionUser({
          ...sessionUser,
          displayName: res.displayName,
        });
      }

      setSaveSuccess('Đã cập nhật thông tin hồ sơ thành công!');
      setIsEditing(false);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setSaveError(err.message);
      } else {
        setSaveError(err instanceof Error ? err.message : 'Lỗi khi lưu thông tin.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center text-slate-400 py-16">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-400 mb-4" />
          <p>Đang tải thông tin hồ sơ…</p>
        </div>
      </main>
    );
  }

  if (loadError || !profile) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Không tìm thấy hồ sơ</h1>
          <p className="text-sm text-slate-400 mb-6">{loadError ?? 'Hồ sơ người chơi không tồn tại.'}</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition"
            >
              Về trang chủ
            </Link>
            <Link
              href="/lobby"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              Vào sảnh chơi
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-slate-950 px-4 py-6 sm:py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Thông báo thành công */}
        {saveSuccess && (
          <div
            role="status"
            className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          >
            <span>{saveSuccess}</span>
            <button
              type="button"
              onClick={() => setSaveSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200"
              aria-label="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Card hồ sơ chính */}
        <section
          aria-label="Thông tin cá nhân"
          className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 sm:p-8 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Avatar */}
            <div className="shrink-0 flex justify-center sm:justify-start">
              <ProfileAvatar
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName}
                username={profile.username}
                size="xl"
              />
            </div>

            {/* Chi tiết thông tin */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 truncate">
                    {profile.displayName}
                  </h1>
                  <p className="text-sm font-medium text-slate-400">@{profile.username}</p>
                </div>

                {isOwnProfile && !isEditing && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition self-center sm:self-auto"
                  >
                    Chỉnh sửa hồ sơ
                  </button>
                )}
              </div>

              {/* Thông tin bổ sung */}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-300">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {profile.rating} ELO
                </span>

                <span className="inline-flex items-center gap-1 text-slate-400">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Tham gia: {formatJoinDate(profile.createdAt)}
                </span>
              </div>

              {/* Bio (chỉ hiển thị khi không sửa) */}
              {!isEditing && (
                <div className="mt-4 pt-4 border-t border-slate-800/80">
                  {profile.bio ? (
                    <p className="text-sm text-slate-300 whitespace-pre-line break-words leading-relaxed">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-500">Chưa có giới thiệu bản thân.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form chỉnh sửa nếu đang ở chế độ edit */}
          {isEditing && (
            <form onSubmit={handleSave} className="mt-6 pt-6 border-t border-slate-800 space-y-4">
              <h2 className="text-base font-bold text-amber-200">Chỉnh sửa thông tin cá nhân</h2>

              {saveError && (
                <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {saveError}
                </div>
              )}

              <div>
                <label htmlFor="displayName" className="block text-xs font-semibold text-slate-300 mb-1">
                  Tên hiển thị <span className="text-rose-400">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  maxLength={80}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Nhập tên hiển thị của bạn"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Từ 1 đến 80 ký tự</span>
                  <span>{displayNameInput.trim().length}/80</span>
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-xs font-semibold text-slate-300 mb-1">
                  Giới thiệu bản thân
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  maxLength={500}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Vài dòng chia sẻ về lối chơi, sở thích cờ tướng…"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Tối đa 500 ký tự (được để trống)</span>
                  <span>{bioInput.length}/500</span>
                </div>
              </div>

              <div>
                <label htmlFor="avatarUrl" className="block text-xs font-semibold text-slate-300 mb-1">
                  Đường dẫn ảnh đại diện (URL)
                </label>
                <input
                  id="avatarUrl"
                  type="url"
                  maxLength={2048}
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Phải bắt đầu bằng <code className="text-amber-400">https://</code> hoặc để trống để dùng chữ cái đầu.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition"
                >
                  {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCancelEdit}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Thống kê chiến tích */}
        <section aria-label="Thống kê thi đấu" className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-200">Thống kê chiến tích</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-slate-100">{profile.totalMatches}</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Tổng số ván</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">{profile.wins}</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Thắng</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-rose-400">{profile.losses}</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Thua</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-slate-400">{profile.draws}</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Hòa</div>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-amber-300">{profile.winRate}%</div>
              <div className="text-xs font-medium text-amber-200/80 mt-1">Tỉ lệ thắng</div>
            </div>
          </div>
        </section>

        {/* Lối tắt điều hướng */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <Link
              href="/lobby"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:border-amber-400/50 hover:text-amber-200 transition"
            >
              ← Về sảnh chờ
            </Link>
            <Link
              href="/history"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:border-amber-400/50 hover:text-amber-200 transition"
            >
              Lịch sử đấu
            </Link>
          </div>

          <Link
            href={`/u/${profile.username}`}
            className="text-xs text-slate-400 hover:text-amber-300 transition"
          >
            Đường dẫn công khai: /u/{profile.username}
          </Link>
        </div>
      </div>
    </main>
  );
}
