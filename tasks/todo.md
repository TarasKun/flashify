# Flashify Cloud Phase Checklist

Source of truth: `tasks/plan.md`. Do not implement from this checklist alone;
open the matching task section for acceptance criteria and verification.

Execution rule: complete at most three tasks per user-approved batch, then run
the checkpoint or relevant verification and report results.

## Phase A: Planning and Baseline

- [x] Task 1: Record architecture and implementation plan.
- [x] Task 2: Establish baseline quality report.

## Phase B: Validation and Inline Editing

- [x] Task 3: Add shared frontend content limits.
- [x] Task 4: Apply limits to all existing write/import paths.
- [x] Task 5: Enforce the new explanation contract and full display.
- [ ] Checkpoint B1.
- [x] Task 6: Add inline study-card edit gear and form.
- [ ] Task 7: Verify/document native iOS Undo Paste behavior.
  - Documentation and application audit are complete in `docs/IOS_INPUT_NOTES.md`.
  - Physical iPhone reproduction remains a manual verification step because the
    desktop browser cannot emulate the device motion gesture.

## Phase C: Placeholder Assistant

- [x] Task 8: Define chat types, context, and provider interface.
- [x] Task 9: Extend `FlashifyStorage` for chat.
- [x] Task 10: Migrate IndexedDB for threads/messages.
- [ ] Checkpoint C1.
- [x] Task 11: Build closed/full assistant bottom sheet.
- [x] Task 12: Persist placeholder conversations per card.

## Phase D: Backend Foundation

- [x] Task 13: Add workspace/shared contracts package.
- [x] Task 14: Scaffold `flashify-api/` NestJS application.
- [x] Task 15: Configure local Supabase development through Docker.
  - Verified with a healthy local Docker stack on 2026-07-17.
- [x] Task 16: Add Prisma and initial database schema.
  - Applied and verified the initial schema plus ownership-integrity migration
    against local Supabase PostgreSQL on 2026-07-17.
- [ ] Checkpoint D1.

## Phase E: Authentication

- [ ] Task 17: Add Supabase Google/guest auth gate.
  - Auth gate, session restoration, and persistent local guest identity are
    implemented and covered by automated checks. Manual Google OAuth checks on
    localhost and deployed preview remain pending provider confirmation.
- [ ] Task 18: Verify Supabase tokens in NestJS.
- [ ] Task 19: Add current-user/device bootstrap endpoint.

## Phase F: Protected Cloud CRUD

- [ ] Task 20: Add deck repository and REST endpoints.
- [ ] Task 21: Add card repository and REST endpoints.
- [ ] Task 22: Add chat repository endpoints.
- [ ] Checkpoint F1.

## Phase G: IndexedDB Outbox

- [ ] Task 23: Define runtime sync operation contracts.
- [ ] Task 24: Add outbox, identity namespace, and sync cursor stores.
- [ ] Task 25: Make local writes atomically enqueue operations.

## Phase H: Server Sync Engine

- [ ] Task 26: Add idempotent operation ingestion.
- [ ] Task 27: Apply study events to canonical progress.
- [ ] Task 28: Add bootstrap and cursor-based pull.
- [ ] Task 29: Implement deterministic conflict handling.
- [ ] Checkpoint H1.

## Phase I: Frontend Sync Coordinator

- [ ] Task 30: Add authenticated NestJS API client.
- [ ] Task 31: Implement safe push/pull orchestration.
- [ ] Task 32: Add batching, triggers, locking, and retries.
- [ ] Task 33: Implement first-login guest migration.
- [ ] Task 34: Implement blocking synchronized logout.
- [ ] Checkpoint I1.

## Phase J: Product Integration

- [ ] Task 35: Synchronize per-card chat history.
- [ ] Task 36: Add minimal sync status and retry UI.

## Phase K: Hardening and Launch

- [ ] Task 37: Add API security hardening.
- [ ] Task 38: Add complete automated sync scenarios.
- [ ] Task 39: Verify mobile/PWA flows end to end.
- [ ] Task 40: Deploy Supabase, NestJS API, and Vercel integration.
- [ ] Task 41: Update README, deployment, API, and agent documentation.
- [ ] Final checkpoint and user review before merge.

## Decisions Still Required

- [ ] Decide whether authenticated IndexedDB data is removed after logout.
- [ ] Select the free NestJS hosting provider near deployment time.
- [ ] Decide whether account deletion is required for the first public account
  release.
- [ ] Confirm that theme/settings remain device-local.
