import WaitingRoom from '@/components/room/WaitingRoom';

export default function RoomPage({ params }: { params: { code: string } }) {
  return <WaitingRoom code={params.code} />;
}
