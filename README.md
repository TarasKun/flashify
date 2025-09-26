# Flashify

Mobile-first PWA for learning with flashcards.

This project is built with [Next.js](https://nextjs.org), TypeScript, Tailwind CSS, IndexedDB, and the App Router.

Flashify is offline-first for decks, cards, study progress, and cached explanations. AI actions run through server-side API routes so the OpenRouter key never goes into browser code.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The MVP plan lives in [`MVP_SPEC.md`](./MVP_SPEC.md).
Deployment notes live in [`DEPLOY.md`](./DEPLOY.md).

## Environment

Copy `.env.example` to `.env.local` and set:

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
npx tsc --noEmit
npm test
npm run build
```

## Deploy on Vercel

The MVP target is Vercel free tier.

Set these environment variables in the Vercel project:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`

The app stores user decks and progress in the browser through IndexedDB, so there is no database or login requirement for MVP.
