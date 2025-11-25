# Flashify Project Brief

Цей документ можна скопіювати в інший чат як контекст по проекту.

## Коротко

Flashify — mobile-first PWA для навчання через flashcards. Основний сценарій:
користувач створює колоди, додає текстові картки, відкриває study mode, клікає
по картці для перевороту і свайпає:

- вправо — `Know`;
- вліво — `Don't know`.

Проект орієнтований насамперед на iPhone/mobile web. Desktop підтримується для
розробки, тестування і зручного редагування.

## Поточний Технічний Стек

- Next.js 16 App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- IndexedDB для локального storage.
- PWA через manifest + custom service worker.
- OpenRouter через server-side API routes.
- Vitest для unit tests.
- Vercel free tier як цільовий hosting.

## Головні Продуктові Рішення

- MVP без логіну.
- MVP без backend database.
- Всі колоди, картки, прогрес, settings і cached explanations зберігаються в
  IndexedDB.
- Storage зроблений через abstraction layer, щоб потім можна було замінити або
  доповнити IndexedDB базою.
- OpenRouter key не має потрапляти у frontend. Він живе тільки в server env.
- Апка має працювати offline для вже збережених карток.
- AI дії online-only:
  - parse pasted text into cards;
  - generate explanation, коли ця UI-фіча буде повернута/увімкнена.
- Основна мова UI зараз English.
- Картки поки тільки text-only.

## Поточні Фічі

### Decks

- Є колоди.
- Активна колода вибирається через верхній dropdown.
- Створення нової колоди доступне з верхнього deck menu.
- У deck menu біля кожної колоди є gear/settings button для переходу на deck
  detail.
- На home screen показується інформація по активній колоді:
  - скільки карток ще треба вчити;
  - скільки практикувалось сьогодні;
  - скільки повністю learned.
- Кнопка `Start study` відкриває study screen для активної колоди.

### Deck Detail

- Manual add card.
- Edit/delete cards.
- Start study.
- Text/JSON import.
- Card list сортується так:
  - найменш вивчені вище;
  - більш вивчені нижче;
  - fully learned cards внизу.
- У списку карток є індикатор вивченості.

### Import Cards

Є два flow:

1. JSON import without AI.
2. Plain text import through OpenRouter AI parsing.

Спершу app перевіряє, чи pasted text є JSON:

- якщо JSON валідний — AI не викликається;
- якщо JSON схожий на JSON, але невалідний — показується помилка;
- якщо це не JSON — текст іде в AI parser.

Accepted JSON shape:

```json
[
  {
    "question": "cat",
    "answer": "кіт",
    "explanation": "Optional example or short explanation."
  }
]
```

Також приймається:

```json
{
  "cards": [
    {
      "question": "What is a DTO?",
      "answer": "Data Transfer Object",
      "explanation": ""
    }
  ]
}
```

`question` і `answer` required. `explanation` optional.

У deck detail є кнопка `Copy AI prompt`, яка копіює prompt для зовнішнього AI.
Prompt включає назву активної колоди як topic/context, щоб AI робив картки на
правильну тему.

Import має preview step:

- parsed cards показуються перед збереженням;
- у preview можна редагувати question/answer/explanation;
- можна видаляти окремі cards;
- якщо preview успішний, поле вводу очищається.

### Study Mode

- Одна картка на екрані.
- Tap/click по картці flip-ає question/answer.
- Swipe right = `Know`.
- Swipe left = `Don't know`.
- Є кнопки `Know` / `Don't know`.
- Keyboard controls:
  - `Space` або `Enter` — flip;
  - `ArrowRight` — know;
  - `ArrowLeft` — don't know.
- Після answer наступна карта з'являється майже миттєво:
  - поточна карта оптимістично прибирається з локальної queue;
  - IndexedDB update і pool reload ідуть у фоні.
- Анімація свайпу:
  - вправо карта зеленіє;
  - вліво карта червоніє;
  - при answer карта відлітає в сторону/вгору і зникає;
  - позаду візуально видно stack/back cards.
- Є маленька `+` кнопка на study screen для manual add card.

### Backup

У burger menu є:

- `Export data`;
- `Import data`.

Export створює JSON backup:

- version;
- exportedAt;
- settings;
- decks;
- cards;
- progress;
- review status;
- cached explanations.

Import data:

- приймає Flashify backup JSON;
- показує confirmation;
- повністю замінює локальні decks/cards/settings/progress;
- після restore повертає користувача на home.

### Theme

- Є dark/light/system theme.
- Theme toggle переміщений у burger menu.
- Dark theme підтримується, але UI polish ще може продовжуватись.

### PWA / Offline

- Є app manifest.
- Є custom `public/sw.js`.
- Service worker реєструється тільки в production.
- У dev mode service worker/cache очищаються, щоб не ловити stale behavior.
- API routes не кешуються service worker.
- Navigation має offline fallback на cached page/root app shell.
- Assets кешуються cache-first.
- IndexedDB data доступна offline.

## AI / OpenRouter

OpenRouter використовується через server-side API routes:

- `app/api/ai/parse-cards/route.ts`
- `app/api/ai/explain-card/route.ts`

