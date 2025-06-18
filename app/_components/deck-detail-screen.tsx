"use client";

import {
  ArrowLeft,
  FileInput,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Card, Deck } from "@/lib/domain";
import { createIndexedDbStorage, type DeckProgress } from "@/lib/storage";

type DeckDetailScreenProps = {
  deckId: string;
};

export function DeckDetailScreen({ deckId }: DeckDetailScreenProps) {
  const router = useRouter();
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [progress, setProgress] = useState<DeckProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deckName, setDeckName] = useState("");

  const loadDeck = useCallback(async () => {
    setIsLoading(true);
    const nextDeck = await storage.getDeck(deckId);

    if (!nextDeck) {
      setDeck(null);
      setCards([]);
      setProgress(null);
      setIsLoading(false);
      return;
    }

    const [nextCards, nextProgress] = await Promise.all([
      storage.listCardsForDeck(deckId),
      storage.getDeckProgress(deckId),
    ]);

    setDeck(nextDeck);
    setDeckName(nextDeck.name);
    setCards(nextCards);
    setProgress(nextProgress);
    setIsLoading(false);
  }, [deckId, storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDeck();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDeck]);

  async function renameDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = deckName.trim();

    if (!deck || !name) {
      return;
    }

    await storage.updateDeck(deck.id, { name });
    setIsEditing(false);
    await loadDeck();
  }

  async function deleteDeck() {
    if (!deck) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${deck.name}"?`);

    if (!shouldDelete) {
      return;
    }

    await storage.deleteDeck(deck.id);
    router.push("/");
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p className="text-sm font-medium text-[var(--app-text-muted)]">
          Loading deck
        </p>
      </section>
    );
  }

  if (!deck) {
    return (
      <section className="grid gap-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p className="font-semibold">Deck not found</p>
        <Link
          className="flex h-11 items-center justify-center rounded-lg bg-[var(--app-primary)] px-4 font-semibold text-[var(--app-primary-contrast)]"
          href="/"
        >
          Back to decks
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <Link
        className="flex w-fit items-center gap-2 text-sm font-semibold text-[var(--app-text-muted)]"
        href="/"
      >
        <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.3} />
        Decks
      </Link>

      <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)]">
        {isEditing ? (
          <form className="grid gap-3" onSubmit={renameDeck}>
            <input
              className="h-12 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-xl font-semibold outline-none focus:border-[var(--app-primary)]"
              onChange={(event) => setDeckName(event.target.value)}
              value={deckName}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="h-11 rounded-lg bg-[var(--app-primary)] px-3 font-semibold text-[var(--app-primary-contrast)]"
                type="submit"
              >
                Save
              </button>
              <button
                className="h-11 rounded-lg border border-[var(--app-border)] px-3 font-semibold"
                onClick={() => setIsEditing(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--app-text-muted)]">
                  Deck
                </p>
                <h2 className="mt-1 truncate text-2xl font-semibold">
                  {deck.name}
                </h2>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  aria-label="Rename deck"
                  className="grid size-10 place-items-center rounded-full border border-[var(--app-border)] text-[var(--app-text-muted)]"
                  onClick={() => setIsEditing(true)}
                  title="Rename deck"
                  type="button"
                >
                  <Pencil aria-hidden="true" size={17} strokeWidth={2.2} />
                </button>
                <button
                  aria-label="Delete deck"
                  className="grid size-10 place-items-center rounded-full border border-[var(--app-border)] text-[var(--app-danger)]"
                  onClick={deleteDeck}
                  title="Delete deck"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {progress?.learned ?? 0}/{progress?.total ?? 0} learned
            </p>

            <button
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-primary)] px-4 text-base font-semibold text-[var(--app-primary-contrast)]"
              type="button"
            >
              <Play aria-hidden="true" size={19} strokeWidth={2.4} />
              Start study
            </button>
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          className="flex h-24 flex-col justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left font-medium"
          type="button"
        >
          <Plus aria-hidden="true" size={22} strokeWidth={2.3} />
          <span>Add card</span>
        </button>
        <button
          className="flex h-24 flex-col justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left font-medium"
          type="button"
        >
          <FileInput aria-hidden="true" size={22} strokeWidth={2.3} />
          <span>Import text</span>
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Cards</h3>
          <span className="text-sm font-medium text-[var(--app-text-muted)]">
            {cards.length}
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-sm text-[var(--app-text-muted)]">
            No cards yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {cards.map((card) => (
              <article
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                key={card.id}
              >
                <h4 className="line-clamp-2 font-semibold">{card.question}</h4>
                <p className="mt-2 line-clamp-2 text-sm text-[var(--app-text-muted)]">
                  {card.answer}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
