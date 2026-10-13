'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Side } from '@xiangqi-arena/xiangqi-core';

export interface PlayerCardProps {
  name: string;
  title: string;
  side: Side;
  timeRemaining: number;
  isActive: boolean;
  isLocalPlayer?: boolean;
  className?: string;
}

export default function PlayerCard({
  name,
  title,
  side,
  timeRemaining,
  isActive,
  isLocalPlayer = false,
  className = '',
}: PlayerCardProps) {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const toggleCamera = async () => {
    if (isCameraOn) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsCameraOn(false);
      setCameraError(null);
    } else {
      try {
        setCameraError(null);
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setIsCameraOn(true);
        } else {
          setCameraError('Thiết bị không hỗ trợ');
        }
      } catch {
        setCameraError('Không có camera');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isCameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOn]);

  const formattedTime =
    timeRemaining <= 0
      ? '00:00'
      : `00:${timeRemaining.toString().padStart(2, '0')}`;

  const isLowTime = timeRemaining <= 10 && timeRemaining > 0;
  const isTimeOut = timeRemaining <= 0;

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
        isActive
          ? 'bg-slate-800/95 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
          : 'bg-slate-800/70 border-slate-700/70 opacity-90'
      } ${className}`}
    >
      {/* Khung Video / Avatar */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 flex items-center justify-center">
        {isCameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
            <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
              {side === 'r' ? '🔴' : '⚫'}
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {isLocalPlayer ? (cameraError ? cameraError : 'Webcam tắt') : 'Kỳ thủ trực tuyến'}
            </span>
          </div>
        )}

        {/* Nút Bật/Tắt Camera cho người chơi */}
        {isLocalPlayer && (
          <button
            type="button"
            onClick={toggleCamera}
            className={`absolute bottom-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide transition-all backdrop-blur ${
              isCameraOn
                ? 'bg-red-600/80 hover:bg-red-500 text-white'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600'
            }`}
          >
            {isCameraOn ? '📹 Tắt Camera' : '📷 Bật Camera'}
          </button>
        )}
      </div>

      {/* Thông tin người chơi & Đồng hồ 60s */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                side === 'r' ? 'bg-red-500 shadow-sm shadow-red-500' : 'bg-slate-300'
              }`}
            />
            <h4 className="text-xs font-bold text-slate-100 truncate">{name}</h4>
          </div>
          <span className="text-[11px] text-slate-400 truncate">{title}</span>
          <span className="text-[10px] text-slate-400">
            {side === 'r' ? 'Phe Đỏ' : 'Phe Đen'}
          </span>
        </div>

        {/* Đồng hồ số */}
        <div className="flex flex-col items-end">
          <div
            className={`px-3 py-1 rounded-lg font-mono font-bold text-sm tracking-wider border transition-all ${
              isTimeOut
                ? 'bg-red-950/80 border-red-700 text-red-400'
                : isLowTime
                ? 'bg-red-950/60 border-red-600 text-red-400 animate-pulse'
                : isActive
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {formattedTime}
          </div>
          {isTimeOut && (
            <span className="text-[10px] font-semibold text-red-400 mt-0.5">
              Hết giờ!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
