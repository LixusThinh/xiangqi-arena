import { authorizedRequest } from './session';

export interface ChatMessageView {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export const CHAT_ERROR_MESSAGES: Record<string, string> = {
  CHAT_RATE_LIMITED: 'Bạn gửi tin quá nhanh (tối đa 5 tin / 10 giây). Vui lòng chờ giây lát.',
  GAME_NOT_PLAYER: 'Bạn không phải người chơi của ván đấu này.',
  GAME_NOT_ACTIVE: 'Ván đấu đã kết thúc, không thể gửi tin nhắn.',
  VALIDATION_ERROR: 'Tin nhắn không hợp lệ (phải từ 1 đến 300 ký tự).',
};

export const chatApi = {
  getChats(matchId: string): Promise<ChatMessageView[]> {
    return authorizedRequest<ChatMessageView[]>(`/matches/${encodeURIComponent(matchId)}/chats`, {
      method: 'GET',
    });
  },
};
