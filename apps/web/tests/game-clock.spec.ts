import { displayClock, formatClock } from '@/lib/game-clock';

describe('XQA-142 đồng hồ hiển thị (chỉ đếm theo số server gửi)', () => {
  const snapshot = { redMs: 300_000, blackMs: 120_000, running: 'RED' as const };

  it('chỉ trừ giờ của bên đang chạy, bên kia giữ nguyên', () => {
    expect(displayClock(snapshot, 1_500)).toEqual({ redMs: 298_500, blackMs: 120_000, running: 'RED' });
  });

  it('không có bên nào chạy giờ (ván kết thúc) → giữ nguyên số server gửi', () => {
    const frozen = { ...snapshot, running: null };
    expect(displayClock(frozen, 60_000)).toEqual(frozen);
  });

  it('về 0 thì đứng ở 0, không âm – client không tự xử hết giờ, chờ server gửi game:end', () => {
    expect(displayClock(snapshot, 999_999).redMs).toBe(0);
  });

  it('thời gian trôi âm (đồng hồ máy chỉnh lùi) không làm tăng giờ', () => {
    expect(displayClock(snapshot, -5_000).redMs).toBe(300_000);
  });

  it.each([
    [600_000, '10:00'],
    [754_321, '12:34'],
    [61_000, '1:01'],
    [10_000, '0:10'],
    [9_450, '0:09.4'],
    [999, '0:00.9'],
    [0, '0:00.0'],
    [-20, '0:00.0'],
  ])('formatClock(%i) = %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});
