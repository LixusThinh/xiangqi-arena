'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  sender: 'you' | 'opponent' | 'system';
  senderName: string;
  text: string;
  time: string;
}

export interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  className?: string;
}

const QUICK_CHIPS = ['Xin chào!', 'Nước cờ hay!', 'Chúc may mắn!', 'Cảm ơn!'];

export default function ChatBox({
  messages,
  onSendMessage,
  className = '',
}: ChatBoxProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  return (
    <div
      className={`flex flex-col h-full bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden backdrop-blur ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/80 flex items-center justify-between">
        <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
          💬 Trò chuyện phòng đấu
        </h3>
        <span className="text-[10px] text-slate-400">Cục bộ</span>
      </div>

      {/* Danh sách tin nhắn */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 min-h-[220px] max-h-[360px] text-xs">
        {messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div
                key={msg.id}
                className="text-center py-1 px-2.5 rounded-full bg-slate-900/60 text-slate-400 text-[11px] border border-slate-800 self-center"
              >
                {msg.text}
              </div>
            );
          }

          const isYou = msg.sender === 'you';
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                isYou ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <span className="text-[10px] text-slate-400 px-1 mb-0.5">
                {msg.senderName} • {msg.time}
              </span>
              <div
                className={`py-1.5 px-3 rounded-2xl leading-relaxed text-xs shadow-sm ${
                  isYou
                    ? 'bg-amber-600 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-slate-700 text-slate-100 rounded-tl-none border border-slate-600'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick chat chips */}
      <div className="px-3 py-2 border-t border-slate-700/50 flex gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSendMessage(chip)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-slate-700 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
