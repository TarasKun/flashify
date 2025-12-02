# Implementation Plan: Accounts, Sync, Inline Editing, and Assistant Shell

## 1. Purpose

This plan turns the current local-only Flashify PWA into an authenticated,
local-first application with cloud synchronization while preserving the current
study experience.

It is written as an execution contract for a lower-capability model. Do not
redesign the architecture while implementing individual tasks. If a requirement
is unclear or conflicts with the current code, stop and ask the user instead of
guessing.

## 2. Current State

- Next.js 16 App Router frontend at the repository root.
- React 19, TypeScript, Tailwind CSS 4.
- IndexedDB accessed through `FlashifyStorage`.
- Mobile-first PWA, primarily tested on iPhone.
- Current deployment: <https://flashify-eta.vercel.app/>.
- OpenRouter calls live in Next.js server routes.
- No current authentication, backend database, or cloud sync.
- Existing user data must remain valid after every IndexedDB migration.

Relevant existing files:

- `lib/domain/types.ts`
- `lib/domain/algorithm.ts`
- `lib/domain/learning.ts`
- `lib/storage/types.ts`
- `lib/storage/indexeddb.ts`
- `app/_components/study-session-screen.tsx`
- `app/_components/deck-detail-screen.tsx`
- `app/api/ai/explain-card/route.ts`

## 3. Non-Negotiable Product Rules

1. The phone/PWA experience is the primary target.
2. Study mode remains fully usable offline.
3. A swipe updates IndexedDB immediately and never waits for the backend.
4. IndexedDB remains the frontend's immediate source of truth after login.
5. Supabase is used for Google Auth and hosted PostgreSQL.
6. NestJS is the only API for Flashify-owned cloud data.
7. The frontend must not query Supabase deck/card/chat tables directly.
8. Guest mode persists on the same device but has no multi-device sync.
9. Card content editing never resets learning progress.
10. Both `know` and `dontKnow` create unique study events.
11. Explanation output is 4-5 meaningful sentences and at most 500 characters.
12. Explanation text is fully visible; do not add an inner scroll area.
13. Each card has a persistent chat history.
14. The first assistant implementation returns placeholder text only.
15. Logout is blocked until pending authenticated changes synchronize.
16. Backend/auth/sync work must stay on `codex/cloud-sync-and-assistant` until
    the user explicitly requests a merge.

## 4. Scope

### Included

- Inline study-card editing.
- Explanation prompt and display changes.
- Card/deck/import size validation.
- Persistent placeholder assistant chat UI.
- Google authentication through Supabase Auth.
- Local guest identity.
- NestJS REST API in `flashify-api/`.
- Prisma schema and migrations for app-owned tables.
- IndexedDB outbox and sync metadata.
- Batch push and cursor-based pull synchronization.
- Multi-device synchronization of decks, cards, progress, and chat history.
- Blocking final sync before logout.
- Unit, integration, contract, and browser tests proportional to risk.

### Explicitly Not Included

- Email/password or magic-link authentication.
- Apple login.
- Roles, teams, deck sharing, or public decks.
- Payments or subscriptions.
- Realtime WebSocket synchronization.
- Background push notifications.
- A real assistant model or streaming chat response.
- Moving existing OpenRouter routes to NestJS.
- Direct frontend CRUD through Supabase generated APIs.
- Rich media cards, audio, or images.
- Solving the native iOS `Undo Paste` / `Shake to Undo` popup with unsupported
  browser hacks. The app may document the iOS setting, but web code cannot
  reliably disable the system popup.

## 5. Target Repository Shape

```text
flashify/
|-- app/                         # existing Next.js app
|-- lib/                         # existing frontend domain/storage
|-- public/
|-- flashify-api/                # new NestJS application
|   |-- prisma/
|   |-- src/
|   `-- test/
|-- packages/
|   `-- contracts/               # dependency-light shared API schemas/types
|-- supabase/                    # local Supabase CLI config/migrations metadata
|-- docs/
|-- tasks/
`-- package.json
```

Do not move the current Next.js application into `apps/web` during this phase.
That migration has no product value and would create unnecessary deployment and
PWA risk.

## 6. Runtime Architecture

```text
iPhone / browser
  |
  |-- UI reads/writes IndexedDB immediately
  |     |-- decks
  |     |-- cards + progress snapshot
  |     |-- chat threads/messages
  |     |-- outbox operations
  |     `-- sync cursor and identity metadata
  |
  |-- Supabase SDK -> Google login and access token
  |
  `-- Bearer token -> NestJS REST API
                           |
                           |-- verify Supabase JWT/JWKS
                           |-- validate request contracts
                           |-- apply idempotent operations
                           |-- update canonical snapshots
                           `-- Prisma -> Supabase PostgreSQL
```

## 7. Data Model Draft

All IDs are UUID strings. Client-created entities keep their client-generated
IDs when uploaded.

### `users`

