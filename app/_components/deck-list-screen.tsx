"use client";

import { Check, Play, Plus } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { Card, Deck } from "@/lib/domain";
import { createIndexedDbStorage, type DeckProgress } from "@/lib/storage";

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
  const [newDeckName, setNewDeckName] = useState("");
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);

  const loadDecks = useCallback(async () => {
    const decks = await storage.listDecks();
    const savedDeckId = window.localStorage.getItem(ACTIVE_DECK_STORAGE_KEY);
    const activeDeck =
      decks.find((deck) => deck.id === savedDeckId) ?? decks[0] ?? null;

    if (!activeDeck) {
      setActiveDeckState(null);
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
  }, [storage]);

  async function createFirstDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newDeckName.trim();

    if (!name || isCreatingDeck) {
      return;
    }

    setIsCreatingDeck(true);

    try {
      const deck = await storage.createDeck({ name });

      setNewDeckName("");
      saveActiveDeckId(deck.id);
      await loadDecks();
    } finally {
      setIsCreatingDeck(false);
    }
  }

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
  const practicedCount =
    activeDeckState?.cards.filter((card) => wasCardPracticed(card))
      .length ?? 0;
  const learnedCount = activeDeckState?.progress.learned ?? 0;

  if (!activeDeckState) {
    return (
      <section className="flex h-full min-h-0 flex-col justify-center gap-5 pb-[12dvh]">
        <section className="rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--app-primary-soft)] text-[var(--app-primary)]">
            <Plus aria-hidden="true" size={23} strokeWidth={2.4} />
          </div>
          <h1 className="mt-4 text-2xl font-black">Create your first deck</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--app-text-muted)]">
            Add a deck for words, concepts, or anything you want to practice.
          </p>
          <form className="mt-5 grid gap-3" onSubmit={createFirstDeck}>
            <input
              className="h-12 rounded-full border border-[var(--app-border)] bg-white/70 px-4 text-center text-base font-semibold outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
              onChange={(event) => setNewDeckName(event.target.value)}
              placeholder="Deck name"
              value={newDeckName}
            />
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-4 font-black text-[var(--app-primary-contrast)] disabled:opacity-50"
              disabled={!newDeckName.trim() || isCreatingDeck}
              type="submit"
            >
              <Check aria-hidden="true" size={18} strokeWidth={2.3} />
              {isCreatingDeck ? "Creating" : "Create deck"}
            </button>
          </form>
        </section>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-5 pb-[12dvh]">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mt-auto grid grid-cols-3 overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)]">
          <Metric label="To learn" tone="primary" value={activeCardsCount} />
          <Metric
            label="Practiced"
            tone="success"
            value={practicedCount}
          />
          <Metric label="Learned" tone="warning" value={learnedCount} />
        </div>
      </section>

      <Link
        aria-disabled={!activeDeckState}
        className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-5 text-base font-black uppercase tracking-[0.08em] text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
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

function wasCardPracticed(card: Card): boolean {
  return (
    Boolean(card.progress.forward.lastAnsweredAt) ||
    Boolean(card.progress.reverse.lastAnsweredAt)
  );
}

function saveActiveDeckId(deckId: string) {
  window.localStorage.setItem(ACTIVE_DECK_STORAGE_KEY, deckId);
  window.dispatchEvent(
    new CustomEvent(ACTIVE_DECK_CHANGE_EVENT, {
      detail: {
        deckId,
      },
    }),
  );
}
