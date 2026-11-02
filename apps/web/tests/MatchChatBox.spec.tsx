import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MatchChatBox from '../components/chat/MatchChatBox';
import { chatApi, type ChatMessageView } from '../lib/chat-api';
import { GameSocketError, type GameConnection } from '../lib/game-socket';

jest.mock('../lib/chat-api', () => ({
  chatApi: {
    getChats: jest.fn(),
  },
}));

function createMockConnection(): {
  connection: GameConnection;
  triggerIncomingChat: (msg: ChatMessageView) => void;
} {
  let chatListener: ((msg: ChatMessageView) => void) | null = null;
  const connection = {
    join: jest.fn(),
    move: jest.fn(),
    resign: jest.fn(),
    offerDraw: jest.fn(),
    answerDraw: jest.fn(),
    onUpdate: jest.fn(),
    onEnd: jest.fn(),
    onDrawOffered: jest.fn(),
    onDrawRejected: jest.fn(),
    onPlayerDisconnected: jest.fn(),
    onPlayerReconnected: jest.fn(),
    onConnectionChange: jest.fn(),
    signal: jest.fn(),
    onSignal: jest.fn(),
    close: jest.fn(),
    sendChat: jest.fn(),
    onChatMessage: jest.fn((l: (msg: ChatMessageView) => void) => {
      chatListener = l;
    }),
  } as unknown as GameConnection;

  return {
    connection,
    triggerIncomingChat: (msg: ChatMessageView) => {
      chatListener?.(msg);
    },
  };
}

describe('<MatchChatBox /> (XQA-29)', () => {
  const matchId = '101';
  const myId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (chatApi.getChats as jest.Mock).mockResolvedValue([]);
  });

  it('tải và hiển thị lịch sử chat từ API (AC-29-07), render text an toàn chống XSS (AC-29-03)', async () => {
    const history: ChatMessageView[] = [
      {
        id: 'msg-1',
        matchId,
        senderId: 'user-2',
        senderName: 'Đối Thủ',
        content: '<script>alert("xss")</script> Xin chào!',
        createdAt: '2026-11-02T10:00:00.000Z',
      },
      {
        id: 'msg-2',
        matchId,
        senderId: myId,
        senderName: 'Tôi',
        content: 'Chào bạn, chúc may mắn! <b>đậm</b>',
        createdAt: '2026-11-02T10:00:05.000Z',
      },
    ];
    (chatApi.getChats as jest.Mock).mockResolvedValue(history);
    const { connection } = createMockConnection();

    render(
      <MatchChatBox
        matchId={matchId}
        isFinished={false}
        connection={connection}
        currentUserId={myId}
      />,
    );

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    // Nội dung HTML/script được render nguyên văn dạng text
    expect(
      screen.getByText('<script>alert("xss")</script> Xin chào!'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Chào bạn, chúc may mắn! <b>đậm</b>'),
    ).toBeInTheDocument();
  });

  it('đếm ký tự theo Unicode code points và vô hiệu hóa nút gửi khi rỗng hoặc > 300 ký tự (AC-29-02)', async () => {
    const { connection } = createMockConnection();

    render(
      <MatchChatBox
        matchId={matchId}
        isFinished={false}
        connection={connection}
        currentUserId={myId}
      />,
    );

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    const input = screen.getByLabelText('Tin nhắn');
    const sendButton = screen.getByRole('button', { name: 'Gửi' });
    const counter = screen.getByTestId('chat-counter');

    // Mặc định rỗng: button disabled
    expect(counter).toHaveTextContent('0/300');
    expect(sendButton).toBeDisabled();

    // Nhập emoji (mỗi emoji tính 1 code point)
    fireEvent.change(input, { target: { value: '👋 象棋' } });
    expect(counter).toHaveTextContent('4/300');
    expect(sendButton).not.toBeDisabled();

    // Nhập quá 300 ký tự
    fireEvent.change(input, { target: { value: 'a'.repeat(301) } });
    expect(counter).toHaveTextContent('301/300');
    expect(sendButton).toBeDisabled();
    expect(screen.getByText(/Tối đa 300 ký tự/)).toBeInTheDocument();
  });

  it('gửi tin nhắn thành công qua socket (AC-29-01)', async () => {
    const { connection } = createMockConnection();
    const sentMsg: ChatMessageView = {
      id: 'msg-new',
      matchId,
      senderId: myId,
      senderName: 'Tôi',
      content: 'Nước cờ hay quá!',
      createdAt: new Date().toISOString(),
    };
    (connection.sendChat as jest.Mock).mockResolvedValue(sentMsg);

    render(
      <MatchChatBox
        matchId={matchId}
        isFinished={false}
        connection={connection}
        currentUserId={myId}
      />,
    );

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    const input = screen.getByLabelText('Tin nhắn');
    const sendButton = screen.getByRole('button', { name: 'Gửi' });

    fireEvent.change(input, { target: { value: 'Nước cờ hay quá!' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(connection.sendChat).toHaveBeenCalledWith(matchId, 'Nước cờ hay quá!');
    });

    expect(screen.getByText('Nước cờ hay quá!')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('xử lý lỗi rate limit CHAT_RATE_LIMITED (AC-29-04)', async () => {
    const { connection } = createMockConnection();
    (connection.sendChat as jest.Mock).mockRejectedValue(
      new GameSocketError('CHAT_RATE_LIMITED', 'Rate limited'),
    );

    render(
      <MatchChatBox
        matchId={matchId}
        isFinished={false}
        connection={connection}
        currentUserId={myId}
      />,
    );

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    const input = screen.getByLabelText('Tin nhắn');
    const sendButton = screen.getByRole('button', { name: 'Gửi' });

    fireEvent.change(input, { target: { value: 'Spam 123' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bạn gửi tin quá nhanh (tối đa 5 tin / 10 giây). Vui lòng chờ giây lát.',
      );
    });
  });

  it('nhận tin nhắn mới realtime qua socket connection (AC-29-01)', async () => {
    const { connection, triggerIncomingChat } = createMockConnection();

    render(
      <MatchChatBox
        matchId={matchId}
        isFinished={false}
        connection={connection}
        currentUserId={myId}
      />,
    );

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    const incoming: ChatMessageView = {
      id: 'incoming-1',
      matchId,
      senderId: 'user-2',
      senderName: 'Kỳ thủ đối thủ',
      content: 'Chào cờ thủ!',
      createdAt: new Date().toISOString(),
    };

    await waitFor(() => {
      expect(chatApi.getChats).toHaveBeenCalledWith(matchId);
    });

    act(() => {
      triggerIncomingChat(incoming);
    });

    await waitFor(() => {
      expect(screen.getByText('Chào cờ thủ!')).toBeInTheDocument();
      expect(screen.getByText(/Kỳ thủ đối thủ/)).toBeInTheDocument();
    });
  });

  it('khóa ô nhập và nút gửi khi ván đã kết thúc isFinished (AC-29-06)', () => {
    const { connection } = createMockConnection();

    render(
      <MatchChatBox
        matchId={matchId}
        isFinished={true}
        connection={connection}
        currentUserId={myId}
      />,
    );

    expect(screen.getByText('Chỉ đọc')).toBeInTheDocument();
    const input = screen.getByLabelText('Tin nhắn');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Ván đã kết thúc');
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
    // Quick chips không hiển thị khi kết thúc
    expect(screen.queryByText('Xin chào!')).not.toBeInTheDocument();
  });
});