- `id`: Supabase user UUID, primary key.
- `email`: current verified email from token.
- `displayName`: nullable.
- `avatarUrl`: nullable.
- `createdAt`, `updatedAt`, `lastSeenAt`.

NestJS upserts this row from a verified Supabase token. Do not let the client
choose another user ID.

### `devices`

- `id`: client-generated UUID.
- `userId`.
- `name`: optional human-readable device label.
- `createdAt`, `lastSeenAt`.

IndexedDB also stores the next monotonic `deviceSequence`. Incrementing this
counter and writing an outbox operation must happen in the same transaction.

### `decks`

- Existing fields: `id`, `name`, `createdAt`, `updatedAt`.
- Cloud fields: `userId`, `version`, `deletedAt`.

### `cards`

- Existing card fields remain compatible.
- Add `userId` and integer `version` on the server.
- Store `progress` as JSONB initially to match the frontend domain type.
- Keep `status`, `reviewLevel`, and `dueAt` as queryable columns.
- Keep `deletedAt` as a tombstone.
- Editing `question`, `answer`, or `explanation` does not modify progress.

### `study_events`

- `id`: unique client operation UUID.
- `userId`, `deviceId`, `deckId`, `cardId`.
- `direction`: `forward` or `reverse`.
- `answer`: `know` or `dontKnow`.
- `deviceSequence`: strictly increasing integer for this device.
- `answeredAt`: client timestamp for ordering/display.
- `receivedAt`: server timestamp.
- Unique constraint on `(userId, id)` for idempotency.
- Unique constraint on `(userId, deviceId, deviceSequence)` as an additional
  ordering/idempotency guard.

### `chat_threads`

- `id`, `userId`, `cardId`, `createdAt`, `updatedAt`, `deletedAt`.
- One active thread per `(userId, cardId)`.

### `chat_messages`

- `id`, `userId`, `threadId`, `cardId`.
- `role`: `user` or `assistant`.
- `content`.
- `createdAt`, `receivedAt`, `deletedAt`.
- Messages are append-only in the first version.

### `sync_changes`

- Monotonic `sequence` generated by PostgreSQL.
- `userId`, `entityType`, `entityId`, `operationId`.
- `changeType`: `upsert` or `delete`.
- `createdAt`.

This table supports `pull changes after cursor`. It is not exposed directly.

## 8. Validation Constants

Keep these limits in shared, named constants. Do not scatter numeric limits
through components and controllers.

| Field | Limit | Behavior |
| --- | ---: | --- |
| Deck name | 80 characters | Reject and show remaining/maximum count |
| Card question | 500 characters | Reject before local save/import |
| Card answer | 1,500 characters | Reject before local save/import |
| Card explanation | 500 characters | Reject before local save/import |
| Import source text | 50,000 characters | Reject before JSON/AI parsing |
| Cards per import | 200 cards | Reject oversized batch |
| Chat user message | 2,000 characters | Reject before local save |
| Chat history per API request | 50 recent messages | Older history reserved for future summary |

These are first-version constants and may be tuned later without redesigning
the validation boundary.

## 9. Explanation Contract

- Prompt: request exactly 4-5 meaningful beginner-friendly sentences.
- Maximum result length: 500 characters including spaces.
- Content must add context, a practical example, a common mistake, or an
  important distinction.
- Content must not merely restate the answer.
- The UI displays the complete explanation with no inner scrollbar.
- Validate responses from OpenRouter as untrusted input.
- If the model exceeds 500 characters, do not silently persist an oversized
  result. Perform one shortening attempt; if it still exceeds the limit, return
  a structured error and leave the existing explanation unchanged.

## 10. Assistant Interaction Contract

### UI

- A centered bottom handle with an upward chevron is visible in study mode.
- Tap or upward drag opens a full-height bottom sheet.
- Downward drag closes it.
- Tap on the backdrop/outside the chat closes it.
- There is no half-open snap point.
- Card swipe and card flip gestures are disabled while chat is open.
- Existing card content remains visible behind the sheet only as a backdrop.

### Persistence

- One thread per card.
- User and placeholder assistant messages are persisted immediately to
  IndexedDB.
- Messages enter the same sync outbox as other cloud entities.
- History is restored after route changes and app restarts.
- History synchronizes between authenticated devices.

### Provider Boundary

Define an interface equivalent to:

```ts
type AssistantContext = {
  deckName: string;
  question: string;
  answer: string;
  explanation: string;
  direction: "forward" | "reverse";
  visibleSide: "prompt" | "answer";
  progress: CardProgress;
  messages: ChatMessage[];
};

interface AssistantProvider {
  reply(input: {
    context: AssistantContext;
    message: string;
  }): Promise<{ content: string }>;
}
```

The placeholder provider returns fixed text but must use the same asynchronous
interface that the future network provider will implement.

## 11. Authentication Flow

### First launch without a session

