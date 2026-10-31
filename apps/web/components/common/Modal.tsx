'use client';

import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isNotice?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function Modal({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isNotice = false,
  onConfirm,
  onCancel,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCancel) {
          onCancel();
        } else {
          onConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-100 flex flex-col gap-4"
      >
        <h3 id="modal-title" className="text-lg font-bold text-amber-400">
          {title}
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 mt-2">
          {!isNotice && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-lg shadow-amber-500/20"
          >
            {isNotice ? 'Đóng' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
