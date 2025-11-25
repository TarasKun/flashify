# Flashify MVP Spec

## Product Summary

Flashify is a mobile-first PWA for learning with flashcards. Users create decks, add text-only cards manually or by pasting structured text, then study cards with tap-to-flip and swipe actions.

The MVP is offline-first: decks, cards, progress, and explanations are stored locally in IndexedDB. AI is available from the start through OpenRouter, but only for online actions: parsing pasted text into cards and generating a cached explanation when the user taps "Tell me more".

## MVP Goals

- Mobile-first PWA experience.
- English-only UI for MVP.
- Deck-based organization.
- Text-only flashcards.
- Offline study mode.
- Local persistence through IndexedDB.
- Storage abstraction so IndexedDB can later be replaced or supplemented by a backend database.
- AI import through OpenRouter.
- AI explanations through "Tell me more".
- Swipe, tap-to-flip, buttons, undo, and keyboard shortcuts.
- Configurable learning algorithm with tests.

## Non-Goals For MVP

- User accounts or login.
- Cloud sync.
- Shared decks.
- Images, audio, or rich media cards.
- Tags or multi-deck card membership.
- AI generation from unstructured articles or large essays.
- Import/export files such as CSV or JSON.
- Multi-language UI.
- Per-card reverse-mode settings.

## Deployment Direction

The preferred MVP deployment target is Vercel free tier.

The app should use Next.js API routes or server actions for OpenRouter requests. The OpenRouter API key must stay server-side in an environment variable such as `OPENROUTER_API_KEY`.

Browser code must not call OpenRouter directly and must not use a public API key such as `NEXT_PUBLIC_OPENROUTER_API_KEY`.

## Tech Direction

- Next.js with App Router.
- TypeScript.
- Simple, common styling approach, likely Tailwind CSS.
- UI library is acceptable, likely shadcn/ui if it keeps development simple.
- Framer Motion is acceptable for swipe/flip interactions.
- IndexedDB for local persistence.
- PWA support for installability and offline study.
- Unit tests for the learning algorithm.

## Core Screens

### Home / Decks

- Shows all decks.
- Allows creating a new deck.
- Shows basic deck progress, for example `22/40`.
- Includes a dark mode toggle.

### Deck Detail

- Shows deck name and cards.
- Allows starting study mode.
- Allows manual card creation.
- Allows text import through AI parsing.
- Allows editing and deleting any card.

### Manual Card Form

- Fields:
  - `question`
  - `answer`
- `explanation` is not required and is empty by default.

### AI Import

- User pastes text into a textarea.
- AI parses the text into card objects.
- MVP does not need a review/preview step before saving.
- AI should not invent extra cards from unrelated text in MVP.
- AI should preserve the supplied meaning and structure.

Example input:

```text
What is a DTO?
DTO means Data Transfer Object. It defines the shape of data sent between client and server.
Why are DTOs used?
They make request data explicit, typed, and easier to validate.
```

Expected parsed shape:

```json
[
  {
    "question": "What is a DTO?",
    "answer": "DTO means Data Transfer Object. It defines the shape of data sent between client and server.",
    "explanation": ""
  },
  {
    "question": "Why are DTOs used?",
    "answer": "They make request data explicit, typed, and easier to validate.",
    "explanation": ""
  }
]
```

### Study Mode

- Shows one card at a time.
- Tap card to flip between the two sides.
- User may answer before flipping.
- Swipe right means "Know".
- Swipe left means "Don't know".
- Buttons should also exist on mobile and desktop.
- Undo should restore the previous action.
- No end-of-session stats are required in MVP.
- Progress should be visible as learned/total, for example `22/40`.

### Tell Me More

- Button label: `Tell me more`.
- If `explanation` exists, show the saved explanation.
- If `explanation` is empty:
  - call the AI explanation endpoint;
  - ask for a 3-5 sentence explanation;
  - save the result into the card's `explanation`;
  - show the saved result.

## Data Model Draft

### Deck

