'use client';

import React, { useState } from 'react';
import Modal from '@/components/common/Modal';
import { AuthApiError } from '@/lib/auth-api';
import {
  reportApi,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@/lib/report-api';

export const REPORT_MAX_LENGTH = 500;

export function reportLength(text: string): number {
  return Array.from(text).length;
}

export interface ReportModalProps {
  isOpen: boolean;
  matchId: string;
  opponentName?: string;
  onClose: () => void;
}

export default function ReportModal({
  isOpen,
  matchId,
  opponentName = 'đối thủ',
  onClose,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('CHEATING');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen && !noticeMessage) return null;

  // Nếu đang hiện thông báo thành công hoặc trùng lặp
  if (noticeMessage) {
    return (
      <Modal
        isOpen={true}
        title="Thông báo"
        message={noticeMessage}
        isNotice={true}
        onConfirm={() => {
          setNoticeMessage(null);
          onClose();
        }}
      />
    );
  }

  const length = reportLength(description.trim());
  const tooLong = length > REPORT_MAX_LENGTH;
  const canSubmit = !submitting && !tooLong;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await reportApi.createReport(matchId, {
        reason,
        description: description.trim() || undefined,
      });
      setNoticeMessage('Đã gửi báo cáo');
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'REPORT_DUPLICATE' || err.statusCode === 409) {
          setNoticeMessage('Bạn đã báo cáo ván này rồi');
        } else {
          setErrorMessage(err.message || 'Không thể gửi báo cáo.');
        }
      } else {
        setErrorMessage('Lỗi kết nối khi gửi báo cáo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <h3 id="report-modal-title" className="text-lg font-bold text-amber-400">
            Báo cáo {opponentName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="mb-2 block font-semibold text-slate-300">
              Lý do báo cáo:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => {
                const selected = reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`flex items-center justify-center rounded-xl border px-3 py-2.5 font-medium transition ${
                      selected
                        ? 'border-amber-400 bg-amber-500/10 font-bold text-amber-300'
                        : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {REPORT_REASON_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="report-description" className="mb-1 block font-semibold text-slate-300">
              Mô tả chi tiết (tùy chọn):
            </label>
            <textarea
              id="report-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả hành vi vi phạm của đối thủ..."
              className={`w-full rounded-xl border bg-slate-900/90 p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none ${
                tooLong ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-400'
              }`}
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-rose-400">
                {tooLong ? `Mô tả tối đa ${REPORT_MAX_LENGTH} ký tự.` : ''}
              </span>
              <span
                data-testid="report-counter"
                className={tooLong ? 'font-bold text-rose-400' : 'text-slate-400'}
              >
                {length}/{REPORT_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex min-h-[40px] items-center justify-center rounded-xl bg-slate-700 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex min-h-[40px] items-center justify-center rounded-xl bg-rose-600 px-4 py-2 font-bold text-white shadow-lg transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Đang gửi…' : 'Gửi báo cáo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
