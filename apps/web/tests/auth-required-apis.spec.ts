/**
 * Các API cần đăng nhập phải đi qua authorizedRequest (gắn Bearer token, tự refresh khi hết hạn).
 * Trước đây report / chat / admin gọi apiRequest trần → server trả 401 AUTH_TOKEN_MISSING trên trình duyệt thật.
 */
import { authorizedRequest } from '../lib/session';
import { reportApi } from '../lib/report-api';
import { chatApi } from '../lib/chat-api';
import { adminApi } from '../lib/admin-api';

jest.mock('../lib/session', () => ({
  authorizedRequest: jest.fn().mockResolvedValue({}),
}));

const mocked = authorizedRequest as jest.Mock;

describe('API cần đăng nhập dùng authorizedRequest', () => {
  beforeEach(() => mocked.mockClear());

  it('gửi báo cáo', async () => {
    await reportApi.createReport('12', { reason: 'SPAM' });
    expect(mocked).toHaveBeenCalledWith('/matches/12/report', expect.objectContaining({ method: 'POST' }));
  });

  it('tải lịch sử chat', async () => {
    await chatApi.getChats('12');
    expect(mocked).toHaveBeenCalledWith('/matches/12/chats', expect.anything());
  });

  it('mọi lệnh admin', async () => {
    await adminApi.getDashboard();
    expect(mocked).toHaveBeenCalledWith('/admin/dashboard', expect.anything());
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});
