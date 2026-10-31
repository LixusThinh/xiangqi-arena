'use client';

import { useState, type ReactNode } from 'react';
import { Position } from '@xiangqi-arena/xiangqi-core';
import Board from '@/components/board/Board';
import ChatBox, { ChatMessage } from '@/components/practice/ChatBox';
import PlayerCard from '@/components/practice/PlayerCard';
import VideoCallPanel, { type CallStatus } from '@/components/match/VideoCallPanel';

type FlowScreen =
  | 'login'
  | 'lobby'
  | 'waiting'
  | 'game'
  | 'ai'
  | 'history'
  | 'admin'
  | 'report';

const screenLabels: Record<FlowScreen, string> = {
  login: 'Đăng nhập',
  lobby: 'Sảnh',
  waiting: 'Phòng chờ',
  game: 'Ván cờ',
  ai: 'Chọn AI',
  history: 'Lịch sử',
  admin: 'Admin',
  report: 'Report',
};

const navScreens: FlowScreen[] = [
  'lobby',
  'waiting',
  'game',
  'ai',
  'history',
  'admin',
  'report',
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    sender: 'system',
    senderName: 'Hệ thống',
    text: 'Chào mừng kỳ thủ đến với phòng thi đấu!',
    time: '15:20',
  },
  {
    id: 'opponent-1',
    sender: 'opponent',
    senderName: 'Kỳ Vương',
    text: 'Chúc bạn có một ván cờ hay!',
    time: '15:21',
  },
];

function FlowButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  className?: string;
}) {
  const styles = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    secondary: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
    quiet: 'text-stone-500 hover:bg-stone-100 hover:text-stone-900',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-stone-900">{value}</p>
      <p className="mt-1 text-xs text-stone-400">{detail}</p>
    </div>
  );
}

