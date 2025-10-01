# Flashify Deploy

Flashify is a Next.js PWA. Decks, cards, progress, settings, and cached
explanations live in the user's browser through IndexedDB. The MVP does not
need login or a database.

## Local Production Check

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

Open `http://localhost:3000`.

For phone testing on the same Wi-Fi, run:

```bash
NEXT_ALLOWED_DEV_ORIGINS=192.168.1.146 npm run dev -- --hostname 0.0.0.0
```

Replace `192.168.1.146` with the Mac's active LAN IP.

## Vercel Free Tier

1. Push `main` to GitHub.
2. Import the GitHub repository into Vercel.
3. Keep the default Next.js build settings:

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: .next
```

4. Add environment variables:

```env
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
OPENROUTER_SITE_URL=https://your-vercel-domain.vercel.app
OPENROUTER_APP_NAME=Flashify
```

`OPENROUTER_API_KEY` must stay server-side. Do not create a
`NEXT_PUBLIC_OPENROUTER_API_KEY`.

`NEXT_ALLOWED_DEV_ORIGINS` is only for local phone testing and should not be set
on Vercel.

## PWA Check After Deploy

1. Open the deployed URL.
2. Create or import a deck.
3. Open the deck detail screen and the study screen once while online.
4. Install the app from the browser.
5. Reopen the installed app.
6. Switch the device offline.
7. Reopen a previously visited screen.

Expected:

- The app shell loads.
- IndexedDB data is still available.
- Studying already stored cards works.
- AI parsing and uncached explanations may fail while offline.

## Backup

Use `Export data` before clearing browser storage, changing devices, or testing
install/uninstall flows. The exported JSON is the source format for restore.
