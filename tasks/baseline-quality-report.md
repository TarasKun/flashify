# Baseline Quality Report
## Date

2026-07-12

## Branch

`codex/cloud-sync-and-assistant`

## Automated Checks

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | ESLint completed with no output. |
| `npm run typecheck` | Passed | `tsc --noEmit` completed successfully. |
| `npm run test` | Passed | 5 test files, 28 tests. |
| `npm run build` | Passed | Next.js 16.2.10 production build completed successfully. |

The production build includes the expected PWA routes and assets:

- `/manifest.webmanifest`
- `/icon.png`
- `/apple-icon.png`
- dynamic OpenRouter API routes
- deck detail and study routes

## Mobile Smoke Check

Environment:

- Local development server: `http://127.0.0.1:3000`
- Browser viewport: 390 x 844
- Initial state: no local decks

Observed:

- The home app shell rendered the first-deck state.
- The deck name field, create button, deck selector, and settings button were
  present in the accessibility tree.
- The browser console had no errors or warnings.
- The automated in-app browser could fill the deck field but did not propagate
  the input value to the React submit-button state. A subsequent DOM click
  attempt failed in the browser automation bridge, so a complete automated
  study swipe check was not possible in this baseline run.

Manual follow-up required before the first IndexedDB schema migration:

1. On a physical iPhone or normal desktop browser, create a deck and card.
2. Open study mode, flip a card, swipe in both directions, and confirm the
   next card is immediate.
3. Install/open the PWA and repeat the study check offline.

## Backup and Restore Baseline

The existing unit suite exercises both export structure and restore behavior:

- exports settings, decks, and cards;
- parses a valid backup JSON payload;
- rejects a card linked to the wrong deck;
- restores backup data through `replaceAllData`.

The browser file-picker restore flow needs a physical-device/manual check before
an IndexedDB schema migration. No production or user data was modified for this
report.

## Baseline Failures

No application lint, type, unit test, or production build failures were found.
The only limitation is the in-app browser automation bridge described above.
