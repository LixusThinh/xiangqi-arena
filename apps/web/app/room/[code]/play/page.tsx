import MatchView from '@/components/match/MatchView';

export default function RoomPlayPage({ params }: { params: { code: string } }) {
  return <MatchView code={params.code} />;
}
