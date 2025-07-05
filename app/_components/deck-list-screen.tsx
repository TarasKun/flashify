"use client";

import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Deck, EntityId } from "@/lib/domain";
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
  const [newDeckName, setNewDeckName] = useState("");
  const [editingDeckId, setEditingDeckId] = useState<EntityId | null>(null);
  const [editingDeckName, setEditingDeckName] = useState("");

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

  async function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newDeckName.trim();

    if (!name) {
      return;
    }

    await storage.createDeck({ name });
    setNewDeckName("");
    await loadDecks();
  }

  function startEditing(deck: Deck) {
    setEditingDeckId(deck.id);
    setEditingDeckName(deck.name);
  }

  async function saveDeckName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingDeckId) {
      return;
    }

    const name = editingDeckName.trim();

    if (!name) {
      return;
    }

    await storage.updateDeck(editingDeckId, { name });
    setEditingDeckId(null);
    setEditingDeckName("");
    await loadDecks();
  }

  async function deleteDeck(deck: Deck) {
    const shouldDelete = window.confirm(`Delete "${deck.name}"?`);

    if (!shouldDelete) {
      return;
    }

    await storage.deleteDeck(deck.id);
    await loadDecks();
  }

  const learnedTotal = items.reduce(
    (sum, item) => sum + item.progress.learned,
    0,
  );
  const cardsTotal = items.reduce((sum, item) => sum + item.progress.total, 0);
  const dueTotal = items.reduce((sum, item) => sum + item.dueCount, 0);

  return (
    <section className="grid gap-5">
      <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--app-text-muted)]">
              Today
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">
              {isLoading ? "Loading decks" : `${dueTotal} cards due`}
            </h2>
          </div>
          <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--app-text-muted)]">
            {learnedTotal}/{cardsTotal}
          </span>
        </div>

        <Link
          aria-disabled={!items[0]}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-primary)] px-4 text-base font-semibold text-[var(--app-primary-contrast)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
          href={items[0] ? `/decks/${items[0].deck.id}/study` : "/"}
        >
          <Play aria-hidden="true" size={19} strokeWidth={2.4} />
          Start study
        </Link>
      </section>

      <section>
        <form
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
          onSubmit={createDeck}
        >
          <label
            className="text-sm font-medium text-[var(--app-text-muted)]"
            htmlFor="new-deck-name"
          >
            New deck
          </label>
          <div className="mt-2 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-base outline-none focus:border-[var(--app-primary)]"
              id="new-deck-name"
              onChange={(event) => setNewDeckName(event.target.value)}
              placeholder="Deck name"
              value={newDeckName}
            />
            <button
              aria-label="Create deck"
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--app-primary)] text-[var(--app-primary-contrast)]"
              type="submit"
            >
              <Plus aria-hidden="true" size={21} strokeWidth={2.4} />
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Decks</h2>
          <span className="text-sm font-medium text-[var(--app-text-muted)]">
            {items.length}
          </span>
        </div>

        <div className="grid gap-3">
          {items.map((item) => {
            const progressPercent =
              item.progress.total > 0
                ? `${Math.round((item.progress.learned / item.progress.total) * 100)}%`
                : "0%";

            return (
              <article
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                key={item.deck.id}
              >
                {editingDeckId === item.deck.id ? (
                  <form className="grid gap-3" onSubmit={saveDeckName}>
                    <input
                      className="h-11 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-base outline-none focus:border-[var(--app-primary)]"
                      onChange={(event) =>
                        setEditingDeckName(event.target.value)
                      }
                      value={editingDeckName}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="h-10 rounded-lg bg-[var(--app-primary)] px-3 text-sm font-semibold text-[var(--app-primary-contrast)]"
                        type="submit"
                      >
                        Save
                      </button>
                      <button
                        className="h-10 rounded-lg border border-[var(--app-border)] px-3 text-sm font-semibold"
                        onClick={() => setEditingDeckId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        className="min-w-0 flex-1"
                        href={`/decks/${item.deck.id}`}
                      >
                        <h3 className="truncate text-base font-semibold">
                          {item.deck.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                          {item.progress.learned}/{item.progress.total} learned
                        </p>
                      </Link>
                      <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--app-text-muted)]">
                        {item.dueCount} due
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--app-primary)]"
                        style={{ width: progressPercent }}
                      />
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        aria-label={`Rename ${item.deck.name}`}
                        className="grid size-10 place-items-center rounded-full border border-[var(--app-border)] text-[var(--app-text-muted)]"
                        onClick={() => startEditing(item.deck)}
                        title="Rename"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={17} strokeWidth={2.2} />
                      </button>
                      <button
                        aria-label={`Delete ${item.deck.name}`}
                        className="grid size-10 place-items-center rounded-full border border-[var(--app-border)] text-[var(--app-danger)]"
                        onClick={() => deleteDeck(item.deck)}
                        title="Delete"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={17} strokeWidth={2.2} />
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
