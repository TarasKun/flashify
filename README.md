# Flashify

Flashify is a mobile-first flashcard learning app built for quick daily study on a phone.

Live app: [https://flashify-eta.vercel.app/](https://flashify-eta.vercel.app/)

The app is designed around a simple flow: pick a deck, study one card at a time, swipe right when you know it, swipe left when you do not, and tap the card to flip between prompt and answer.

## What It Does

- Create multiple decks for different topics, such as English, programming, or interview prep.
- Add cards manually.
- Import cards from JSON.
- Import raw text with AI parsing through OpenRouter.
- Study cards with mobile swipe gestures.
- Flip cards by tapping them.
- Practice both directions where useful: question to answer and answer to question.
- Store explanations on cards and open them during study with `Explain more`.
- Track learning progress per card and per deck.
- Revisit cards through a simple spaced-learning flow.
- Use the app as a PWA from a phone home screen.

## Mobile-First

Flashify is primarily designed for iPhone/mobile web usage.

Desktop works for development and testing, but the main product experience is the phone layout: full-height screens, large swipeable cards, bottom controls, and PWA installation.

## Offline And Storage

Flashify is offline-first for the core study experience.

Decks, cards, progress, and cached explanations are stored locally in the browser with IndexedDB. There is no login, backend database, or cloud sync in the current MVP.

Important public note: because data is stored locally in the browser, cards and progress are tied to that browser/device. Clearing site data or switching devices can remove local data.

## AI Features

AI is used only for helper actions:

- parsing pasted study text into flashcards;
- generating explanations for cards when needed.

AI requests go through server-side Next.js API routes. The OpenRouter API key is not exposed to browser code.

Users can also skip AI completely by importing valid JSON directly.

## Import JSON Format

Flashify accepts an array of cards:

```json
[
  {
    "question": "What is a variable?",
    "answer": "A named container for storing a value in a program.",
    "explanation": "For example, let age = 25 stores the number 25 in a variable named age."
  }
]
```

`question` and `answer` are required. `explanation` is supported and recommended.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- IndexedDB
- OpenRouter API
- PWA manifest and install support
- Vercel deployment

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For testing on a phone in the same network, run the dev server on all interfaces if needed:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open the computer's local network IP address from the phone.

## Environment Variables

Create `.env.local` and set:

```env
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Flashify
```

`OPENROUTER_API_KEY` must stay server-side. Do not expose it as a `NEXT_PUBLIC_*` variable.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deployment

The current public deployment is hosted on Vercel:

[https://flashify-eta.vercel.app/](https://flashify-eta.vercel.app/)

The MVP is intended to work on the Vercel free tier. Set the OpenRouter environment variables in the Vercel project settings before using AI features in production.

## Current MVP Scope

Included now:

- local decks and cards;
- local progress tracking;
- mobile study flow;
- swipe gestures;
- card flip;
- JSON import;
- AI text parsing;
- AI/cached explanations;
- PWA install support.

Not included yet:

- user accounts;
- backend database;
- cloud sync between devices;
- shared/public decks;
- payments or subscriptions.

The code is structured so the local storage layer can be replaced or extended later with a backend database and sync layer.

## Project Notes

The product goal is not to be a heavy learning management system. Flashify is meant to be a small, fast, phone-friendly study tool for turning notes, words, and concepts into cards that can be practiced every day.

Additional planning and deployment notes:

- [MVP_SPEC.md](./MVP_SPEC.md)
- [DEPLOY.md](./DEPLOY.md)
