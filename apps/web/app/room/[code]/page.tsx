import WaitingRoom from '@/components/WaitingRoom';

export default function RoomPage({ params }: { params: { code: string } }) {
  return <WaitingRoom code={params.code} />;
}
