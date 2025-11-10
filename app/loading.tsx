export default function Loading() {
  return (
    <main className="app-screen grid h-dvh w-full place-items-center px-6 text-[var(--app-text)]">
      <section className="grid w-full max-w-sm gap-5 text-center">
        <div
          aria-hidden="true"
          className="mx-auto size-16 rounded-[1.25rem] bg-cover bg-center shadow-[var(--app-shadow-soft)]"
          style={{ backgroundImage: 'url("/icons/flashify-icon-192.png")' }}
        />
        <div>
          <h1 className="text-3xl font-black tracking-normal">Flashify</h1>
          <p className="mt-2 text-sm font-semibold text-[var(--app-text-muted)]">
            Loading your cards
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--app-primary-soft)]">
          <div className="h-full w-1/2 rounded-full bg-[var(--app-primary)] opacity-80" />
        </div>
      </section>
    </main>
  );
}
