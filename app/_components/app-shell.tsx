"use client";

import { ChevronDown, Menu, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Deck } from "@/lib/domain";
import { createIndexedDbStorage, seedDemoData } from "@/lib/storage";
import { ThemeToggle } from "./theme-toggle";

const ACTIVE_DECK_STORAGE_KEY = "flashify.activeDeckId";
const ACTIVE_DECK_CHANGE_EVENT = "flashify:active-deck-change";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isDeckMenuOpen, setIsDeckMenuOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    await seedDemoData(storage);
    const nextDecks = await storage.listDecks();
    const savedDeckId = window.localStorage.getItem(ACTIVE_DECK_STORAGE_KEY);
    const nextActiveDeck =
      nextDecks.find((deck) => deck.id === savedDeckId) ?? nextDecks[0] ?? null;

    setDecks(nextDecks);
    setActiveDeckId(nextActiveDeck?.id ?? null);

    if (nextActiveDeck && nextActiveDeck.id !== savedDeckId) {
      saveActiveDeckId(nextActiveDeck.id);
    }
  }, [storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDecks();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDecks, pathname]);

  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null;

  function selectDeck(deckId: string) {
    setActiveDeckId(deckId);
    saveActiveDeckId(deckId);
    setIsDeckMenuOpen(false);

    if (pathname !== "/") {
      router.push("/");
    }
  }

  async function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newDeckName.trim();

    if (!name) {
      return;
    }

    const deck = await storage.createDeck({ name });

    setNewDeckName("");
    setIsDeckMenuOpen(false);
    setActiveDeckId(deck.id);
    saveActiveDeckId(deck.id);
    await loadDecks();

    if (pathname !== "/") {
      router.push("/");
    }
  }

  return (
    <main className="app-screen h-dvh overflow-hidden text-[var(--app-text)]">
      <div className="flex h-dvh w-full flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.875rem+env(safe-area-inset-top))]">
        <header className="relative grid h-16 grid-cols-[3.5rem_1fr_3.5rem] items-center gap-3">
          <ThemeToggle />
          <button
            aria-expanded={isDeckMenuOpen}
            className="mx-auto flex min-w-0 max-w-full items-center justify-center gap-2 rounded-full px-3 py-2 text-center"
            onClick={() =>
              setIsDeckMenuOpen((currentValue) => !currentValue)
            }
            type="button"
          >
            <span className="truncate text-2xl font-black tracking-normal">
              {activeDeck?.name ?? "Flashify"}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`shrink-0 text-[var(--app-text-muted)] transition ${
                isDeckMenuOpen ? "rotate-180" : ""
              }`}
              size={20}
              strokeWidth={2.5}
            />
          </button>
          <button
            aria-expanded={isDeckMenuOpen}
            aria-label="Open decks"
            className="grid size-12 place-items-center justify-self-end rounded-full border border-white/70 bg-white/80 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10"
            onClick={() =>
              setIsDeckMenuOpen((currentValue) => !currentValue)
            }
            type="button"
          >
            <Menu aria-hidden="true" size={22} strokeWidth={2.3} />
          </button>

          {isDeckMenuOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 grid gap-3 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow)]">
              <form className="flex gap-2" onSubmit={createDeck}>
                <input
                  className="h-11 min-w-0 flex-1 rounded-full border border-[var(--app-border)] bg-white/70 px-4 text-sm font-semibold outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
                  onChange={(event) => setNewDeckName(event.target.value)}
                  placeholder="New deck"
                  value={newDeckName}
                />
                <button
                  aria-label="Create deck"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)] disabled:opacity-50"
                  disabled={!newDeckName.trim()}
                  type="submit"
                >
                  <Plus aria-hidden="true" size={19} strokeWidth={2.5} />
                </button>
              </form>

              <nav className="grid max-h-72 gap-1 overflow-y-auto">
                {decks.map((deck) => (
                  <button
                    className={`rounded-[var(--app-radius-sm)] px-4 py-3 text-left text-sm font-black transition hover:bg-[var(--app-primary-soft)] ${
                      deck.id === activeDeckId
                        ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
                        : ""
                    }`}
                    key={deck.id}
                    onClick={() => selectDeck(deck.id)}
                    type="button"
                  >
                    {deck.name}
                  </button>
                ))}
              </nav>
            </div>
          ) : null}
        </header>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </main>
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