Env:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Flashify
```

Important:

- `OPENROUTER_API_KEY` must stay server-side.
- Do not use `NEXT_PUBLIC_OPENROUTER_API_KEY`.
- JSON import without AI works even if OpenRouter key is missing.
- Plain text AI parsing requires OpenRouter env.

## Learning Algorithm

Config lives in `lib/domain/learning.ts`:

```ts
export const LEARNING_CONFIG = {
  ACTIVE_POOL_SIZE: 10,
  REQUIRED_STREAK_PER_DIRECTION: 2,
  FIRST_REST_DELAY_HOURS: 3,
  SECOND_REST_DELAY_HOURS: 12,
  FIRST_LONG_REVIEW_DAYS: 7,
  SECOND_LONG_REVIEW_DAYS: 30,
  WRONG_STREAK_PENALTY: 1,
} as const;
```

Core idea:

- Картка має один object, але вчиться у двох напрямках:
  - `forward`: question -> answer;
  - `reverse`: answer -> question.
- Спочатку треба набрати правильний streak у forward.
- Потім треба набрати правильний streak у reverse.
- Коли обидва напрямки мають потрібний streak, card stage complete.

Pool:

- active pool size = 10;
- у study беруться тільки relevant cards:
  - new;
  - learning;
  - resting cards where dueAt <= now;
  - review/learned cards where dueAt <= now.
- learned cards with future dueAt не вантажаться в study.

Priority:

1. overdue resting cards;
2. due review/learned cards;
3. learning cards;
4. new cards.

Stage progression:

1. Initial learning complete:
   - status `resting`;
   - reviewLevel `1`;
   - dueAt `now + 3 hours`;
   - progress reset.
2. Second stage complete:
   - status `resting`;
   - reviewLevel `2`;
   - dueAt `now + 12 hours`;
   - progress reset.
3. Third stage complete:
   - status `learned`;
   - reviewLevel `3`;
   - dueAt `now + 7 days`;
   - progress reset.
4. Long review complete:
   - status `learned`;
   - reviewLevel `4`;
   - dueAt `now + 30 days`.

Wrong answer:

- decreases current direction streak by `WRONG_STREAK_PENALTY`;
- never below zero;
- if card is learned/review and answer is wrong, it resets fully to learning:
  - status `learning`;
  - reviewLevel `0`;
  - dueAt `null`;
  - both directions reset.

## Data Model

Deck:

```ts
type Deck = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

Card:

```ts
type Card = {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  explanation: string;
  status: "new" | "learning" | "resting" | "learned" | "review";
  reviewLevel: 0 | 1 | 2 | 3 | 4;
  dueAt: string | null;
  progress: {
    forward: DirectionProgress;
    reverse: DirectionProgress;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type DirectionProgress = {
  correctStreak: number;
  mistakes: number;
  lastAnsweredAt: string | null;
};
```

## Storage

Storage abstraction:

- `lib/storage/types.ts`
- `lib/storage/indexeddb.ts`

Current implementation:

- IndexedDB database name: `flashify`.
- Stores:
  - `decks`;
  - `cards`;
  - `settings`.

Storage interface supports:

- deck CRUD;
- card CRUD;
- batch create cards;
- list study cards;
- save card progress;
- settings;
- replace all data for backup restore.

## Current Tests

Tests run with Vitest.

Covered:

- learning algorithm;
- active pool priority;
- due/learned/deleted filtering;
- card list sorting and progress indicator logic;
- JSON import parser;
- external AI JSON import shape;
- AI prompt includes deck/topic context;
- backup export/parse/restore.

Commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deploy

Target: Vercel free tier.

Local check:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

Vercel settings:

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: .next
```

Vercel env:

```env
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
OPENROUTER_SITE_URL=https://your-vercel-domain.vercel.app
OPENROUTER_APP_NAME=Flashify
```

`NEXT_ALLOWED_DEV_ORIGINS` is only for local phone testing and should not be set
on Vercel.

## Current Known Gaps / Not Fully Done

- Real production PWA test on deployed HTTPS URL still needs to be done.
- iPhone install/offline behavior still needs manual verification after deploy.
- `Tell me more` API exists, but the visible study-screen button is currently
  hidden/deprioritized.
- No login.
- No cloud sync.
- No database backend.
- No shared decks.
- No CSV import.
- No images/audio/rich cards.
- No undo in study mode yet.
- No end-of-session statistics yet.
- UI is usable, but more polish can still be done.

## Near-Term Plans

Recommended next work:

1. Push current `main` to GitHub.
2. Deploy to Vercel.
3. Add OpenRouter env vars on Vercel.
4. Test PWA install/offline on iPhone.
5. Manually test backup:
   - export data;
   - modify/delete local data;
   - import backup;
   - verify decks/cards/progress return.
6. Revisit `Tell me more` UI and decide where it belongs.
7. Add undo for last study action.
8. Add a lightweight end-of-session summary.
9. Continue mobile UI polish after real-device testing.

## Important Development Notes

- Before editing Next.js code in this project, read relevant docs in
  `node_modules/next/dist/docs/` because this Next version has breaking changes.
- Do not expose OpenRouter key to browser code.
- Prefer small, focused changes.
- Keep storage interactions behind the storage interface.
- Preserve offline-first behavior.
- Keep mobile UX as the priority.