```ts
type Deck = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

### Card

```ts
type Card = {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  explanation: string;
  status: CardStatus;
  reviewLevel: ReviewLevel;
  dueAt: string | null;
  progress: CardProgress;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type CardStatus = "new" | "learning" | "resting" | "learned" | "review";
type ReviewLevel = 0 | 1 | 2 | 3 | 4;
```

### Direction Progress

Each card is one object, but it is studied in two directions.

```ts
type StudyDirection = "forward" | "reverse";

type CardProgress = {
  forward: DirectionProgress;
  reverse: DirectionProgress;
};

type DirectionProgress = {
  correctStreak: number;
  mistakes: number;
  lastAnsweredAt: string | null;
};
```

Direction meanings:

- `forward`: question -> answer.
- `reverse`: answer -> question.

The UI does not need to show a reverse badge in MVP.

## Storage Model

IndexedDB stores:

- decks;
- cards;
- card progress;
- cached AI explanations;
- app settings such as dark mode.

The app should access storage through an interface rather than calling IndexedDB directly from UI components.

Example interface:

```ts
interface FlashifyStorage {
  listDecks(): Promise<Deck[]>;
  createDeck(input: CreateDeckInput): Promise<Deck>;
  updateDeck(id: string, input: UpdateDeckInput): Promise<Deck>;
  deleteDeck(id: string): Promise<void>;

  listCardsForDeck(deckId: string): Promise<Card[]>;
  listDueCardsForDeck(deckId: string, now: Date): Promise<Card[]>;
  createCard(input: CreateCardInput): Promise<Card>;
  createCards(inputs: CreateCardInput[]): Promise<Card[]>;
  updateCard(id: string, input: UpdateCardInput): Promise<Card>;
  saveCardProgress(card: Card): Promise<Card>;
}
```

For study mode, the app should load only cards that can matter now:

- `new`;
- `learning`;
- `resting` with `dueAt <= now`;
- `review` with `dueAt <= now`.

It should not load:

- learned cards whose future review date has not arrived;
- deleted cards.

## Learning Algorithm

### Tunable Constants

```ts
const ACTIVE_POOL_SIZE = 10;
const REQUIRED_STREAK_PER_DIRECTION = 2;
const FIRST_REST_DELAY_HOURS = 3;
const SECOND_REST_DELAY_HOURS = 12;
const FIRST_LONG_REVIEW_DAYS = 7;
const SECOND_LONG_REVIEW_DAYS = 30;
const WRONG_STREAK_PENALTY = 1;
```

### Pool Selection

The active pool has up to 10 cards.

When there is room in the active pool, cards are selected in this priority:

1. overdue resting cards where `dueAt <= now`;
2. due review cards where `dueAt <= now`;
3. cards already in learning;
4. new cards.

Cards that are learned but not due for review are ignored.

### Study Flow

1. A new card enters the active pool.
2. The user studies `forward`: question -> answer.
3. The user studies `reverse`: answer -> question.
4. A card completes the current stage only when both directions reach `REQUIRED_STREAK_PER_DIRECTION`.
5. A wrong answer reduces the current direction streak by `WRONG_STREAK_PENALTY`, without going below zero.
6. A wrong card goes to the end of the active queue.
7. A correct card also leaves the current position and is reinserted according to the queue rules.

### Stage Progression

When both directions reach the required streak:

1. From `new` or initial `learning`:
   - reset both direction streaks;
   - set status to `resting`;
   - set `reviewLevel = 1`;
   - set `dueAt = now + 3 hours`.
2. From `reviewLevel = 1`:
   - reset both direction streaks;
   - keep status `resting`;
   - set `reviewLevel = 2`;
   - set `dueAt = now + 12 hours`.
3. From `reviewLevel = 2`:
   - reset both direction streaks;
   - set status to `learned`;
   - set `reviewLevel = 3`;
   - set `dueAt = now + 7 days`.
4. From `reviewLevel = 3`:
   - reset both direction streaks;
   - keep status `learned`;
   - set `reviewLevel = 4`;
   - set `dueAt = now + 30 days`.
5. From `reviewLevel = 4`:
   - keep status `learned`;
   - set next review date using the current long-review strategy. MVP may reuse 30 days.

### Failed Review

If a learned or review card is answered incorrectly, it returns fully to the beginning:

- status becomes `learning`;
- `reviewLevel = 0`;
- both direction streaks reset to zero;
- `dueAt = null`.

## Undo

Undo should restore the previous study state after the last swipe/button action.

The simplest MVP approach is to keep a local history stack of recent study state snapshots in memory during study mode. Persisted IndexedDB state should be updated to match after undo.

## Keyboard Controls

Keyboard controls are useful for desktop testing and should be included if they stay simple:

- `Space` or `Enter`: flip card.
- `ArrowRight`: Know.
- `ArrowLeft`: Don't know.
- `Backspace` or `Cmd+Z`: undo.

## AI Endpoints

### Parse Cards

Endpoint example:

```text
POST /api/ai/parse-cards
```

Input:

```ts
type ParseCardsRequest = {
  text: string;
};
```

Output:

```ts
type ParseCardsResponse = {
  cards: Array<{
    question: string;
    answer: string;
    explanation: "";
  }>;
};
```

Rules:

- Parse only the supplied text.
- Do not generate unrelated cards.
- Keep the full answer in `answer`.
- Always return `explanation` as an empty string.

### Explain Card

Endpoint example:

```text
POST /api/ai/explain-card
```

Input:

```ts
type ExplainCardRequest = {
  question: string;
  answer: string;
};
```

Output:

```ts
type ExplainCardResponse = {
  explanation: string;
};
```

Rules:

- Return 3-5 clear sentences.
- Explain the answer in beginner-friendly language.
- Do not change the card's question or answer.

## Testing Plan

The learning algorithm should be tested separately from React UI.

Important test cases:

- Correct answer increments the current direction streak.
- Wrong answer reduces the current direction streak without going below zero.
- A card is not completed until both directions reach the required streak.
- Completing both directions moves the card to the 3-hour rest stage.
- Completing the next stage moves the card to the 12-hour rest stage.
- Completing the next stage marks the card learned and schedules the 7-day review.
- Completing the 7-day review schedules the 30-day review.
- A failed learned/review card resets fully to learning.
- Active pool selection prioritizes due cards over new cards.
- Learned cards that are not due are not loaded for study.
- Undo restores the previous card progress and queue state.

## Task Breakdown

1. Scaffold Next.js app with TypeScript.
2. Add styling setup and base mobile-first layout.
3. Add PWA manifest and offline shell.
4. Define domain types for decks, cards, progress, and algorithm constants.
5. Implement learning algorithm as pure TypeScript functions.
6. Add unit tests for the learning algorithm.
7. Implement IndexedDB storage adapter behind a storage interface.
8. Build deck list and deck creation.
9. Build deck detail screen.
10. Build manual create/edit/delete card flows.
11. Build study mode with flip, buttons, swipe, undo, and keyboard controls.
12. Add OpenRouter-backed parse cards API route.
13. Add textarea import flow.
14. Add OpenRouter-backed explain card API route.
15. Add `Tell me more` flow with explanation caching.
16. Polish mobile UI and dark mode.
17. Verify PWA install/offline behavior.
18. Prepare Vercel deployment settings.