1. Show `Continue with Google` and `Continue as guest`.
2. Guest creates or reuses a local guest identity.
3. Google login is handled by Supabase Auth.
4. The frontend passes the resulting access token to NestJS.
5. NestJS verifies it and upserts the public `users` row.

### Guest converts to Google account

1. Keep all guest data in IndexedDB during OAuth redirect.
2. After login, call bootstrap for the authenticated account.
3. If the server account is empty, upload the complete guest snapshot.
4. If the server account already has data, upload guest entities as new UUID
   entities and then pull the canonical account state.
5. Do not merge decks by name.
6. After successful sync, reassign the local dataset to the authenticated
   identity and remove the old guest namespace.

### Logout

1. Disable new writes temporarily.
2. Flush the complete outbox.
3. Pull and apply remaining server changes.
4. Confirm the outbox is empty.
5. Sign out through Supabase.
6. Clear or isolate authenticated local data according to the unresolved logout
   privacy decision in Section 18.
7. Show the authentication choice screen.

If the device is offline or sync fails, remain logged in and show a retryable
error. Do not discard the outbox.

## 12. Sync Protocol Draft

Use two endpoints initially.

### `GET /v1/sync/bootstrap`

Returns a paginated full account snapshot for first login/new device recovery:

- decks including tombstones if needed;
- cards including progress snapshots;
- chat threads and messages;
- latest cursor.

### `POST /v1/sync`

Request:

```ts
type SyncRequest = {
  deviceId: string;
  cursor: string | null;
  operations: SyncOperation[];
  pageSize?: number;
};
```

Response:

```ts
type SyncResponse = {
  acceptedOperationIds: string[];
  rejectedOperations: Array<{
    operationId: string;
    code: string;
    message: string;
  }>;
  changes: SyncChange[];
  nextCursor: string;
  hasMore: boolean;
};
```

Supported operation kinds:

- `deck.create`
- `deck.patch`
- `deck.delete`
- `card.create`
- `card.patch`
- `card.delete`
- `study.answer`
- `chat.thread.create`
- `chat.message.create`

Every operation includes:

- `id`: idempotency UUID;
- `deviceSequence`: strictly increasing integer scoped to the device;
- `entityId` where applicable;
- `clientCreatedAt`;
- `baseVersion` for mutable entity patches;
- a kind-specific payload.

Server rules:

- Process a batch in a transaction where practical.
- Replaying an accepted operation returns it as accepted and makes no duplicate
  mutation.
- Never trust `userId` from the payload; derive it from the verified token.
- Return structured errors with stable machine-readable codes.
- Limit batch size to 100 operations.
- Limit pull page size to 500 changes.

## 13. Flush Policy

The frontend sync coordinator owns all network scheduling.

Flush after:

- five pending study events;
- deck/card create;
- deck/card edit;
- deck/card delete;
- chat message creation when online (debounced briefly);
- successful login;
- browser `online` event;
- app returns to foreground;
- user leaves study mode;
- logout.

Do not create a request after every swipe. A timer may flush old pending events
after 30 seconds while the app is active so a user who studies fewer than five
cards is still backed up.

## 14. Conflict Policy

- Study events and chat messages are append-only and merge by unique ID.
- Create operations are idempotent by entity ID and operation ID.
- Patches update only supplied fields.
- Different fields changed on different devices merge.
- Same-field conflicts use the last server-accepted operation for version one.
- The server returns the canonical entity after a conflict.
- The client applies the canonical entity but keeps a local diagnostic record
  until the operation is acknowledged.
- Deletion wins over an older patch.
- Do not compare device clocks to decide the winner.
- Preserve `deviceSequence` order for operations from the same device. For
  concurrent offline operations from different devices, server acceptance
  order is canonical in the first version.
- Do not merge separate decks based on equal names.

## 15. Execution Rules for Agents

1. Implement no more than three numbered tasks per user-approved batch.
2. Keep each task independently verifiable.
3. Read relevant Next.js 16 documentation from `node_modules/next/dist/docs/`
   before changing Next.js APIs or conventions.
4. Preserve unrelated user changes and untracked files.
5. Do not merge to `main` or push unless the user explicitly requests it.
6. Do not expose Supabase service keys or OpenRouter keys to browser code.
7. Do not replace the existing learning algorithm while implementing sync.
8. Do not call remote APIs from React components except through a dedicated
   client/provider boundary.
9. Stop and ask when an unresolved decision affects data loss, authentication,
   conflict resolution, or public API behavior.
10. After every task batch run the task-specific tests plus frontend lint,
    typecheck, tests, and build when relevant.

## 16. Task Breakdown

### Phase A: Planning and Safety Baseline

#### Task 1: Record architecture and implementation plan

**Description:** Add this plan, the execution checklist, and ADR-001 without
changing runtime behavior.

**Acceptance criteria:**

- Architecture decisions and non-goals are explicit.
- Every implementation task has dependencies and verification.
- Existing MVP documents are identified as historical where they conflict.

