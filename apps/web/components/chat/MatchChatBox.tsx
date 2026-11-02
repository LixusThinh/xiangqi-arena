'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { chatApi, type ChatMessageView } from '@/lib/chat-api';
import { GameSocketError, type GameConnection } from '@/lib/game-socket';

export const CHAT_MAX_LENGTH = 300;

export function chatLength(text: string): number {
  return Array.from(text).length;
}

export interface MatchChatBoxProps {
  matchId: string;
  isFinished: boolean;
  connection: GameConnection | null;
  currentUserId?: string | null;
  className?: string;
  /** Chữ hiện trong ô nhập khi bị khóa (mặc định: ván đã kết thúc; ván hoãn truyền chữ khác). */
  lockedLabel?: string;
}

const QUICK_CHIPS = ['Xin chào!', 'Nước cờ hay!', 'Chúc may mắn!', 'Cảm ơn!'];

export default function MatchChatBox({
  matchId,
  isFinished,
  connection,
  currentUserId,
  className = '',
  lockedLabel = 'Ván đã kết thúc',
}: MatchChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // 1. Tải lịch sử 50 tin nhắn khi mount
  useEffect(() => {
    let cancelled = false;
    chatApi
      .getChats(matchId)
      .then((history) => {
        if (!cancelled) {
          setMessages((prev) => {
            const map = new Map<string, ChatMessageView>();
            for (const m of history) {
              map.set(m.id, m);
            }
            for (const m of prev) {
              map.set(m.id, m);
            }
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {
        // Lỗi tải lịch sử không làm sập giao diện
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // 2. Lắng nghe tin nhắn mới qua socket
  useEffect(() => {
    if (!connection) return;
    const handleChatMessage = (msg: ChatMessageView) => {
      if (msg.matchId !== matchId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    connection.onChatMessage(handleChatMessage);
  }, [connection, matchId]);

  // 3. Tự động cuộn xuống khi có tin mới
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const trimmed = inputText.trim();
  const length = chatLength(trimmed);
  const tooLong = length > CHAT_MAX_LENGTH;
  const canSend = !isFinished && !sending && length > 0 && !tooLong;

  const handleSend = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isFinished || sending || !connection) return;
    if (chatLength(cleanText) > CHAT_MAX_LENGTH) return;

    setSending(true);
    setErrorMessage(null);
    try {
      const sentMsg = await connection.sendChat(matchId, cleanText);
      setMessages((prev) => (prev.some((m) => m.id === sentMsg.id) ? prev : [...prev, sentMsg]));
      setInputText('');
    } catch (err) {
      if (err instanceof GameSocketError) {
        if (err.code === 'CHAT_RATE_LIMITED') {
          setErrorMessage('Bạn gửi tin quá nhanh (tối đa 5 tin / 10 giây). Vui lòng chờ giây lát.');
        } else if (err.code === 'GAME_NOT_ACTIVE') {
          setErrorMessage('Ván đấu đã kết thúc.');
        } else {
          setErrorMessage(err.message || 'Không thể gửi tin nhắn.');
        }
      } else {
        setErrorMessage('Lỗi kết nối khi gửi tin nhắn.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSend(trimmed);
  };

  return (
    <div
      data-testid="match-chat-box"
      className={`flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-3 shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
          💬 Trò chuyện trong ván
        </h3>
        {isFinished && (
          <span className="text-[10px] font-medium text-slate-400">Chỉ đọc</span>
        )}
      </div>

      {/* Danh sách tin nhắn */}
      <div
        data-testid="chat-message-list"
        className="flex h-44 flex-col gap-2 overflow-y-auto py-2 text-xs"
      >
        {messages.length === 0 ? (
          <div className="my-auto text-center text-xs text-slate-400">
            Chưa có tin nhắn nào. Hãy gửi lời chào!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId ? msg.senderId === currentUserId : false;
            const timeStr = msg.createdAt
              ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={msg.id}
                data-testid="chat-message-item"
                className={`flex max-w-[85%] flex-col ${
                  isMe ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                <span className="mb-0.5 px-1 text-[10px] text-slate-400">
                  {msg.senderName} {timeStr ? `• ${timeStr}` : ''}
                </span>
                {/* Văn bản hiển thị dạng text thuần qua React để chống XSS */}
                <div
                  className={`rounded-2xl px-3 py-1.5 text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'rounded-tr-none bg-amber-500 font-medium text-slate-950'
                      : 'rounded-tl-none border border-slate-700 bg-slate-800 text-slate-100'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Báo lỗi nếu có */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300"
        >
          {errorMessage}
        </div>
      )}

      {/* Quick chat chips */}
      {!isFinished && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-slate-800/80 py-1.5">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => void handleSend(chip)}
              className="flex whitespace-nowrap rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Form nhập tin */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-1 pt-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            disabled={isFinished}
            onChange={(e) => {
              setInputText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder={isFinished ? lockedLabel : 'Nhập tin nhắn...'}
            aria-label="Tin nhắn"
            aria-invalid={tooLong}
            aria-describedby="chat-counter"
            className={`min-h-[38px] flex-1 rounded-xl border bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400 ${
              tooLong ? 'border-rose-500' : 'border-slate-700 focus:border-amber-400'
            }`}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex min-h-[38px] items-center justify-center rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
        <div className="flex items-center justify-between px-1 text-[10px]">
          <span className="text-rose-400">
            {tooLong ? `Tối đa ${CHAT_MAX_LENGTH} ký tự.` : ''}
          </span>
          <span
            id="chat-counter"
            data-testid="chat-counter"
            className={tooLong ? 'font-bold text-rose-400' : 'text-slate-400'}
          >
            {length}/{CHAT_MAX_LENGTH}
          </span>
        </div>
      </form>
    </div>
  );
}
