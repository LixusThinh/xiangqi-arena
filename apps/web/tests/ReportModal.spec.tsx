import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportModal from '../components/report/ReportModal';
import { reportApi } from '../lib/report-api';
import { AuthApiError } from '../lib/auth-api';

jest.mock('../lib/report-api', () => ({
  ...jest.requireActual('../lib/report-api'),
  reportApi: {
    createReport: jest.fn(),
  },
}));

describe('<ReportModal /> (XQA-30, FR-24)', () => {
  const matchId = '101';
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('không render khi isOpen=false', () => {
    const { container } = render(
      <ReportModal isOpen={false} matchId={matchId} onClose={onClose} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('render đầy đủ các lựa chọn lý do và bộ đếm ký tự (AC-30-01, AC-30-06)', () => {
    render(
      <ReportModal
        isOpen={true}
        matchId={matchId}
        opponentName="Đối thủ X"
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Báo cáo Đối thủ X')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gian lận' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quấy rối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spam' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Khác' })).toBeInTheDocument();

    const counter = screen.getByTestId('report-counter');
    expect(counter).toHaveTextContent('0/500');

    const submitBtn = screen.getByRole('button', { name: 'Gửi báo cáo' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('đếm ký tự theo Unicode code points và vô hiệu hóa nút gửi khi > 500 ký tự (AC-30-06)', () => {
    render(
      <ReportModal isOpen={true} matchId={matchId} onClose={onClose} />,
    );

    const textarea = screen.getByPlaceholderText(/Mô tả hành vi vi phạm/);
    const counter = screen.getByTestId('report-counter');
    const submitBtn = screen.getByRole('button', { name: 'Gửi báo cáo' });

    // Nhập emoji (mỗi emoji = 1 code point)
    fireEvent.change(textarea, { target: { value: '⚠️ Gian lận cờ' } });
    expect(counter).toHaveTextContent('14/500');
    expect(submitBtn).not.toBeDisabled();

    // Nhập quá 500 ký tự
    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } });
    expect(counter).toHaveTextContent('501/500');
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Mô tả tối đa 500 ký tự/)).toBeInTheDocument();
  });

  it('gửi báo cáo thành công -> hiện thông báo "Đã gửi báo cáo" (AC-30-01)', async () => {
    (reportApi.createReport as jest.Mock).mockResolvedValue({
      id: '1',
      matchId,
      reporterId: '10',
      reportedUserId: '20',
      reason: 'SPAM',
      description: 'Spam liên tục trong phòng',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });

    render(
      <ReportModal isOpen={true} matchId={matchId} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    const textarea = screen.getByPlaceholderText(/Mô tả hành vi vi phạm/);
    fireEvent.change(textarea, { target: { value: 'Spam liên tục trong phòng' } });

    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    await waitFor(() => {
      expect(reportApi.createReport).toHaveBeenCalledWith(matchId, {
        reason: 'SPAM',
        description: 'Spam liên tục trong phòng',
      });
    });

    expect(await screen.findByText('Đã gửi báo cáo')).toBeInTheDocument();

    // Bấm Đóng trong thông báo
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('báo cáo trùng lặp -> hiện thông báo "Bạn đã báo cáo ván này rồi" (AC-30-03)', async () => {
    (reportApi.createReport as jest.Mock).mockRejectedValue(
      new AuthApiError('Trùng lặp', 409, 'REPORT_DUPLICATE'),
    );

    render(
      <ReportModal isOpen={true} matchId={matchId} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    await waitFor(() => {
      expect(reportApi.createReport).toHaveBeenCalled();
    });

    expect(await screen.findByText('Bạn đã báo cáo ván này rồi')).toBeInTheDocument();
  });
});