**Verification:** Review Markdown links and `git diff --check`.

**Dependencies:** None.

**Estimated scope:** S, documentation only.

#### Task 2: Establish baseline quality report

**Description:** Record current lint, typecheck, unit test, build, PWA, and key
mobile browser results before changing architecture.

**Acceptance criteria:**

- Existing failures are separated from new work.
- A mobile study smoke test is documented.
- IndexedDB backup/restore is exercised before schema migration work.

**Verification:** `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run build`, browser smoke test.

**Dependencies:** Task 1.

**Estimated scope:** S.

### Phase B: Frontend Validation and Study Editing

#### Task 3: Add shared frontend content limits

**Description:** Create named validation constants and pure validation functions
for deck names, cards, import source, import batch size, and chat messages.

**Acceptance criteria:**

- Limits match Section 8.
- Existing valid data remains readable.
- Unit tests cover boundaries, whitespace, and over-limit values.

**Verification:** Focused validation tests plus frontend test suite.

**Dependencies:** Task 2.

**Estimated scope:** S, 2-3 files.

#### Task 4: Apply card limits to existing write paths

**Description:** Use the validation functions in manual add, edit, JSON import,
AI import preview, and study-screen quick add.

**Acceptance criteria:**

- Invalid content is rejected before IndexedDB writes.
- The UI shows a precise English error.
- Valid JSON import still bypasses OpenRouter.

**Verification:** Import tests and manual add/edit browser checks.

**Dependencies:** Task 3.

**Estimated scope:** M, 3-5 files.

#### Task 5: Update the explanation contract

**Description:** Change the OpenRouter prompt, response validation, and study UI
to enforce 4-5 meaningful sentences and a 500-character hard maximum.

**Acceptance criteria:**

- Existing cached explanations still render.
- New explanations are at most 500 characters.
- The complete explanation is visible without an inner scrollbar.
- One shortening attempt handles oversized model output.

**Verification:** Route tests, prompt tests, mobile visual check with 500
characters.

**Dependencies:** Task 3.

**Estimated scope:** M, 3-5 files.

#### Checkpoint B1

- All frontend checks pass.
- JSON import and cached explanation still work offline.
- User reviews explanation layout on iPhone-sized viewport.

#### Task 6: Add inline card-edit control

**Description:** Add a small semi-transparent gray gear in the card's upper-right
corner and an edit surface for question, answer, and explanation.

**Acceptance criteria:**

- Gear styling matches thumbs controls and does not dominate the card.
- Save updates the currently displayed card immediately.
- Cancel makes no change.
- Editing content preserves status, review level, due date, and progress.

**Verification:** Component interaction test and manual forward/reverse study
check.

**Dependencies:** Tasks 4 and 5.

**Estimated scope:** M, 3-5 files.

#### Task 7: Verify native iOS Undo Paste behavior

**Description:** Reproduce the popup on Safari/PWA and record that it is the
system `Shake to Undo` behavior. Do not add unsupported motion, clipboard, or
undo interception hacks.

**Acceptance criteria:**

- Reproduction steps are documented.
- App paste handling does not perform duplicate programmatic edits.
- User-facing troubleshooting notes point to the iOS accessibility setting if
  documentation is desired.

**Verification:** Physical iPhone check.

**Dependencies:** Task 2.

**Estimated scope:** XS/S.

### Phase C: Persistent Placeholder Assistant

#### Task 8: Define chat domain types and provider interface

**Description:** Add dependency-free chat/thread/message types, assistant
context construction, and the asynchronous provider interface.

**Acceptance criteria:**

- Context contains all fields from Section 10.
- Placeholder provider returns deterministic text.
- Context/provider tests do not depend on React or IndexedDB.

**Verification:** Focused unit tests.

**Dependencies:** Task 3.

**Estimated scope:** S.

#### Task 9: Extend the storage interface for chat

**Description:** Add chat thread/message operations to `FlashifyStorage` without
adding sync behavior yet.

**Acceptance criteria:**

- One thread is reused per card.
- Messages preserve stable UUIDs and ordering.
- Existing storage consumers still compile.

**Verification:** Storage contract tests.

**Dependencies:** Task 8.

**Estimated scope:** S.

#### Task 10: Migrate IndexedDB for chat data

**Description:** Increment the IndexedDB version and add chat stores/indexes
without clearing decks/cards/settings.

**Acceptance criteria:**

- Upgrade from the current database keeps all existing data.
- Thread lookup by card and message lookup by thread are indexed.
- Reopening the app restores chat messages.

**Verification:** IndexedDB migration test plus manual upgrade using a populated
database.

**Dependencies:** Task 9.

**Estimated scope:** M.

#### Checkpoint C1

- Backup is taken before migration testing.
- Existing decks/cards/progress survive migration.
- Chat storage tests pass.

#### Task 11: Build the assistant bottom sheet

