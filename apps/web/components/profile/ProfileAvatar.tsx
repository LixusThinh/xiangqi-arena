'use client';

import { useState } from 'react';

export interface ProfileAvatarProps {
  avatarUrl?: string | null;
  displayName: string;
  username: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_STYLES: Record<'sm' | 'md' | 'lg' | 'xl', { box: string; text: string }> = {
  sm: { box: 'w-8 h-8', text: 'text-xs' },
  md: { box: 'w-12 h-12', text: 'text-base' },
  lg: { box: 'w-20 h-20', text: 'text-2xl' },
  xl: { box: 'w-24 h-24 sm:w-28 sm:h-28', text: 'text-3xl sm:text-4xl' },
};

/**
 * Avatar người chơi: hiển thị ảnh đại diện hoặc fallback chữ cái đầu (FR-04).
 * Tuyệt đối không dùng dangerouslySetInnerHTML, React tự escape text an toàn.
 */
export default function ProfileAvatar({
  avatarUrl,
  displayName,
  username,
  size = 'lg',
  className = '',
}: ProfileAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const styles = SIZE_STYLES[size];

  // Lấy chữ cái đầu của displayName hoặc username
  const trimmed = displayName.trim() || username.trim();
  const initial = trimmed ? trimmed.charAt(0).toUpperCase() : '?';

  const showImage = Boolean(avatarUrl && !hasError && avatarUrl.startsWith('https://'));

  if (showImage && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Ảnh đại diện của ${displayName}`}
        onError={() => setHasError(true)}
        className={`rounded-full object-cover border-2 border-amber-500/40 shadow-md ${styles.box} ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Ảnh đại diện của ${displayName}`}
      className={`grid place-items-center rounded-full border-2 border-amber-500/50 bg-gradient-to-br from-amber-700/40 via-amber-900/50 to-slate-900 font-extrabold text-amber-200 select-none shadow-md ${styles.box} ${styles.text} ${className}`}
    >
      <span>{initial}</span>
    </div>
  );
}
