import { AppShell } from "./_components/app-shell";
import { DeckListScreen } from "./_components/deck-list-screen";

export default function Home() {
  return (
    <AppShell>
      <DeckListScreen />
    </AppShell>
  );
}
