'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConnection, PlayerColor, WebrtcSignal, WebrtcSignalKind } from './game-socket';

/**
 * Video call 2 người trong ván (XQA-124, Story XQA-32) bằng WebRTC.
 *
 * - Tín hiệu (call / accept / decline / offer / answer / ice / hangup) đi qua Socket.IO của ván:
 *   server chỉ chuyển tiếp cho đối thủ. Hình + tiếng đi thẳng giữa 2 trình duyệt.
 * - Luồng: A bấm Gọi → A gửi `call` → B thấy "cuộc gọi đến" → B Nhận → B gửi `accept`
 *   → A tạo offer → B trả answer → 2 bên trao ICE. Chỉ người gọi tạo offer nên không bị "glare";
 *   nếu 2 bên bấm Gọi cùng lúc thì bên Đỏ làm người gọi, bên Đen tự nhận.
 * - Máy chủ STUN/TURN: biến NEXT_PUBLIC_ICE_SERVERS (JSON mảng RTCIceServer). Mặc định chỉ STUN miễn phí
 *   của Google: chạy được khi 2 máy cùng mạng / mạng nhà; mạng chặn kết nối thẳng (wifi trường, 4G)
 *   cần thêm TURN (XQA-125).
 */

export type CallPhase = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export function iceServersFromEnv(raw = process.env.NEXT_PUBLIC_ICE_SERVERS): RTCIceServer[] {
  if (!raw?.trim()) return DEFAULT_ICE_SERVERS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as RTCIceServer[]) : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export const CALL_ERROR_MESSAGES = {
  media: 'Không mở được camera / micro. Hãy cho phép trình duyệt dùng camera và micro rồi thử lại.',
  unsupported: 'Trình duyệt này không hỗ trợ gọi video.',
  opponentAway: 'Đối thủ chưa mở màn ván nên chưa gọi được.',
  declined: 'Đối thủ đã từ chối cuộc gọi.',
  failed: 'Không kết nối được cuộc gọi (mạng có thể chặn kết nối trực tiếp).',
  signal: 'Mất kết nối máy chủ, không gửi được tín hiệu gọi.',
} as const;

export interface VideoCall {
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  error: string | null;
  start: () => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
}

export function useVideoCall(
  conn: GameConnection | null,
  matchId: string | null,
  myColor: PlayerColor | null,
): VideoCall {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<CallPhase>('idle');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const ctx = useRef({ conn, matchId, myColor });
  ctx.current = { conn, matchId, myColor };

  const go = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const send = useCallback(async (kind: WebrtcSignalKind, data?: unknown): Promise<number> => {
    const { conn: c, matchId: id } = ctx.current;
    if (!c || !id) return 0;
    const ack = await c.signal(id, kind, data);
    return ack.delivered;
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingIce.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setMicOn(true);
    setCamOn(true);
  }, []);

  const end = useCallback(
    (message: string | null = null) => {
      cleanup();
      setError(message);
      go('ended');
    },
    [cleanup, go],
  );

  /** Mở camera + micro; không có camera thì thử chỉ micro. */
  const openMedia = useCallback(async (): Promise<MediaStream> => {
    if (localRef.current) return localRef.current;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error(CALL_ERROR_MESSAGES.unsupported);
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setCamOn(false);
      } catch {
        throw new Error(CALL_ERROR_MESSAGES.media);
      }
    }
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeer = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      pcRef.current?.close();
      const pc = new RTCPeerConnection({ iceServers: iceServersFromEnv() });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) void send('ice', event.candidate.toJSON()).catch(() => undefined);
      };
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
      };
      pc.onconnectionstatechange = () => {
        if (pc !== pcRef.current) return;
        if (pc.connectionState === 'connected') go('connected');
        if (pc.connectionState === 'failed') end(CALL_ERROR_MESSAGES.failed);
      };
      pcRef.current = pc;
      return pc;
    },
    [end, go, send],
  );

  const flushIce = useCallback(async (pc: RTCPeerConnection) => {
    for (const candidate of pendingIce.current.splice(0)) {
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }, []);

  /** Người gọi: đối thủ đã nhận → tạo offer. */
  const makeOffer = useCallback(async () => {
    const stream = await openMedia();
    const pc = createPeer(stream);
    go('connecting');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send('offer', pc.localDescription?.toJSON() ?? offer);
  }, [createPeer, go, openMedia, send]);

  const accept = useCallback(async () => {
    setError(null);
    try {
      const stream = await openMedia();
      createPeer(stream);
      go('connecting');
      await send('accept');
    } catch (err) {
      void send('decline').catch(() => undefined);
      end(err instanceof Error ? err.message : CALL_ERROR_MESSAGES.media);
    }
  }, [createPeer, end, go, openMedia, send]);

  const handleSignal = useCallback(
    async (signal: WebrtcSignal) => {
      if (signal.matchId !== ctx.current.matchId) return;
      const current = phaseRef.current;
      switch (signal.kind) {
        case 'call':
          if (current === 'idle' || current === 'ended') {
            setError(null);
            go('incoming');
          } else if (current === 'calling' && ctx.current.myColor === 'BLACK') {
            // Hai bên cùng bấm Gọi: Đỏ làm người gọi, Đen tự nhận
            await accept();
          }
          return;
        case 'accept':
          if (current === 'calling') await makeOffer().catch(() => end(CALL_ERROR_MESSAGES.failed));
          return;
        case 'offer': {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          await flushIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await send('answer', pc.localDescription?.toJSON() ?? answer);
          return;
        }
        case 'answer': {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          await flushIce(pc);
          return;
        }
        case 'ice': {
          const candidate = signal.data as RTCIceCandidateInit;
          const pc = pcRef.current;
          if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => undefined);
          else pendingIce.current.push(candidate);
          return;
        }
        case 'decline':
          if (current === 'calling') end(CALL_ERROR_MESSAGES.declined);
          return;
        case 'hangup':
          if (current !== 'idle' && current !== 'ended') end(null);
          return;
      }
    },
    [accept, end, flushIce, go, makeOffer, send],
  );

  // Đăng ký nhận tín hiệu 1 lần cho mỗi kết nối; handler mới nhất đọc qua ref
  const handlerRef = useRef(handleSignal);
  handlerRef.current = handleSignal;
  useEffect(() => {
    if (!conn) return;
    conn.onSignal((signal) => {
      void handlerRef.current(signal).catch(() => end(CALL_ERROR_MESSAGES.failed));
    });
  }, [conn, end]);

  // Rời màn ván → báo đối thủ và tắt camera
  useEffect(
    () => () => {
      if (phaseRef.current !== 'idle' && phaseRef.current !== 'ended') {
        void send('hangup').catch(() => undefined);
      }
      cleanup();
    },
    [cleanup, send],
  );

  const start = useCallback(async () => {
    setError(null);
    try {
      await openMedia();
      go('calling');
      const delivered = await send('call');
      if (delivered === 0) {
        cleanup();
        setError(CALL_ERROR_MESSAGES.opponentAway);
        go('idle');
      }
    } catch (err) {
      cleanup();
      setError(err instanceof Error && err.message ? err.message : CALL_ERROR_MESSAGES.signal);
      go('idle');
    }
  }, [cleanup, go, openMedia, send]);

  const decline = useCallback(() => {
    void send('decline').catch(() => undefined);
    go('idle');
  }, [go, send]);

  const hangup = useCallback(() => {
    void send('hangup').catch(() => undefined);
    end(null);
  }, [end, send]);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const next = !camOn;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, [camOn]);

  return { phase, localStream, remoteStream, micOn, camOn, error, start, accept, decline, hangup, toggleMic, toggleCam };
}
