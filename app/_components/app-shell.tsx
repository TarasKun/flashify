import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="app-screen min-h-dvh text-[var(--app-text)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(0.875rem+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-14 shrink-0 place-items-center rounded-full border border-white/70 bg-white/80 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10">
              <Menu aria-hidden="true" size={24} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-normal">
                Flashify
              </h1>
              <p className="mt-0.5 text-sm font-semibold text-[var(--app-text-muted)]">
                Mobile Flashcard App
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="mt-6 flex-1">{children}</div>
      </div>
    </main>
  );
}
