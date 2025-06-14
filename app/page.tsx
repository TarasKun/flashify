import { ArrowRight, FileInput, Plus, Sparkles } from "lucide-react";
import { AppShell } from "./_components/app-shell";

const deckCards = [
  {
    name: "English basics",
    progress: "22/40",
    percentage: "55%",
    due: "8 due",
  },
  {
    name: "Programming fundamentals",
    progress: "6/24",
    percentage: "25%",
    due: "12 due",
  },
];

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-5">
        <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--app-text-muted)]">
                Today
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">
                28 cards due
              </h2>
            </div>
            <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--app-text-muted)]">
              22/64
            </span>
          </div>

          <button
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-primary)] px-4 text-base font-semibold text-[var(--app-primary-contrast)]"
            type="button"
          >
            Start study
            <ArrowRight aria-hidden="true" size={19} strokeWidth={2.4} />
          </button>
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
            <h2 className="text-lg font-semibold">Decks</h2>
            <button
              className="grid size-9 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]"
              type="button"
              aria-label="Create deck"
              title="Create deck"
            >
              <Plus aria-hidden="true" size={18} strokeWidth={2.3} />
            </button>
          </div>

          <div className="grid gap-3">
            {deckCards.map((deck) => (
              <article
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                key={deck.name}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold">{deck.name}</h3>
                    <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                      {deck.progress} learned
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--app-text-muted)]">
                    {deck.due}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--app-primary)]"
                    style={{ width: deck.percentage }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <button
          className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 font-semibold text-[var(--app-text)]"
          type="button"
        >
          <Sparkles aria-hidden="true" size={19} strokeWidth={2.3} />
          Tell me more
        </button>
      </section>
    </AppShell>
  );
}
