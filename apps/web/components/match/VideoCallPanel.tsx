'use client';

import { useEffect, useRef } from 'react';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended';

export interface VideoCallPanelProps {
  opponentName: string;
  selfName: string;
  status: CallStatus;
  micOn: boolean;
  camOn: boolean;
  /** Luồng video thật (WebRTC – XQA-124). Chưa có thì hiện chữ viết tắt tên. */
  opponentStream?: MediaStream | null;
  localStream?: MediaStream | null;
  /** Lỗi gần nhất (không mở được camera, đối thủ từ chối…) để hiện dưới khung. */
  error?: string | null;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEndCall: () => void;
  onStartCall?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  className?: string;
  /** Class kích thước khung video lớn (mặc định 16:9 theo bề ngang cột). */
  videoClassName?: string;
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Chưa gọi',
  calling: 'Đang gọi…',
  incoming: 'Đối thủ đang gọi',
  connecting: 'Đang kết nối…',
  connected: 'Đang trò chuyện',
  ended: 'Cuộc gọi đã kết thúc',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function VideoTile({
  name,
  stream,
  camOn,
  muted,
  testId,
  small = false,
  sizeClassName = 'aspect-video w-full',
}: {
  name: string;
  stream?: MediaStream | null;
  camOn: boolean;
  muted: boolean;
  testId: string;
  small?: boolean;
  sizeClassName?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const showVideo = !!stream && camOn;
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream, showVideo]);

  return (
    <div
      data-testid={testId}
      className={`relative overflow-hidden rounded-xl bg-slate-800 ${small ? 'h-full w-full' : sizeClassName}`}
    >
      {/* Luôn giữ thẻ video khi có stream để tiếng của đối thủ vẫn phát lúc họ tắt cam */}
      {stream && (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={showVideo ? 'h-full w-full object-cover' : 'hidden'}
        />
      )}
      {!showVideo && (
        <div className="grid h-full w-full place-items-center">
          <span
            aria-hidden="true"
            className={`grid place-items-center rounded-full bg-slate-600 font-bold text-slate-100 ${small ? 'h-8 w-8 text-xs' : 'h-14 w-14 text-lg'}`}
          >
            {initials(name)}
          </span>
        </div>
      )}
      <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {name}
        {!camOn ? ' · tắt cam' : ''}
      </span>
    </div>
  );
}

/**
 * Khung video call 2 người trong màn ván: video đối thủ lớn, video của mình thu nhỏ ở góc,
 * nút mic / cam / gọi / kết thúc; cuộc gọi đến có nút Nhận / Từ chối. Rộng theo cột chứa nó
 * (không đặt fixed / absolute ra ngoài cột) nên không che bàn cờ.
 */
export default function VideoCallPanel({
  opponentName,
  selfName,
  status,
  micOn,
  camOn,
  opponentStream = null,
  localStream = null,
  error = null,
  onToggleMic,
  onToggleCam,
  onEndCall,
  onStartCall,
  onAccept,
  onDecline,
  className = '',
  videoClassName,
}: VideoCallPanelProps) {
  const inCall = status === 'calling' || status === 'connecting' || status === 'connected';
  const control =
    'min-h-[40px] sm:min-h-0 inline-flex items-center justify-center rounded-full px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <section aria-label="Gọi video" className={`rounded-2xl border border-slate-800 bg-slate-900/40 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Gọi video</h3>
        <span
          data-testid="call-status"
          className={`text-[11px] ${status === 'connected' ? 'text-emerald-300' : status === 'incoming' ? 'text-amber-300' : 'text-slate-400'}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="relative">
        <VideoTile
          name={opponentName}
          stream={opponentStream}
          camOn
          testId="video-opponent"
          muted={false}
          sizeClassName={videoClassName}
        />
        <div className="absolute bottom-2 right-2 h-[30%] w-[32%] rounded-xl ring-2 ring-slate-950">
          <VideoTile name={selfName} stream={localStream} camOn={camOn} testId="video-self" muted small />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-rose-500/10 px-2 py-1.5 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
        {status === 'incoming' ? (
          <>
            <button
              type="button"
              onClick={onAccept}
              className={`${control} bg-emerald-500 text-slate-950 hover:bg-emerald-400`}
            >
              Nhận cuộc gọi
            </button>
            <button
              type="button"
              onClick={onDecline}
              className={`${control} border border-slate-700 text-slate-300 hover:border-rose-400/60 hover:text-rose-300`}
            >
              Từ chối
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={!micOn}
              aria-label={micOn ? 'Tắt mic' : 'Bật mic'}
              onClick={onToggleMic}
              disabled={!inCall}
              className={`${control} ${micOn ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-rose-500/20 text-rose-300'}`}
            >
              {micOn ? '🎙️ Mic' : '🔇 Mic tắt'}
            </button>
            <button
              type="button"
              aria-pressed={!camOn}
              aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
              onClick={onToggleCam}
              disabled={!inCall}
              className={`${control} ${camOn ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-rose-500/20 text-rose-300'}`}
            >
              {camOn ? '📷 Cam' : '🚫 Cam tắt'}
            </button>
            {inCall ? (
              <button type="button" onClick={onEndCall} className={`${control} bg-rose-600 text-white hover:bg-rose-500`}>
                Kết thúc
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartCall}
                disabled={!onStartCall}
                className={`${control} bg-emerald-500 text-slate-950 hover:bg-emerald-400`}
              >
                Gọi
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
