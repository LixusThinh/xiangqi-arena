import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../components/common/Modal';

describe('<Modal />', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} title="Xác nhận" message="Nội dung" onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, message, and action buttons when open', () => {
    render(
      <Modal isOpen={true} title="Ván mới" message="Bắt đầu ván mới?" onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(screen.getByText('Ván mới')).toBeInTheDocument();
    expect(screen.getByText('Bắt đầu ván mới?')).toBeInTheDocument();
    expect(screen.getByText('Xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Hủy')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const handleConfirm = jest.fn();
    render(
      <Modal isOpen={true} title="Thoát" message="Rời phòng?" onConfirm={handleConfirm} onCancel={jest.fn()} />
    );
    fireEvent.click(screen.getByText('Xác nhận'));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const handleCancel = jest.fn();
    render(
      <Modal isOpen={true} title="Thoát" message="Rời phòng?" onConfirm={jest.fn()} onCancel={handleCancel} />
    );
    fireEvent.click(screen.getByText('Hủy'));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('supports notice-only mode without cancel button', () => {
    render(
      <Modal isOpen={true} title="Xin hòa" message="Đã gửi đề nghị hòa" isNotice={true} onConfirm={jest.fn()} />
    );
    expect(screen.getByText('Đóng')).toBeInTheDocument();
    expect(screen.queryByText('Hủy')).not.toBeInTheDocument();
  });

  it('provides accessible dialog attributes and title association', () => {
    render(
      <Modal isOpen={true} title="Ván mới" message="Bắt đầu ván mới?" onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    expect(screen.getByText('Ván mới')).toHaveAttribute('id', 'modal-title');
  });

  it('dismisses modal on Escape key press by calling onCancel', () => {
    const handleCancel = jest.fn();
    render(
      <Modal isOpen={true} title="Ván mới" message="Bắt đầu ván mới?" onConfirm={jest.fn()} onCancel={handleCancel} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('dismisses notice modal on Escape key press by calling onConfirm', () => {
    const handleConfirm = jest.fn();
    render(
      <Modal isOpen={true} title="Xin hòa" message="Đã gửi đề nghị hòa" isNotice={true} onConfirm={handleConfirm} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
