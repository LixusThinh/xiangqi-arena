import { Metadata } from 'next';
import PlayAiView from '@/components/ai/PlayAiView';

export const metadata: Metadata = {
  title: 'Chơi với máy | Xiangqi Arena',
  description: 'Chơi cờ tướng online với máy thông minh theo luật cờ tướng Việt Nam với 3 cấp độ Dễ, Trung bình, Khó.',
};

export default function PlayAiPage() {
  return <PlayAiView />;
}
