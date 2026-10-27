import MatchView from '@/components/MatchView';

export default function RoomPlayPage({ params }: { params: { code: string } }) {
  return <MatchView code={params.code} />;
}
