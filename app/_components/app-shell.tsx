import {
  BookOpen,
  Brain,
  Home,
  Import,
  Layers3,
  Plus,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  {
    label: "Decks",
    icon: Home,
    active: true,
  },
  {
    label: "Study",
    icon: Brain,
    active: false,
  },
  {
    label: "Import",
    icon: Import,
    active: false,
  },
  {
    label: "Cards",
    icon: Layers3,
    active: false,
  },
];

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-dvh bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-sm">
              <BookOpen aria-hidden="true" size={22} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--app-text-muted)]">
                Flashcards
              </p>
              <h1 className="truncate text-3xl font-semibold tracking-normal">
                Flashify
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="mt-6 flex-1">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-[repeat(4,minmax(0,1fr))_3.5rem] items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                aria-current={item.active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium ${
                  item.active
                    ? "bg-[var(--app-surface-muted)] text-[var(--app-text)]"
                    : "text-[var(--app-text-muted)]"
                }`}
                key={item.label}
                type="button"
              >
                <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            aria-label="Add"
            className="grid size-14 place-items-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-[var(--app-shadow)]"
            title="Add"
            type="button"
          >
            <Plus aria-hidden="true" size={26} strokeWidth={2.3} />
          </button>
        </div>
      </nav>
    </main>
  );
}
