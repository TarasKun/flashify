# PWA Offline Checklist

Flashify registers the service worker only in production builds. Use this flow
when verifying installability and offline study behavior.

## Local Production Check

1. Build the app.

```bash
npm run build
```

2. Start a production server.

```bash
npx next start -p 3001
```

3. Open `http://localhost:3001`.
4. Visit the home screen, a deck detail screen, and a study screen.
5. Reload once while online so the active service worker controls the page.
6. Stop the production server or switch the browser to offline mode.
7. Reload the visited study URL.

Expected result:

- The app shell still loads.
- Previously visited deck and study pages can reload from cache.
- IndexedDB decks, cards, and progress are still available.
- Studying existing local cards still works.

## Online-Only Actions

These actions are expected to fail while offline:

- AI text import.
- `Tell me more` when the card does not already have a cached explanation.

If a card already has an explanation saved in IndexedDB, `Tell me more` should
show the cached explanation without making a network request.

## Deployment Check

After deploying to Vercel, repeat the same flow on the deployed URL and confirm
the browser offers app installability.
