import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatBox, { ChatMessage } from '../components/ChatBox';

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