**Description:** Add the closed/full bottom sheet, centered handle, tap/drag
interaction, backdrop dismissal, message list, and input.

**Acceptance criteria:**

- Tap or upward drag opens the sheet.
- Downward drag or outside tap closes it.
- There is no half-open state.
- Card gestures are disabled while open.
- Safe areas and keyboard viewport work on iPhone.

**Verification:** Component tests and mobile browser interaction test.

**Dependencies:** Tasks 8 and 10.

**Estimated scope:** M.

#### Task 12: Connect placeholder chat persistence

**Description:** Save the user's message, call the placeholder provider, save
the assistant response, and restore the thread on revisit.

**Acceptance criteria:**

- Messages remain after route change and reload.
- Each card has an independent thread.
- Failed provider responses retain the user message and show a retryable error.

**Verification:** Integration test covering two cards and reload.

**Dependencies:** Task 11.

**Estimated scope:** M.

### Phase D: Backend and Shared Contracts

#### Task 13: Add repository workspaces and shared contracts package

**Description:** Add `packages/contracts` and minimal npm workspace configuration
without relocating the Next.js app.

**Acceptance criteria:**

- Frontend build remains unchanged.
- Contracts package can be consumed by frontend and future NestJS app.
- Runtime schemas validate unknown request/response data.

**Verification:** Frontend install, typecheck, tests, and build.

**Dependencies:** Checkpoint C1.

**Estimated scope:** M.

#### Task 14: Scaffold the NestJS API

**Description:** Create `flashify-api/` with NestJS, default Express adapter,
configuration validation, lint/typecheck/test/build scripts, and `/health`.

**Acceptance criteria:**

- API starts independently.
- `/health` returns a stable typed response.
- No database or Supabase secret is required for the unit test suite.

**Verification:** API lint, typecheck, tests, build, and health request.

**Dependencies:** Task 13.

**Estimated scope:** M.

#### Task 15: Configure local Supabase development

**Description:** Add Supabase CLI configuration, documented Docker prerequisites,
environment templates, and separate local/deployed configuration.

**Acceptance criteria:**

- Local Supabase starts through Docker.
- Secrets are excluded from git.
- Frontend and API environment contracts are documented.
- Do not add a second competing PostgreSQL container.
- Prisma is the sole migration owner for Flashify tables in `public`; do not
  duplicate those migrations through Supabase CLI.

**Verification:** Start/stop local stack and connect with a database client.

**Dependencies:** Task 14.

**Estimated scope:** M.

#### Task 16: Add Prisma and the initial schema

**Description:** Add Prisma to NestJS and model users, devices, decks, cards,
study events, chat data, and sync changes.

**Acceptance criteria:**

- Schema matches Section 7.
- Migration applies to local Supabase PostgreSQL.
- Unique/idempotency and ownership indexes exist.
- Supabase-managed auth tables are not modified by Prisma migrations.

**Verification:** Reset local database, apply migration, inspect generated
schema, run repository tests.

**Dependencies:** Task 15.

**Estimated scope:** M.

#### Checkpoint D1

- Frontend still builds.
- API builds and health check works.
- Local Supabase and Prisma migration work from clean state.
- No secret is present in `git diff`.

### Phase E: Authentication

#### Task 17: Add Supabase Auth client and auth gate

**Description:** Add Google login, persistent session restoration, guest entry,
and a loading state that does not flash the wrong app state.

**Acceptance criteria:**

- User can choose Google or guest.
- Guest identity persists across app launches.
- Existing local users are not forced to lose data.
- UI remains English and mobile-first.

**Verification:** Auth component tests, guest reload test, Google login manual
test on localhost and deployed preview.

**Dependencies:** Task 15.

**Estimated scope:** M.

#### Task 18: Verify Supabase tokens in NestJS

**Description:** Add a global or route-level guard that verifies Supabase JWTs
through the project's JWKS and exposes a typed authenticated principal.

**Acceptance criteria:**

- Missing, expired, malformed, and wrong-project tokens return structured 401.
- Protected handlers never trust a payload `userId`.
- Verification keys are cached safely.

**Verification:** Unit tests with valid/invalid signed test tokens and API
integration tests.

**Dependencies:** Tasks 14 and 15.

**Estimated scope:** M.

#### Task 19: Add current-user bootstrap endpoint

**Description:** Upsert the public user/device records after verified login and
return the account identity required by sync.

**Acceptance criteria:**

- Repeated bootstrap is idempotent.
- Email/name/avatar updates do not create duplicate users.
- Device ownership is enforced.

**Verification:** API integration tests against local PostgreSQL.

**Dependencies:** Tasks 16 and 18.

**Estimated scope:** S/M.

### Phase F: Cloud CRUD Before Sync

#### Task 20: Implement deck repository and protected REST endpoints

**Description:** Add owned deck create/list/patch/delete behavior with validation,
versions, and tombstones.

