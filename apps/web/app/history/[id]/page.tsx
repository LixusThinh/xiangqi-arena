import { Metadata } from 'next';
import ReplayView from '@/components/replay/ReplayView';

export const metadata: Metadata = {
  title: 'Xem lại ván đấu | Xiangqi Arena',
  description: 'Xem lại từng nước đi của ván cờ tướng với ký hiệu tiếng Việt chuẩn.',
};

export default function ReplayPage({ params }: { params: { id: string } }) {
  return <ReplayView matchId={params.id} />;
}
