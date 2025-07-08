import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-dvh bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_88%,transparent)] p-3 shadow-sm backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-sm">
              <BookOpen aria-hidden="true" size={22} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--app-text-muted)]">
                Study deck
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
    </main>
  );
}