**Acceptance criteria:**

- Users cannot access another user's deck.
- Delete is idempotent and soft.
- Responses follow shared contracts and structured errors.

**Verification:** Repository and API integration tests.

**Dependencies:** Tasks 16, 18, and 19.

**Estimated scope:** M.

#### Task 21: Implement card repository and protected REST endpoints

**Description:** Add card create/list/patch/delete behavior while preserving
progress on content edits.

**Acceptance criteria:**

- Ownership is enforced through deck and user.
- Shared content limits are enforced server-side.
- Content patch never resets progress.
- Delete is idempotent and soft.

**Verification:** Repository/API tests including edit-with-progress case.

**Dependencies:** Task 20.

**Estimated scope:** M.

#### Task 22: Implement chat repository endpoints

**Description:** Add thread lookup/creation and append-only message persistence
for authenticated users.

**Acceptance criteria:**

- One active thread exists per user/card.
- Message UUID replay does not duplicate content.
- Cross-user card/thread access is rejected.

**Verification:** API integration tests.

**Dependencies:** Task 21.

**Estimated scope:** M.

#### Checkpoint F1

- Authenticated CRUD works through NestJS.
- Frontend still does not call cloud CRUD directly.
- Ownership/security test suite passes.

### Phase G: Local Outbox

#### Task 23: Define sync operation contracts

**Description:** Implement runtime schemas for Section 12 operations, requests,
responses, cursors, and structured errors.

**Acceptance criteria:**

- Unknown operation kinds and extra unsafe fields are rejected.
- All operations have UUID, timestamp, and kind-specific payload validation.
- Contract tests run in frontend and backend workspaces.

**Verification:** Shared contract tests.

**Dependencies:** Tasks 13 and 21.

**Estimated scope:** M.

#### Task 24: Add outbox and sync metadata to IndexedDB

**Description:** Add operation records, account/device namespace, cursor, retry
metadata, and acknowledged-operation cleanup.

**Acceptance criteria:**

- Existing user data survives migration.
- Pending operations survive app restart.
- Guest and authenticated namespaces cannot see each other's data accidentally.
- Device sequence increments atomically with operation creation.

**Verification:** IndexedDB migration and persistence tests.

**Dependencies:** Tasks 10, 17, and 23.

**Estimated scope:** M.

#### Task 25: Make local writes outbox-aware

**Description:** Extend the storage implementation so cloud-relevant local
writes atomically create an outbox operation in the same IndexedDB transaction.

**Acceptance criteria:**

- Deck/card CRUD and chat messages enqueue operations.
- Study answers enqueue unique `study.answer` events.
- A failed local transaction writes neither entity nor operation.
- UI behavior remains instant and offline.

**Verification:** Storage transaction tests and study latency smoke test.

**Dependencies:** Task 24.

**Estimated scope:** M.

### Phase H: Server Sync Engine

#### Task 26: Implement idempotent operation ingestion

**Description:** Add `POST /v1/sync` push processing, ownership checks,
idempotency, transaction boundaries, and stable rejection codes.

**Acceptance criteria:**

- Replayed operations produce no duplicates.
- One user's operations cannot mutate another user's entities.
- Accepted and rejected IDs are explicit.
- Batch size is limited to 100.

**Verification:** Integration tests including replay and mixed valid/invalid
batches.

**Dependencies:** Tasks 22, 23, and 25.

**Estimated scope:** M.

#### Task 27: Apply study events to canonical card progress

**Description:** Store each answer event once and update the canonical card
snapshot using the existing learning algorithm semantics.

**Acceptance criteria:**

- `know` and `dontKnow` both affect canonical state correctly.
- Duplicate event IDs have no second effect.
- Events from two devices are not lost.
- Backend algorithm contract tests match frontend fixtures.

**Verification:** Cross-runtime learning fixtures and database integration tests.

**Dependencies:** Task 26.

**Estimated scope:** M.

#### Task 28: Implement cursor-based pull and bootstrap

**Description:** Add full bootstrap and incremental change retrieval with
pagination and monotonic server cursors.

**Acceptance criteria:**

- A new device can rebuild the complete account state.
- Incremental pull returns only changes after the cursor.
- Tombstones propagate.
- Pagination cannot skip or duplicate changes.

**Verification:** Bootstrap and multi-page cursor integration tests.

**Dependencies:** Tasks 26 and 27.

**Estimated scope:** M.

#### Task 29: Implement initial conflict rules

**Description:** Apply field-level patches, versions, deletion precedence, and
canonical conflict responses from Section 14.

**Acceptance criteria:**

- Different-field edits merge.
- Same-field conflict resolves deterministically.
- Device clocks do not determine the winner.
- Progress events remain append-only regardless of content conflicts.

**Verification:** Two-device conflict integration tests.

**Dependencies:** Task 28.

**Estimated scope:** M.

#### Checkpoint H1

