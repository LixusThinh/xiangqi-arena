import { Metadata } from 'next';
import ProfileView from '@/components/profile/ProfileView';

export const metadata: Metadata = {
  title: 'Hồ sơ cá nhân | Xiangqi Arena',
  description: 'Xem và chỉnh sửa thông tin cá nhân, thống kê chiến tích cờ tướng.',
};

export default function ProfilePage() {
  return <ProfileView />;
}
