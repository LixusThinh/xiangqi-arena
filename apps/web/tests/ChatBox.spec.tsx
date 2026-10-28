import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatBox, { ChatMessage, chatLength } from '../components/ChatBox';

describe('<ChatBox />', () => {
  const initialMessages: ChatMessage[] = [
    {
      id: '1',
      sender: 'system',
      senderName: 'Hệ thống',
      text: 'Chào mừng bạn đến với Xiangqi Arena!',
      time: '12:00',
    },
    {
      id: '2',
      sender: 'opponent',
      senderName: 'Đối thủ',
      text: 'Chúc may mắn!',
      time: '12:01',
    },
  ];

  it('renders message history', () => {
    render(<ChatBox messages={initialMessages} onSendMessage={jest.fn()} />);

    expect(screen.getByText('Chào mừng bạn đến với Xiangqi Arena!')).toBeInTheDocument();
    expect(screen.getAllByText('Chúc may mắn!')[0]).toBeInTheDocument();
  });

  it('submits typed message on submit click and Enter key press', () => {
    const handleSend = jest.fn();
    render(<ChatBox messages={initialMessages} onSendMessage={handleSend} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value: 'Nước đi hay quá!' } });
    fireEvent.submit(input.closest('form')!);

    expect(handleSend).toHaveBeenCalledWith('Nước đi hay quá!');
  });

  it('does not submit empty or whitespace-only messages', () => {
    const handleSend = jest.fn();
    render(<ChatBox messages={initialMessages} onSendMessage={handleSend} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.submit(input.closest('form')!);

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('submits quick-chat phrase when a quick phrase chip is clicked', () => {
    const handleSend = jest.fn();
    render(<ChatBox messages={initialMessages} onSendMessage={handleSend} />);

    const quickChip = screen.getByText('Xin chào!');
    fireEvent.click(quickChip);

    expect(handleSend).toHaveBeenCalledWith('Xin chào!');
  });
});

describe('<ChatBox /> – giới hạn 300 ký tự (XQA-106, FR-23)', () => {
  const type = (value: string) => {
    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value } });
    return input;
  };

  it('bộ đếm hiện số ký tự / 300', () => {
    render(<ChatBox messages={[]} onSendMessage={jest.fn()} />);
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('0/300');
    type('Xin chào');
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('8/300');
  });

  it('đúng 300 ký tự vẫn gửi được', () => {
    const send = jest.fn();
    render(<ChatBox messages={[]} onSendMessage={send} />);
    const input = type('a'.repeat(300));
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeEnabled();
    fireEvent.submit(input.closest('form')!);
    expect(send).toHaveBeenCalledWith('a'.repeat(300));
  });

  it('AC2: 301 ký tự → nút Gửi khóa, báo lỗi, submit (Enter) cũng không gửi', () => {
    const send = jest.fn();
    render(<ChatBox messages={[]} onSendMessage={send} />);
    const input = type('a'.repeat(301));
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Tin nhắn tối đa 300 ký tự.');
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('301/300');
    fireEvent.submit(input.closest('form')!);
    expect(send).not.toHaveBeenCalled();
  });

  it('emoji / tiếng Việt có dấu đếm theo ký tự, không theo UTF-16', () => {
    render(<ChatBox messages={[]} onSendMessage={jest.fn()} />);
    type('👍'.repeat(150));
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('150/300');
    expect(chatLength('Hay quá 👍')).toBe(9);
  });

  it('khoảng trắng đầu cuối không tính, tin chỉ có khoảng trắng không gửi được', () => {
    render(<ChatBox messages={[]} onSendMessage={jest.fn()} />);
    type('   ');
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('0/300');
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  });

  it('NFR-04: tin chứa HTML / script hiện nguyên văn, không tạo thẻ', () => {
    const xss = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const { container } = render(
      <ChatBox messages={[{ id: 'x', sender: 'opponent', senderName: 'B', text: xss, time: '12:00' }]} onSendMessage={jest.fn()} />,
    );
    expect(screen.getByText(xss)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
