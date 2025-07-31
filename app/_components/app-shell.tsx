"use client";

import { ChevronDown, Menu, Plus } from "lucide-react";
import Link from "next/link";
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

  const loadDecks = useCallback(async () => {
    await seedDemoData(storage);
    setDecks(await storage.listDecks());
  }, [storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDecks();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDecks, pathname]);

  async function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newDeckName.trim();

    if (!name) {
      return;
    }

    const deck = await storage.createDeck({ name });

    setNewDeckName("");
    setIsDeckMenuOpen(false);
    await loadDecks();
    router.push(`/decks/${deck.id}`);
  }

  return (
    <main className="app-screen min-h-dvh text-[var(--app-text)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(0.875rem+env(safe-area-inset-top))]">
        <header className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-expanded={isDeckMenuOpen}
              aria-label="Open decks"
              className="grid size-14 shrink-0 place-items-center rounded-full border border-white/70 bg-white/80 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10"
              onClick={() =>
                setIsDeckMenuOpen((currentValue) => !currentValue)
              }
              type="button"
            >
              <Menu aria-hidden="true" size={24} strokeWidth={2.3} />
            </button>
            <div className="min-w-0">
              <button
                className="flex max-w-full items-center gap-1.5 text-left"
                onClick={() =>
                  setIsDeckMenuOpen((currentValue) => !currentValue)
                }
                type="button"
              >
                <span className="truncate text-2xl font-black tracking-normal">
                  Flashify
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`shrink-0 transition ${
                    isDeckMenuOpen ? "rotate-180" : ""
                  }`}
                  size={18}
                  strokeWidth={2.5}
                />
              </button>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--app-text-muted)]">
                {decks.length > 0 ? `${decks.length} decks` : "No decks yet"}
              </p>
            </div>
          </div>
          <ThemeToggle />

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
                  <Link
                    className="rounded-[var(--app-radius-sm)] px-4 py-3 text-sm font-black transition hover:bg-[var(--app-primary-soft)]"
                    href={`/decks/${deck.id}`}
                    key={deck.id}
                    onClick={() => setIsDeckMenuOpen(false)}
                  >
                    {deck.name}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}
        </header>

        <div className="mt-6 flex-1">{children}</div>
      </div>
    </main>
  );
}