- Replay, conflict, tombstone, bootstrap, and pagination tests pass.
- Database state is deterministic after two-device scenarios.
- API OpenAPI/contract documentation matches runtime behavior.

### Phase I: Frontend Sync Coordinator

#### Task 30: Add authenticated API client

**Description:** Add one client boundary that obtains the Supabase access token,
calls NestJS, validates responses, and maps structured errors.

**Acceptance criteria:**

- React components do not construct auth headers themselves.
- 401 triggers session handling, not silent data deletion.
- Network and validation failures are distinguishable.

**Verification:** API client unit tests with mocked responses.

**Dependencies:** Tasks 18, 23, and 28.

**Estimated scope:** S/M.

#### Task 31: Implement push/pull orchestration

**Description:** Send pending operations, remove acknowledgements, pull changes,
apply them to IndexedDB, and advance the cursor safely.

**Acceptance criteria:**

- Failed requests leave the outbox intact.
- Cursor advances only after local application succeeds.
- Re-running sync after interruption converges safely.

**Verification:** Coordinator unit/integration tests with injected failures.

**Dependencies:** Tasks 24, 28, and 30.

**Estimated scope:** M.

#### Task 32: Add sync scheduling policy

**Description:** Implement Section 13 flush triggers, debounce, retry backoff,
and one-sync-at-a-time locking.

**Acceptance criteria:**

- No request is made for every swipe.
- Five study events trigger a batch.
- CRUD triggers immediate full-outbox flush.
- Concurrent triggers share one active sync.
- Offline mode creates no error loop.

**Verification:** Fake-timer scheduling tests and browser network inspection.

**Dependencies:** Task 31.

**Estimated scope:** M.

#### Task 33: Implement first-login and guest migration

**Description:** Preserve guest data across OAuth and merge/upload it into the
authenticated account without name-based deduplication.

**Acceptance criteria:**

- Empty server receives the complete local snapshot.
- Existing server account keeps its data and receives new guest UUID entities.
- Every device converges after subsequent sync.
- Failed migration leaves guest data recoverable.

**Verification:** Empty-account and existing-account end-to-end tests.

**Dependencies:** Tasks 19, 31, and 32.

**Estimated scope:** M.

#### Task 34: Implement blocking synchronized logout

**Description:** Flush, pull, verify empty outbox, then end Supabase session.

**Acceptance criteria:**

- Offline/failed sync prevents logout and preserves data.
- Successful logout leaves no pending operation.
- Re-login restores the server state.

**Verification:** Online, offline, failed-request, and re-login tests.

**Dependencies:** Tasks 32 and 33 plus resolution of Open Question 1.

**Estimated scope:** M.

#### Checkpoint I1

- Phone and desktop converge after offline study on both.
- A swipe remains instant under slow/offline network simulation.
- Guest conversion and logout failure paths preserve data.

### Phase J: Chat Sync and Product Integration

#### Task 35: Enqueue and synchronize chat history

**Description:** Connect local chat writes to the outbox and apply remote
threads/messages during pull.

**Acceptance criteria:**

- Chat history appears on a second authenticated device.
- Duplicate messages are impossible after retries.
- Placeholder provider remains local and replaceable.

**Verification:** Two-device chat synchronization test.

**Dependencies:** Tasks 12, 22, and 31.

**Estimated scope:** M.

#### Task 36: Add minimal sync status UX

**Description:** Add unobtrusive states for syncing, offline with pending work,
sync failure/retry, and logout blocked by sync.

**Acceptance criteria:**

- Normal studying is not visually interrupted.
- User can retry a failed sync.
- No UI claims data is synchronized before acknowledgement.

**Verification:** Component tests and offline browser walkthrough.

**Dependencies:** Tasks 32 and 34.

**Estimated scope:** S/M.

### Phase K: Hardening, Deployment, and Documentation

#### Task 37: Add API security hardening

**Description:** Add CORS policy, Helmet, rate limits, request/body limits,
structured logging, and sanitized errors.

**Acceptance criteria:**

- Auth and sync endpoints have explicit limits.
- Secrets and tokens never appear in logs.
- Oversized requests are rejected before expensive processing.

**Verification:** Security-focused API integration tests.

**Dependencies:** Tasks 26 and 30.

**Estimated scope:** M.

#### Task 38: Add complete automated sync scenarios

**Description:** Cover offline, retry, duplicate, conflict, tombstone, guest
migration, and logout behavior in deterministic tests.

**Acceptance criteria:**

- Critical scenarios run without relying on production Supabase.
- Tests prove no lost study event across two devices.
- Existing frontend learning algorithm tests remain green.

**Verification:** Full frontend/API test suites.

**Dependencies:** Tasks 29, 33, 34, and 35.

**Estimated scope:** M.

#### Task 39: Add mobile end-to-end verification

**Description:** Test login, guest mode, swipe, inline edit, explanation, chat,
offline study, reconnect sync, and logout at iPhone viewports.

