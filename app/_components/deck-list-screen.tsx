"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Card, Deck } from "@/lib/domain";
import {
  createIndexedDbStorage,
  seedDemoData,
  type DeckProgress,
} from "@/lib/storage";

const ACTIVE_DECK_STORAGE_KEY = "flashify.activeDeckId";
const ACTIVE_DECK_CHANGE_EVENT = "flashify:active-deck-change";

type ActiveDeckState = {
  deck: Deck;
  cards: Card[];
  progress: DeckProgress;
  dueCount: number;
};

export function DeckListScreen() {
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [activeDeckState, setActiveDeckState] =
    useState<ActiveDeckState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDecks = useCallback(async () => {
    setIsLoading(true);
    await seedDemoData(storage);

    const decks = await storage.listDecks();
    const savedDeckId = window.localStorage.getItem(ACTIVE_DECK_STORAGE_KEY);
    const activeDeck =
      decks.find((deck) => deck.id === savedDeckId) ?? decks[0] ?? null;

    if (!activeDeck) {
      setActiveDeckState(null);
      setIsLoading(false);
      return;
    }

    if (activeDeck.id !== savedDeckId) {
      window.localStorage.setItem(ACTIVE_DECK_STORAGE_KEY, activeDeck.id);
    }

    const [cards, progress, dueCards] = await Promise.all([
      storage.listCardsForDeck(activeDeck.id),
      storage.getDeckProgress(activeDeck.id),
      storage.listStudyCards({
        deckId: activeDeck.id,
        now: new Date(),
      }),
    ]);

    setActiveDeckState({
      deck: activeDeck,
      cards,
      progress,
      dueCount: dueCards.length,
    });
    setIsLoading(false);
  }, [storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDecks();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDecks]);

  useEffect(() => {
    function handleActiveDeckChange() {
      void loadDecks();
    }

    window.addEventListener(ACTIVE_DECK_CHANGE_EVENT, handleActiveDeckChange);

    return () =>
      window.removeEventListener(
        ACTIVE_DECK_CHANGE_EVENT,
        handleActiveDeckChange,
      );
  }, [loadDecks]);

  const activeCardsCount = activeDeckState
    ? activeDeckState.progress.total - activeDeckState.progress.learned
    : 0;
  const practicedTodayCount =
    activeDeckState?.cards.filter((card) => wasCardPracticedToday(card))
      .length ?? 0;
  const learnedCount = activeDeckState?.progress.learned ?? 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-5">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="pt-1 text-center">
          <h2 className="break-words text-4xl font-black tracking-normal">
            {isLoading
              ? "Loading"
              : activeDeckState?.deck.name ?? "No deck selected"}
          </h2>
        </div>

        <div className="mt-auto grid grid-cols-3 overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-soft)]">
          <Metric label="To learn" tone="primary" value={activeCardsCount} />
          <Metric
            label="Practiced"
            tone="success"
            value={practicedTodayCount}
          />
          <Metric label="Learned" tone="warning" value={learnedCount} />
        </div>
      </section>

      <Link
        aria-disabled={!activeDeckState}
        className="flex h-16 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-5 text-lg font-black uppercase tracking-[0.08em] text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
        href={activeDeckState ? `/decks/${activeDeckState.deck.id}/study` : "/"}
      >
        <Play aria-hidden="true" size={21} strokeWidth={2.4} />
        Start study
      </Link>
    </section>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "primary" | "success" | "warning";
  value: number;
}) {
  const colorClass =
    tone === "success"
      ? "text-[var(--app-success)]"
      : tone === "warning"
        ? "text-[var(--app-warning)]"
        : "text-[var(--app-primary)]";

  return (
    <div className="grid min-h-28 place-items-center border-r border-[var(--app-border)] px-2 py-4 text-center last:border-r-0">
      <div>
        <p className={`text-3xl font-black ${colorClass}`}>{value}</p>
        <p className="mt-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--app-text-muted)]">
          {label}
        </p>
      </div>
    </div>
  );
}

function wasCardPracticedToday(card: Card): boolean {
  return (
    isToday(card.progress.forward.lastAnsweredAt) ||
    isToday(card.progress.reverse.lastAnsweredAt)
  );
}

function isToday(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
