# ADR-001: Local-First Cloud Architecture

## Status

Accepted

## Date

2026-07-12

## Context

Flashify is an existing mobile-first Next.js PWA. Decks, cards, learning
progress, cached explanations, and settings currently live in IndexedDB. The
study flow must remain usable offline and must not wait for the network after a
swipe.

The next product phase adds:

- identified users with Google login;
- an explicit local-only guest mode;
- cloud backup and multi-device synchronization;
- per-card assistant chat history;
- a separate backend application;
- continued free-tier deployment while the product is non-commercial.

The backend is also intended to be a learning project. Business logic should
therefore live in an explicit backend architecture rather than being hidden in
generated database APIs.

## Decision

Use the following architecture:

- Keep the existing Next.js application at the repository root.
- Add a NestJS application in `flashify-api/` using the default Express HTTP
  adapter.
- Use Supabase Auth for Google OAuth and browser sessions.
- Use Supabase-hosted PostgreSQL in deployed environments.
- Use Prisma from NestJS for Flashify-owned database tables and migrations.
- Prisma migrations are the only migration source for Flashify-owned tables in
  the `public` schema. Supabase CLI must not create a second set of migrations
  for those same tables.
- Expose Flashify business operations through a NestJS REST API.
- Do not access decks, cards, progress, chat history, or sync tables directly
  from the frontend through the Supabase generated API.
- Keep IndexedDB as the frontend's immediate source of truth.
- Synchronize local changes through an IndexedDB outbox and idempotent batch
  REST requests.
- Represent every study answer, including `dontKnow`, as a unique immutable
  study event.
- Use Supabase access tokens as bearer tokens. NestJS verifies the token and
  derives the user identity for every protected request.
- Keep the existing Next.js OpenRouter routes during this phase. Moving AI
  routes to NestJS is not part of the first cloud-sync implementation.

## Authentication Scope

Authentication is intentionally small:

- `Continue with Google` is the only account login method.
- `Continue as guest` creates a local-only identity.
- Request only `openid`, `email`, and `profile` scopes.
- Do not add passwords, magic links, roles, teams, billing, or account sharing.
- Do not store or use Google provider refresh tokens.
- A guest can use the app across launches on the same browser/device.
- Guest data is not synchronized until the user signs in with Google.
- Logging out first performs a blocking sync. If sync cannot complete, logout
  does not complete.

## Synchronization Rules

- Local writes complete before network work begins.
- A swipe never waits for a network response.
- Study events are flushed when five unsynced events accumulate.
- Creating, editing, or deleting a deck or card immediately triggers a flush
  of the complete pending outbox.
- Other flush triggers are login, reconnect, app foreground, leaving a study
  session, and logout.
- Entity IDs and operation IDs are UUIDs generated on the client.
- Every device assigns a strictly increasing `deviceSequence` to its local
  operations so same-device answer order survives offline batching.
- Server processing is idempotent by operation/event ID.
- Soft deletion uses `deletedAt` tombstones.
- Study progress is derived from merged study events; one device must not
  overwrite another device's study answers.
- Card content edits preserve learning progress.
- Content updates are field-level patches. Updates to different fields merge.
  If the same field is updated concurrently, the last server-accepted patch
  wins for the initial version.
- Deletion wins over an older content edit. Restoring a deleted entity requires
  a future explicit restore operation.
- Pull synchronization uses a server-issued monotonic cursor, not device clock
  comparison.
- The server preserves `deviceSequence` ordering within one device. When two
  devices produce offline events concurrently, server acceptance order is the
  canonical cross-device order for the first version.

## Assistant Scope

- Each card owns one persistent chat thread.
- Messages are stored locally and synchronized between devices.
- The first implementation returns a deterministic placeholder response.
- A provider interface separates chat UI/storage from response generation so a
  real model can replace the placeholder later.
- A future request will include deck name, question, answer, explanation,
  study direction, visible side, progress, and prior messages.
- A future model should answer in the language of the user's latest message
  while preserving card terminology and examples in the card's language.

## Alternatives Considered

### Full Supabase application without NestJS

This would be the smallest deployment, but it would move business logic into
generated APIs, database functions, or Edge Functions and reduce the backend
learning value. Rejected because Flashify needs an explicit backend boundary.

### NestJS with Passport and custom PostgreSQL sessions

This gives full control but adds OAuth callback, session lifecycle, cookie,
CSRF, and hosting work that is not central to Flashify. Rejected for now because
the user explicitly wants simpler authentication and free deployment.

### Replace IndexedDB with remote storage

Rejected. It would break instant study interactions, offline use, and the
existing PWA design.

### Synchronize a full card after every swipe

Rejected. It increases request volume and allows one device's progress snapshot
to overwrite another device's answers.

## Consequences

- The frontend needs an IndexedDB schema migration for identity, outbox, sync
  metadata, chat threads, and messages.
- NestJS remains the only public business API even though Supabase hosts the
  database.
- Supabase Auth and PostgreSQL can fit the current free-tier scale, but inactive
  free projects may pause and need manual restoration.
- The API still needs a separate free deployment target. The exact provider is
  intentionally left open until the deployment phase.
- The repository becomes a small multi-application repository without moving
  the existing Next.js app into another directory.
- Existing MVP documents remain historical context. The cloud implementation
  plan in `tasks/plan.md` is the source of truth for this phase.
