import { iceServersFromEnv } from '@/lib/use-video-call';

describe('XQA-124/125 cấu hình STUN/TURN (NEXT_PUBLIC_ICE_SERVERS)', () => {
  const google = [{ urls: 'stun:stun.l.google.com:19302' }];

  it('không cấu hình → dùng STUN miễn phí của Google', () => {
    expect(iceServersFromEnv(undefined)).toEqual(google);
    expect(iceServersFromEnv('  ')).toEqual(google);
  });

  it('có cấu hình TURN → dùng đúng danh sách', () => {
    const servers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' },
    ];
    expect(iceServersFromEnv(JSON.stringify(servers))).toEqual(servers);
  });

  it('JSON sai / mảng rỗng → quay về mặc định thay vì làm hỏng cuộc gọi', () => {
    expect(iceServersFromEnv('{not json')).toEqual(google);
    expect(iceServersFromEnv('[]')).toEqual(google);
  });
});
