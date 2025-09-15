import type { Card, Deck } from "@/lib/domain";
import type { AppSettings, FlashifyStorage } from "./types";

export type FlashifyExportDeck = {
  deck: Deck;
  cards: Card[];
};

export type FlashifyExportData = {
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  decks: FlashifyExportDeck[];
};

export async function exportFlashifyData(
  storage: Pick<FlashifyStorage, "getSettings" | "listCardsForDeck" | "listDecks">,
  now = new Date(),
): Promise<FlashifyExportData> {
  const [settings, decks] = await Promise.all([
    storage.getSettings(),
    storage.listDecks(),
  ]);
  const exportDecks = await Promise.all(
    decks.map(async (deck) => ({
      deck,
      cards: await storage.listCardsForDeck(deck.id),
    })),
  );

  return {
    version: 1,
    exportedAt: now.toISOString(),
    settings,
    decks: exportDecks,
  };
}
