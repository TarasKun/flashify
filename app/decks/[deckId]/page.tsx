import { AppShell } from "@/app/_components/app-shell";
import { DeckDetailScreen } from "@/app/_components/deck-detail-screen";

type DeckPageProps = {
  params: Promise<{
    deckId: string;
  }>;
};

export default async function DeckPage({ params }: DeckPageProps) {
  const { deckId } = await params;

  return (
    <AppShell>
      <DeckDetailScreen deckId={deckId} />
    </AppShell>
  );
}
