"use client";

import {
  ArrowLeft,
  ChevronDown,
  Download,
  Menu,
  Plus,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Deck } from "@/lib/domain";
import {
  createIndexedDbStorage,
  exportFlashifyData,
  parseFlashifyBackupJson,
  restoreFlashifyData,
  seedDemoData,
} from "@/lib/storage";
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
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [dataTransferMessage, setDataTransferMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [isExportingData, setIsExportingData] = useState(false);
  const [isImportingData, setIsImportingData] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

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

  const deckNavigation = getDeckNavigation(pathname);
  const isStudyRoute = /^\/decks\/[^/]+\/study$/.test(pathname);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!isDeckMenuOpen && !isAppMenuOpen) {
        return;
      }

      if (event.target instanceof HTMLElement) {
        if (
          controlsRef.current?.contains(event.target) ||
          event.target.closest("[data-app-control]")
        ) {
          return;
        }
      }

      setIsDeckMenuOpen(false);
      setIsAppMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setIsDeckMenuOpen(false);
      setIsAppMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAppMenuOpen, isDeckMenuOpen]);

  function selectDeck(deckId: string) {
    setActiveDeckId(deckId);
    saveActiveDeckId(deckId);
    setIsDeckMenuOpen(false);
    setIsAppMenuOpen(false);

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
    setIsAppMenuOpen(false);
    setActiveDeckId(deck.id);
    saveActiveDeckId(deck.id);
    await loadDecks();

    if (pathname !== "/") {
      router.push("/");
    }
  }

  async function exportData() {
    if (isExportingData) {
      return;
    }

    setExportError("");
    setDataTransferMessage("");
    setIsExportingData(true);

    try {
      const data = await exportFlashifyData(storage);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `flashify-backup-${getDateStamp(new Date())}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDataTransferMessage("Backup exported.");
    } catch {
      setExportError("Export failed.");
    } finally {
      setIsExportingData(false);
    }
  }

  async function importBackupFile(file: File) {
    if (isImportingData) {
      return;
    }

    const shouldRestore = window.confirm(
      "Importing a backup will replace all local decks, cards, progress, and settings. Continue?",
    );

    if (!shouldRestore) {
      return;
    }

    setExportError("");
    setDataTransferMessage("");
    setIsImportingData(true);

    try {
      const backup = parseFlashifyBackupJson(await file.text());

      if (!backup) {
        throw new Error("Invalid Flashify backup file.");
      }

      await restoreFlashifyData(storage, backup);
      await loadDecks();
      setDataTransferMessage("Backup imported.");

      if (pathname !== "/") {
        router.push("/");
      }
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Import failed.",
      );
    } finally {
      setIsImportingData(false);

      if (backupInputRef.current) {
        backupInputRef.current.value = "";
      }
    }
  }

  return (
    <main className="app-screen relative h-dvh w-full max-w-full overflow-hidden text-[var(--app-text)]">
      <div
        className={`flex h-dvh w-full max-w-full flex-col overflow-hidden pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.875rem+env(safe-area-inset-top))] ${
          isStudyRoute ? "px-7" : "px-4"
        }`}
      >
        <header
          data-app-control
          className="relative grid h-16 grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3"
          ref={controlsRef}
        >
          {deckNavigation ? (
            <Link
              aria-label={deckNavigation.ariaLabel}
              className={`flex h-11 items-center justify-center justify-self-start rounded-full text-sm font-black text-[var(--app-text-muted)] transition hover:text-[var(--app-text)] ${
                deckNavigation.label && !isStudyRoute ? "gap-1.5 px-3" : "w-11"
              }`}
              href={deckNavigation.href}
            >
              <ArrowLeft aria-hidden="true" size={isStudyRoute ? 26 : 18} strokeWidth={2.5} />
              {deckNavigation.label && !isStudyRoute ? deckNavigation.label : null}
            </Link>
          ) : (
            <span aria-hidden="true" className="h-12 w-[5.5rem]" />
          )}
          {isStudyRoute ? (
            <span aria-hidden="true" />
          ) : (
            <button
              aria-expanded={isDeckMenuOpen}
              aria-label="Select deck"
              className="mx-auto grid size-12 place-items-center rounded-full text-[var(--app-text-muted)]"
              onClick={() => {
                setIsAppMenuOpen(false);
                setIsDeckMenuOpen((currentValue) => !currentValue);
              }}
              type="button"
            >
              <ChevronDown
                aria-hidden="true"
                className={`transition ${
                  isDeckMenuOpen ? "rotate-180" : ""
                }`}
                size={24}
                strokeWidth={2.5}
              />
            </button>
          )}
          <span aria-hidden="true" />

          {isAppMenuOpen ? (
            <div
              className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-7 right-7 z-30 grid gap-3 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow)]"
            >
              <input
                ref={backupInputRef}
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    void importBackupFile(file);
                  }
                }}
                type="file"
              />
              <div className="flex items-center justify-between rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-4 py-3">
                <span className="text-xs font-black text-[var(--app-text-muted)]">
                  Theme
                </span>
                <ThemeToggle />
              </div>
              <button
                className="flex h-12 items-center justify-between rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-4 text-left text-xs font-black text-[var(--app-text)] disabled:opacity-60"
                disabled={isExportingData}
                onClick={exportData}
                type="button"
              >
                <span>{isExportingData ? "Exporting" : "Export data"}</span>
                <Download aria-hidden="true" size={18} strokeWidth={2.3} />
              </button>
              <button
                className="flex h-12 items-center justify-between rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-4 text-left text-xs font-black text-[var(--app-text)] disabled:opacity-60"
                disabled={isImportingData}
                onClick={() => backupInputRef.current?.click()}
                type="button"
              >
                <span>{isImportingData ? "Importing" : "Import data"}</span>
                <Upload aria-hidden="true" size={18} strokeWidth={2.3} />
              </button>
              {dataTransferMessage ? (
                <p className="rounded-[var(--app-radius-sm)] border border-[var(--app-success)] bg-[var(--app-success-soft)] p-3 text-sm font-bold text-[var(--app-success)]">
                  {dataTransferMessage}
                </p>
              ) : null}
              {exportError ? (
                <p className="rounded-[var(--app-radius-sm)] border border-[var(--app-danger)] bg-[var(--app-danger-soft)] p-3 text-sm font-bold text-[var(--app-danger)]">
                  {exportError}
                </p>
              ) : null}
            </div>
          ) : null}

          {isDeckMenuOpen && !isStudyRoute ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 grid gap-3 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow)]">
              <form className="flex gap-2" onSubmit={createDeck}>
                <input
                  className="h-11 min-w-0 flex-1 rounded-full border border-[var(--app-border)] bg-white/70 px-4 text-xs font-semibold outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
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
                  <div className="flex items-center gap-2" key={deck.id}>
                    <button
                      className={`min-w-0 flex-1 rounded-[var(--app-radius-sm)] px-4 py-3 text-left text-xs font-black transition hover:bg-[var(--app-primary-soft)] ${
                        deck.id === activeDeckId
                          ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
                          : ""
                      }`}
                      onClick={() => selectDeck(deck.id)}
                      type="button"
                    >
                      <span className="block truncate">{deck.name}</span>
                    </button>
                    <Link
                      aria-label={`Open ${deck.name} deck settings`}
                      className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--app-border)] bg-white/70 text-[var(--app-text-muted)] transition hover:text-[var(--app-primary)] dark:bg-white/10"
                      href={`/decks/${deck.id}`}
                      onClick={() => {
                        setIsDeckMenuOpen(false);
                        setIsAppMenuOpen(false);
                      }}
                    >
                      <Settings aria-hidden="true" size={17} strokeWidth={2.3} />
                    </Link>
                  </div>
                ))}
              </nav>
            </div>
          ) : null}
        </header>

        <div
          className={`mt-6 min-h-0 flex-1 overflow-x-hidden ${
            isStudyRoute ? "overflow-y-visible" : "overflow-y-auto"
          }`}
        >
          {children}
        </div>
      </div>
      <button
        data-app-control
        aria-expanded={isAppMenuOpen}
        aria-label="Open menu"
        className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-7 z-30 grid size-12 place-items-center rounded-full border border-white/80 bg-white/86 text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10"
        onClick={() => {
          setIsDeckMenuOpen(false);
          setIsAppMenuOpen((currentValue) => !currentValue);
        }}
        type="button"
      >
        <Menu aria-hidden="true" size={22} strokeWidth={2.3} />
      </button>
    </main>
  );
}

function getDeckNavigation(
  pathname: string,
): { href: string; ariaLabel: string; label?: string } | null {
  const studyMatch = pathname.match(/^\/decks\/([^/]+)\/study$/);

  if (studyMatch?.[1]) {
    return {
      href: "/",
      ariaLabel: "Back to home",
    };
  }

  const deckMatch = pathname.match(/^\/decks\/([^/]+)$/);

  if (deckMatch?.[1]) {
    return {
      href: "/",
      ariaLabel: "Back to home",
    };
  }

  return null;
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

function getDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}
