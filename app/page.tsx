export default function Home() {
  return (
    <main className="min-h-dvh bg-[var(--app-bg)] px-4 py-5 text-[var(--app-text)]">
      <section className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--app-text-muted)]">
              Mobile study deck
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">Flashify</h1>
          </div>
          <button
            className="h-11 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-medium shadow-sm"
            type="button"
          >
            Dark
          </button>
        </header>

        <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">English basics</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                22/40 learned
              </p>
            </div>
            <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--app-text-muted)]">
              Due
            </span>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
            <div className="h-full w-[55%] rounded-full bg-[var(--app-primary)]" />
          </div>

          <button
            className="mt-5 h-12 w-full rounded-lg bg-[var(--app-primary)] px-4 text-base font-semibold text-[var(--app-primary-contrast)]"
            type="button"
          >
            Start study
          </button>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button
            className="h-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left font-medium"
            type="button"
          >
            Add card
          </button>
          <button
            className="h-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left font-medium"
            type="button"
          >
            Import text
          </button>
        </section>
      </section>
    </main>
  );
}
