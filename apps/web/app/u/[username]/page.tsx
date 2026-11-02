import { Metadata } from 'next';
import ProfileView from '@/components/profile/ProfileView';

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  return {
    title: `Hồ sơ ${params.username} | Xiangqi Arena`,
    description: `Hồ sơ và thống kê chiến tích của người chơi ${params.username} tại Xiangqi Arena.`,
  };
}

export default function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  return <ProfileView username={params.username} />;
}
