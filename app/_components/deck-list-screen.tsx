"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Deck } from "@/lib/domain";
import {
  createIndexedDbStorage,
  seedDemoData,
  type DeckProgress,
} from "@/lib/storage";

type DeckListItem = {
  deck: Deck;
  progress: DeckProgress;
  dueCount: number;
};

export function DeckListScreen() {
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [items, setItems] = useState<DeckListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDecks = useCallback(async () => {
    setIsLoading(true);
    await seedDemoData(storage);

    const decks = await storage.listDecks();
    const nextItems = await Promise.all(
      decks.map(async (deck) => {
        const progress = await storage.getDeckProgress(deck.id);
        const dueCards = await storage.listStudyCards({
          deckId: deck.id,
          now: new Date(),
        });

        return {
          deck,
          progress,
          dueCount: dueCards.length,
        };
      }),
    );

    setItems(nextItems);
    setIsLoading(false);
  }, [storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDecks();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDecks]);

  const learnedTotal = items.reduce(
    (sum, item) => sum + item.progress.learned,
    0,
  );
  const cardsTotal = items.reduce((sum, item) => sum + item.progress.total, 0);
  const dueTotal = items.reduce((sum, item) => sum + item.dueCount, 0);

  return (
    <section className="grid gap-5">
      <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-panel-gradient)] p-5 shadow-[var(--app-shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--app-primary)]">
              Today
            </p>
            <h2 className="mt-2 truncate text-3xl font-black tracking-normal">
              {isLoading ? "Loading decks" : `${dueTotal} cards due`}
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-white/75 px-4 py-2 text-sm font-black text-[var(--app-primary)] shadow-sm backdrop-blur dark:bg-white/10">
            {learnedTotal}/{cardsTotal}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[var(--app-radius-sm)] bg-white/70 px-2 py-3 shadow-sm backdrop-blur dark:bg-white/10">
            <p className="text-xl font-black">{items.length}</p>
            <p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">
              Decks
            </p>
          </div>
          <div className="rounded-[var(--app-radius-sm)] bg-white/70 px-2 py-3 shadow-sm backdrop-blur dark:bg-white/10">
            <p className="text-xl font-black">{cardsTotal}</p>
            <p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">
              Cards
            </p>
          </div>
          <div className="rounded-[var(--app-radius-sm)] bg-white/70 px-2 py-3 shadow-sm backdrop-blur dark:bg-white/10">
            <p className="text-xl font-black">{learnedTotal}</p>
            <p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">
              Learned
            </p>
          </div>
        </div>

        <Link
          aria-disabled={!items[0]}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-5 text-base font-black text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
          href={items[0] ? `/decks/${items[0].deck.id}/study` : "/"}
        >
          <Play aria-hidden="true" size={19} strokeWidth={2.4} />
          Start study
        </Link>
      </section>

      {!isLoading && items.length === 0 ? (
        <section className="rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-5 text-center shadow-[var(--app-shadow-soft)]">
          <p className="font-black">No decks yet</p>
          <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">
            Create a deck from the top menu, then add cards manually or import
            text.
          </p>
        </section>
      ) : null}
    </section>
  );
}