**Acceptance criteria:**

- No horizontal overflow or gesture conflict.
- PWA still launches and studies cached cards offline.
- Chat keyboard/safe-area behavior is usable.
- Sync does not create visible card delays.

**Verification:** Browser automation plus physical iPhone checklist.

**Dependencies:** Task 38.

**Estimated scope:** M.

#### Task 40: Prepare free-tier deployment

**Description:** Provision Supabase project, apply migrations, configure Google
OAuth redirects, deploy NestJS to the selected free host, and configure Vercel.

**Acceptance criteria:**

- Production secrets exist only in provider environment settings.
- Frontend, API, Auth, and DB work end to end.
- Cold/sleeping API behavior does not block offline study.
- Restore/backup procedure is documented.

**Verification:** Production smoke test on phone and desktop.

**Dependencies:** Tasks 37-39 and resolution of Open Question 2.

**Estimated scope:** M/L; split by provider if needed.

#### Task 41: Update public and agent documentation

**Description:** Update README, deployment docs, project brief, environment
examples, API docs, and migration/rollback instructions.

**Acceptance criteria:**

- README no longer claims there is no account/backend.
- Local setup is reproducible from a clean clone.
- Historical MVP scope remains clearly labeled.
- API and sync contracts link to the accepted ADR.

**Verification:** Follow setup docs from a clean environment.

**Dependencies:** Task 40.

**Estimated scope:** M.

#### Final Checkpoint

- Frontend lint, typecheck, tests, and production build pass.
- API lint, typecheck, tests, and production build pass.
- Prisma migrations apply from clean state.
- PWA offline study still works.
- Two-device sync scenarios pass.
- No secrets are committed.
- User reviews the branch before any merge to `main`.

## 17. Effort Estimate

These are rough careful-human estimates, not deadlines:

| Area | Tasks | Estimated effort |
| --- | ---: | ---: |
| Planning/baseline | 1-2 | 3-5 hours |
| Validation/edit/explanation | 3-7 | 10-16 hours |
| Placeholder assistant | 8-12 | 12-18 hours |
| Backend/contracts/database | 13-16 | 12-20 hours |
| Authentication | 17-19 | 8-14 hours |
| Cloud CRUD | 20-22 | 8-14 hours |
| Outbox and sync engine | 23-34 | 32-50 hours |
| Chat sync/status | 35-36 | 6-10 hours |
| Hardening/testing/deployment/docs | 37-41 | 18-30 hours |
| **Total** | **41 tasks** | **109-177 hours** |

The sync engine is the dominant risk and should not be compressed into one
large task. A coding agent should normally complete 1-3 tasks per batch and
stop at each checkpoint for review.

## 18. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| IndexedDB migration loses existing cards | Critical | Backup first; migration tests from populated v1 database; never clear stores during upgrade |
| Device progress overwrites other device | Critical | Immutable study events, UUID idempotency, server cursor, deterministic integration tests |
| Logout loses queued changes | High | Blocking sync; preserve outbox on failure; no forced logout offline |
| Supabase token is trusted without verification | Critical | Verify signature, issuer, audience/project, and expiry in NestJS guard |
| Frontend bypasses NestJS and couples to Supabase tables | High | No browser database client; architectural tests/review; only Auth SDK on frontend |
| Free API host sleeps | Medium | IndexedDB-first UX; retry in background; never block study on cold API |
| Supabase free project pauses | Medium | Document restoration; activity warning; backups/export remain available |
| Same-field offline content edits conflict | Medium | Versioned field patches; deterministic server winner; retain diagnostics |
| Explanation cannot fit on small phone | Medium | 500-character cap; responsive layout tests; no inner scroll |
| Chat gestures conflict with card swipe | Medium | Disable card gesture layer while sheet is open; browser interaction tests |
| Large public AI/API requests create cost/abuse | High | Input limits, authentication where appropriate, rate limiting, sanitized errors |

## 19. Open Questions Requiring User Decision

1. **Authenticated data after logout:** recommended behavior is to remove the
   authenticated account dataset from IndexedDB after successful sync, while
   preserving the separate guest dataset. This prevents another account or
   guest from seeing private cards. Confirm before Task 34.
2. **Free NestJS hosting provider:** keep open until Task 40. Compare current
   free limits and cold-start behavior immediately before deployment.
3. **Account deletion:** not currently in scope. Before public account launch,
   decide whether the first version needs a `Delete account and cloud data`
   action.
4. **Settings sync:** recommended first version keeps theme and device UI
   preferences local. Confirm whether any setting must follow the account.

## 20. Definition of Done

A task is complete only when:

- acceptance criteria are met;
- relevant automated tests pass;
- errors and loading/offline states are handled;
- no secret is exposed;
- mobile behavior is manually checked when UI is affected;
- documentation/contracts are updated when behavior changes;
- unrelated files are not refactored;
- the task leaves the branch buildable.
