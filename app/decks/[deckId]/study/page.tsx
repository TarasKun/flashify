import { AppShell } from "@/app/_components/app-shell";
import { StudySessionScreen } from "@/app/_components/study-session-screen";

type StudyPageProps = {
  params: Promise<{
    deckId: string;
  }>;
};

export default async function StudyPage({ params }: StudyPageProps) {
  const { deckId } = await params;

  return (
    <AppShell>
      <StudySessionScreen deckId={deckId} />
    </AppShell>
  );
}
