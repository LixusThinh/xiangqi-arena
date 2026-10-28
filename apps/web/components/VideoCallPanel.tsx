'use client';

import { useEffect, useRef } from 'react';

export type CallStatus = 'idle' | 'calling' | 'connected' | 'ended';

export interface VideoCallPanelProps {
  opponentName: string;
  selfName: string;
  status: CallStatus;
  micOn: boolean;
  camOn: boolean;
  /** Luồng video thật (WebRTC – XQA-125). Chưa có thì hiện ảnh đại diện (dữ liệu giả). */
  opponentStream?: MediaStream | null;
  localStream?: MediaStream | null;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEndCall: () => void;
  onStartCall?: () => void;
  className?: string;
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Chưa gọi',
  calling: 'Đang gọi…',
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
}: {
  name: string;
  stream?: MediaStream | null;
  camOn: boolean;
  muted: boolean;
  testId: string;
  small?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const showVideo = !!stream && camOn;
  return (
    <div
      data-testid={testId}
      className={`relative overflow-hidden rounded-xl bg-stone-800 ${small ? 'h-full w-full' : 'aspect-video w-full'}`}
    >
      {showVideo ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <span
            aria-hidden="true"
            className={`grid place-items-center rounded-full bg-emerald-700 font-bold text-white ${small ? 'h-8 w-8 text-xs' : 'h-14 w-14 text-lg'}`}
          >
            {initials(name)}
          </span>
        </div>
      )}
      <span className="absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
        {name}
        {!camOn ? ' · tắt cam' : ''}
      </span>
    </div>
  );
}

/**
 * Khung video call 2 người trong màn ván (XQA-107, dữ liệu giả): video đối thủ lớn, video của mình
 * thu nhỏ ở góc, nút mic / cam / kết thúc. Rộng theo cột chứa nó (không đặt fixed / absolute ra ngoài cột)
 * nên không che bàn cờ ở 1366×768. WebRTC thật thuộc XQA-125.
 */
export default function VideoCallPanel({
  opponentName,
  selfName,
  status,
  micOn,
  camOn,
  opponentStream = null,
  localStream = null,
  onToggleMic,
  onToggleCam,
  onEndCall,
  onStartCall,
  className = '',
}: VideoCallPanelProps) {
  const inCall = status === 'calling' || status === 'connected';
  return (
    <section
      aria-label="Gọi video"
      className={`rounded-2xl border border-stone-200 bg-white p-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Gọi video</h3>
        <span data-testid="call-status" className="text-[11px] text-stone-500">
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="relative">
        <VideoTile name={opponentName} stream={opponentStream} camOn testId="video-opponent" muted={false} />
        <div className="absolute bottom-2 right-2 h-[30%] w-[32%] rounded-xl ring-2 ring-white">
          <VideoTile name={selfName} stream={localStream} camOn={camOn} testId="video-self" muted small />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-pressed={!micOn}
          aria-label={micOn ? 'Tắt mic' : 'Bật mic'}
          onClick={onToggleMic}
          disabled={!inCall}
          className={`rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-40 ${micOn ? 'bg-stone-100 text-stone-700' : 'bg-rose-100 text-rose-700'}`}
        >
          {micOn ? '🎙️ Mic' : '🔇 Mic tắt'}
        </button>
        <button
          type="button"
          aria-pressed={!camOn}
          aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
          onClick={onToggleCam}
          disabled={!inCall}
          className={`rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-40 ${camOn ? 'bg-stone-100 text-stone-700' : 'bg-rose-100 text-rose-700'}`}
        >
          {camOn ? '📷 Cam' : '🚫 Cam tắt'}
        </button>
        {inCall ? (
          <button
            type="button"
            onClick={onEndCall}
            className="rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Kết thúc
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartCall}
            disabled={!onStartCall}
            className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            Gọi
          </button>
        )}
      </div>
    </section>
  );
}