export default function ScreenFlowPage() {
  const [screen, setScreen] = useState<FlowScreen>('login');
  const [messages, setMessages] = useState(initialMessages);
  const [ready, setReady] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('Trung cấp');
  const [gameOver, setGameOver] = useState(false);
  // XQA-107: trạng thái video call giả, chưa có WebRTC (XQA-125)
  const [callStatus, setCallStatus] = useState<CallStatus>('connected');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const sendMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `message-${Date.now()}`,
        sender: 'you',
        senderName: 'Bạn',
        text,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const renderScreen = () => {
    switch (screen) {
      case 'login':
        return (
          <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Đấu trí · Kết nối · Tiến bộ
              </div>
              <h1 className="max-w-xl text-5xl font-bold leading-[1.08] tracking-tight text-stone-900">
                Mỗi nước cờ,
                <span className="text-emerald-700"> một cuộc đấu trí.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-stone-500">
                Gặp gỡ kỳ thủ, luyện tập cùng AI và lưu lại hành trình cờ tướng của bạn.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-stone-600">
                <span className="rounded-full bg-white px-4 py-2 shadow-sm">♟ Phòng đấu trực tuyến</span>
                <span className="rounded-full bg-white px-4 py-2 shadow-sm">✦ Phân tích lịch sử</span>
              </div>
            </div>
            <form
              className="rounded-3xl border border-stone-200 bg-white p-7 shadow-xl shadow-stone-200/60 sm:p-9"
              onSubmit={(event) => {
                event.preventDefault();
                setScreen('lobby');
              }}
            >
              <div className="mb-7">
                <p className="text-sm font-semibold text-emerald-700">XIANGQI ARENA</p>
                <h2 className="mt-2 text-2xl font-bold text-stone-900">Chào mừng trở lại</h2>
                <p className="mt-1 text-sm text-stone-500">Đăng nhập để tiếp tục hành trình.</p>
              </div>
              <label className="mb-4 block text-sm font-medium text-stone-700">
                Tên đăng nhập hoặc email
                <input
                  type="text"
                  required
                  placeholder="player1 hoặc ban@email.com"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                Mật khẩu
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <div className="my-5" />
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white transition hover:bg-emerald-800"
              >
                Đăng nhập
              </button>
              <p className="mt-5 text-center text-sm text-stone-500">
                Chưa có tài khoản? <button type="button" className="font-semibold text-emerald-700">Đăng ký</button>
              </p>
            </form>
          </div>
        );
      case 'lobby':
        return (
          <main className="mx-auto max-w-7xl px-5 py-10">
            <SectionTitle
              eyebrow="Sảnh chính"
              title="Chào buổi chiều, Nhân!"
              description="Chọn cách bạn muốn bắt đầu. Bạn có thể tìm đối thủ, tạo phòng riêng hoặc luyện tập với AI."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setScreen('waiting')}
                className="group rounded-2xl bg-emerald-800 p-6 text-left text-white transition hover:bg-emerald-900"
              >
                <span className="text-2xl">⚔</span>
                <h2 className="mt-5 text-xl font-bold">Đấu nhanh</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-100">Tìm kỳ thủ có trình độ phù hợp ngay bây giờ.</p>
                <span className="mt-6 inline-block text-sm font-semibold">Tìm trận đấu →</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('waiting')}
                className="rounded-2xl border border-stone-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-lg"
              >
                <span className="text-2xl">♙</span>
                <h2 className="mt-5 text-xl font-bold text-stone-900">Tạo phòng</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">Mời bạn bè bằng mã phòng và tùy chỉnh luật đấu.</p>
                <span className="mt-6 inline-block text-sm font-semibold text-emerald-700">Tạo phòng riêng →</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('ai')}
                className="rounded-2xl border border-stone-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-lg"
              >
                <span className="text-2xl">✦</span>
                <h2 className="mt-5 text-xl font-bold text-stone-900">Luyện cùng AI</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">Chọn cấp độ và rèn luyện chiến thuật theo tốc độ của bạn.</p>
                <span className="mt-6 inline-block text-sm font-semibold text-emerald-700">Chọn đối thủ AI →</span>
              </button>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard label="Điểm xếp hạng" value="1,284" detail="+24 điểm trong tuần này" />
              <StatCard label="Tổng số ván" value="38" detail="12 ván trong tháng này" />
              <StatCard label="Tỷ lệ thắng" value="68%" detail="Chuỗi thắng hiện tại: 3 ván" />
            </div>
            <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-stone-900">Phòng đang diễn ra</h2>
                  <p className="mt-1 text-sm text-stone-500">Kỳ thủ đang thi đấu trong sảnh công khai.</p>
                </div>
                <FlowButton variant="secondary" onClick={() => setScreen('history')}>Xem lịch sử</FlowButton>
              </div>
              <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-3">
                <span className="font-medium text-stone-700">Kỳ Vương <span className="text-stone-400">vs</span> MinhKhai</span>
                <span className="text-stone-500">Cờ nhanh · 08:42</span>
                <button type="button" onClick={() => setScreen('game')} className="text-left font-semibold text-emerald-700 sm:text-right">Xem ván →</button>
              </div>
            </section>
          </main>
        );
      case 'waiting':
        return (
          <main className="mx-auto max-w-5xl px-5 py-10">
            <SectionTitle
              eyebrow="Phòng chờ · Phòng #XQ-2841"
              title="Sẵn sàng cho ván đấu?"
              description="Chia sẻ mã phòng với bạn bè. Ván đấu sẽ bắt đầu khi cả hai kỳ thủ đã sẵn sàng."
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
              <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
                <div className="flex items-center justify-between border-b border-stone-100 pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Mã phòng</p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-stone-900">XQ-2841</p>
                  </div>
                  <FlowButton variant="secondary" onClick={() => {}}>Sao chép mã</FlowButton>
                </div>
                <div className="grid gap-4 py-7 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Phe Đỏ · Chủ phòng</p>
                    <div className="mt-5 flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-xl">🧑🏻</span>
                      <div><p className="font-bold text-stone-900">Nhân</p><p className="text-xs text-emerald-700">Đã sẵn sàng</p></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Phe Đen · Đối thủ</p>
                    <div className="mt-5 flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-xl">⚫</span>
                      <div><p className="font-bold text-stone-900">Kỳ Vương</p><p className="text-xs text-emerald-700">Đã sẵn sàng</p></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-5">
                  <button type="button" onClick={() => setReady(!ready)} className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <span className={`grid h-5 w-5 place-items-center rounded-md border ${ready ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-stone-300'}`}>{ready ? '✓' : ''}</span>
                    {ready ? 'Bạn đã sẵn sàng' : 'Đánh dấu sẵn sàng'}
                  </button>
                  <FlowButton onClick={() => setScreen('game')}>Bắt đầu ván đấu</FlowButton>
                </div>
              </section>
              <aside className="rounded-3xl bg-stone-900 p-6 text-white">
                <p className="text-sm font-semibold text-emerald-300">CÀI ĐẶT VÁN ĐẤU</p>
                <div className="mt-6 space-y-5 text-sm">
                  <div className="flex justify-between"><span className="text-stone-400">Thể thức</span><span>Cờ nhanh</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Thời gian</span><span>10 phút / bên</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Quyền đi trước</span><span>Ngẫu nhiên</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Camera</span><span>Tùy chọn</span></div>
                </div>
                <p className="mt-8 rounded-xl bg-white/10 p-4 text-xs leading-5 text-stone-300">Mời đối thủ bằng mã phòng. Không chia sẻ thông tin cá nhân trong phòng công khai.</p>
              </aside>
            </div>
          </main>
        );
      case 'game': {
        const position = Position.initial();
        return (
          <main className="mx-auto max-w-[1440px] px-4 py-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Phòng XQ-2841 · Cờ nhanh</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Ván đấu đang diễn ra</h1></div>
              <div className="flex gap-2">
                <FlowButton variant="secondary" onClick={() => setScreen('report')}>Báo cáo</FlowButton>
                <FlowButton variant="secondary" onClick={() => setGameOver(true)}>Đầu hàng</FlowButton>
              </div>
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(220px,0.75fr)_minmax(340px,1fr)_minmax(290px,0.8fr)]">
              <div className="order-2 space-y-4 xl:order-1">
                <PlayerCard name="Kỳ Vương" title="Cao thủ · 1,540 điểm" side="b" timeRemaining={38} isActive={false} />
                <section className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Thông tin ván</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-stone-500">Lượt đi</span><span className="font-medium">Đỏ</span></div>
                    <div className="flex justify-between"><span className="text-stone-500">Số nước</span><span className="font-medium">18</span></div>
                    <div className="flex justify-between"><span className="text-stone-500">Trạng thái</span><span className="font-medium text-emerald-700">Đang thi đấu</span></div>
                    <div role="note" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-red-700">Vị trí cảnh báo CHIẾU (XQA-50)</div>
                  </div>
                </section>
              </div>
              <div className="order-1 flex justify-center rounded-3xl bg-stone-900 p-3 sm:p-5 xl:order-2">
                <Board position={position} className="max-h-[78vh]" />
              </div>
              <div className="order-3 space-y-4">
                <PlayerCard name="Nhân" title="Kỳ thủ · 1,284 điểm" side="r" timeRemaining={52} isActive isLocalPlayer />
                <VideoCallPanel
                  opponentName="Kỳ Vương"
                  selfName="Nhân"
                  status={callStatus}
                  micOn={micOn}
                  camOn={camOn}
                  onToggleMic={() => setMicOn((v) => !v)}
                  onToggleCam={() => setCamOn((v) => !v)}
                  onEndCall={() => setCallStatus('ended')}
                  onStartCall={() => setCallStatus('connected')}
                />
                <div className="h-[360px] min-h-[320px]">
                  <ChatBox messages={messages} onSendMessage={sendMessage} />
                </div>
              </div>
            </div>
            {gameOver && (
              <div className="fixed inset-0 z-30 grid place-items-center bg-stone-900/50 px-4">
                <div role="dialog" aria-modal="true" aria-labelledby="game-over-title" className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Kết thúc ván</p>
                  <h2 id="game-over-title" className="mt-2 text-2xl font-bold text-stone-900">Đen thắng</h2>
                  <p className="mt-1 text-sm text-stone-500">Lý do: Đỏ đầu hàng</p>
                  <div className="mt-6 flex justify-center gap-2">
                    <FlowButton onClick={() => { setGameOver(false); setScreen('waiting'); }}>Ván mới</FlowButton>
                    <FlowButton variant="secondary" onClick={() => { setGameOver(false); setScreen('lobby'); }}>Về sảnh</FlowButton>
                  </div>
                </div>
              </div>
            )}
          </main>
        );
      }
      case 'ai':
        return (
          <main className="mx-auto max-w-6xl px-5 py-10">
            <SectionTitle eyebrow="Luyện tập" title="Chọn đối thủ AI" description="Điều chỉnh cấp độ để tìm một đối thủ phù hợp với mục tiêu luyện tập của bạn." />
            <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr]">
              <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
                <p className="text-sm font-bold text-stone-800">Cấp độ thử thách</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Mới tập', 'Dành cho người mới'],
                    ['Trung cấp', 'Cân bằng và linh hoạt'],
                    ['Cao thủ', 'Thử thách chiến thuật'],
                  ].map(([level, detail]) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSelectedLevel(level)}
                      className={`rounded-2xl border p-4 text-left transition ${selectedLevel === level ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'border-stone-200 hover:border-stone-400'}`}
                    >
                      <span className="text-lg">{level === 'Mới tập' ? '🌱' : level === 'Trung cấp' ? '♟' : '♛'}</span>
                      <span className="mt-3 block font-bold text-stone-900">{level}</span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">{detail}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-7 block text-sm font-medium text-stone-700">
                  Thời gian mỗi bên
                  <select className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-800">
                    <option>10 phút</option><option>15 phút</option><option>Không giới hạn</option>
                  </select>
                </label>
                <FlowButton className="mt-6 w-full" onClick={() => setScreen('game')}>Bắt đầu đấu với AI</FlowButton>
              </section>
              <aside className="flex flex-col items-center justify-center rounded-3xl bg-emerald-900 p-8 text-center text-white">
                <div className="grid h-24 w-24 place-items-center rounded-full bg-white/10 text-5xl">♟</div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Đối thủ của bạn</p>
                <h2 className="mt-2 text-2xl font-bold">AI · {selectedLevel}</h2>
                <p className="mt-3 max-w-xs text-sm leading-6 text-emerald-100">AI sẽ điều chỉnh chiến thuật theo cấp độ đã chọn. Bạn có thể đổi cấp độ trước mỗi ván.</p>
              </aside>
            </div>
          </main>
        );
      case 'history':
        return (
          <main className="mx-auto max-w-7xl px-5 py-10">
            <SectionTitle eyebrow="Hồ sơ kỳ thủ" title="Lịch sử thi đấu" description="Theo dõi kết quả và xem lại những ván đấu gần đây của bạn." />
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Tổng số ván" value="38" detail="Tất cả hình thức" />
              <StatCard label="Thắng / Hòa / Thua" value="26 / 2 / 10" detail="Tỷ lệ thắng 68%" />
              <StatCard label="Điểm xếp hạng" value="1,284" detail="Cập nhật hôm nay" />
            </div>
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-5">
                <h2 className="font-bold text-stone-900">Các ván gần đây</h2>
                <select aria-label="Lọc kết quả" className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600"><option>Tất cả kết quả</option><option>Chiến thắng</option><option>Thất bại</option></select>
              </div>
              <div className="divide-y divide-stone-100">
                {[
                  ['Hôm nay, 14:32', 'Kỳ Vương', 'Chiến thắng', 'Cờ nhanh · 18 nước'],
                  ['Hôm nay, 11:08', 'MinhKhai', 'Thất bại', 'Cờ nhanh · 32 nước'],
                  ['Hôm qua, 20:41', 'AI · Cao thủ', 'Chiến thắng', 'Luyện tập · 24 nước'],
                ].map(([date, opponent, result, details]) => (
                  <div key={date} className="grid gap-3 p-5 sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:items-center">
                    <span className="text-xs text-stone-400">{date}</span><span className="font-semibold text-stone-800">{opponent}</span>
                    <span className={`text-sm font-semibold ${result === 'Chiến thắng' ? 'text-emerald-700' : 'text-rose-600'}`}>{result}</span>
                    <div className="flex items-center justify-between gap-3"><span className="text-xs text-stone-500">{details}</span><button type="button" onClick={() => setScreen('game')} className="whitespace-nowrap text-sm font-semibold text-emerald-700">Xem lại →</button></div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        );
      case 'admin':
        return (
          <main className="mx-auto max-w-7xl px-5 py-10">
            <SectionTitle eyebrow="Quản trị hệ thống" title="Tổng quan" description="Theo dõi hoạt động nền tảng và xử lý các nội dung được báo cáo." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Người dùng" value="2,418" detail="+8.2% so với tháng trước" />
              <StatCard label="Ván hôm nay" value="326" detail="Đang hoạt động ổn định" />
              <StatCard label="Phòng đang mở" value="42" detail="6 phòng chờ" />
              <StatCard label="Báo cáo chờ xử lý" value="7" detail="3 báo cáo ưu tiên cao" />
            </div>
            <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="flex items-center justify-between"><h2 className="font-bold text-stone-900">Báo cáo gần đây</h2><button type="button" onClick={() => setScreen('report')} className="text-sm font-semibold text-emerald-700">Mở hàng đợi →</button></div>
                <div className="mt-5 space-y-4">
                  {['Ngôn từ không phù hợp trong phòng #XQ-2819', 'Nghi ngờ hành vi gian lận · người dùng MinhKhai', 'Phòng công khai có nội dung spam'].map((item, index) => <div key={item} className="flex items-center justify-between gap-4 border-t border-stone-100 pt-4 text-sm"><span className="text-stone-700">{item}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${index === 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{index === 0 ? 'Cao' : 'Mới'}</span></div>)}
                </div>
              </section>
              <section className="rounded-2xl bg-stone-900 p-6 text-white">
                <h2 className="font-bold">Hoạt động quản trị</h2>
                <div className="mt-5 space-y-4 text-sm">
                  <p className="border-l-2 border-emerald-500 pl-3"><span className="block text-stone-300">Báo cáo #RP-104 đã được xử lý</span><span className="text-xs text-stone-500">5 phút trước · Admin Linh</span></p>
                  <p className="border-l-2 border-amber-400 pl-3"><span className="block text-stone-300">Tài khoản được cảnh báo</span><span className="text-xs text-stone-500">32 phút trước · Admin Thảo</span></p>
                  <p className="border-l-2 border-sky-400 pl-3"><span className="block text-stone-300">Người dùng mới đăng ký</span><span className="text-xs text-stone-500">1 giờ trước · Hệ thống</span></p>
                </div>
              </section>
            </div>
          </main>
        );
      case 'report':
        return (
          <main className="mx-auto max-w-5xl px-5 py-10">
            <SectionTitle eyebrow="Hỗ trợ cộng đồng" title="Gửi báo cáo" description="Báo cho đội ngũ quản trị nếu bạn gặp hành vi vi phạm trong sảnh hoặc phòng đấu." />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
              <form
                className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  setReportSent(true);
                }}
              >
                {reportSent ? (
                  <div role="status" className="rounded-2xl bg-emerald-50 p-6 text-emerald-900">
                    <p className="text-lg font-bold">Đã ghi nhận báo cáo</p>
                    <p className="mt-2 text-sm leading-6">Cảm ơn bạn đã giúp cộng đồng an toàn hơn. Mã báo cáo: RP-104.</p>
                    <button type="button" onClick={() => setScreen('lobby')} className="mt-4 font-semibold text-emerald-800">Trở về sảnh →</button>
                  </div>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-stone-700">Loại vi phạm
                      <select required className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3"><option value="">Chọn loại báo cáo</option><option>Ngôn từ không phù hợp</option><option>Gian lận</option><option>Spam hoặc làm phiền</option><option>Khác</option></select>
                    </label>
                    <label className="mt-5 block text-sm font-medium text-stone-700">Người dùng hoặc phòng liên quan
                      <input required placeholder="Tên kỳ thủ hoặc mã phòng" className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-600" />
                    </label>
                    <label className="mt-5 block text-sm font-medium text-stone-700">Mô tả chi tiết
                      <textarea required rows={5} placeholder="Mô tả sự việc và thời điểm xảy ra..." className="mt-2 w-full resize-y rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-600" />
                    </label>
                    <button type="submit" className="mt-6 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800">Gửi báo cáo</button>
                  </>
                )}
              </form>
              <aside className="rounded-3xl bg-stone-900 p-6 text-white">
                <p className="text-sm font-bold text-emerald-300">QUY TRÌNH XỬ LÝ</p>
                <ol className="mt-6 space-y-5">
                  {['Đội ngũ tiếp nhận báo cáo', 'Xác minh thông tin và bằng chứng', 'Cập nhật kết quả xử lý'].map((item, index) => <li key={item} className="flex gap-3 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-emerald-300">{index + 1}</span><span className="pt-1 text-stone-200">{item}</span></li>)}
                </ol>
                <p className="mt-7 text-xs leading-5 text-stone-400">Chỉ gửi báo cáo có căn cứ. Báo cáo sai sự thật có thể ảnh hưởng đến quyền sử dụng tài khoản.</p>
              </aside>
            </div>
          </main>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <button type="button" onClick={() => setScreen('lobby')} className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-800 text-lg text-white">象</span>
            <span className="text-sm font-extrabold tracking-tight text-stone-900">XIANGQI <span className="text-emerald-700">ARENA</span></span>
          </button>
          {screen !== 'login' && (
            <nav aria-label="Điều hướng màn hình" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:justify-center">
              {navScreens.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScreen(item)}
                  aria-current={screen === item ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${screen === item ? 'bg-emerald-50 text-emerald-800' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
                >
                  {screenLabels[item]}
                </button>
              ))}
            </nav>
          )}
          {screen === 'login' ? (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Prototype</span>
          ) : (
            <button type="button" onClick={() => setScreen('login')} className="flex shrink-0 items-center gap-2 rounded-full bg-stone-100 py-1.5 pl-2 pr-3 text-xs font-semibold text-stone-700">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-800 text-white">N</span>
              <span className="hidden sm:inline">Nhân · 1,284</span>
            </button>
          )}
        </div>
      </header>
      {renderScreen()}
      <footer className="border-t border-stone-200 bg-white px-5 py-4 text-center text-xs text-stone-400">
        XQA-61 · Wireframe/prototype giao diện — dữ liệu minh họa, chưa kết nối API
      </footer>
    </div>
  );
}
