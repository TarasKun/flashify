-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('new', 'learning', 'resting', 'learned', 'review');

-- CreateEnum
CREATE TYPE "StudyDirection" AS ENUM ('forward', 'reverse');

-- CreateEnum
CREATE TYPE "StudyAnswer" AS ENUM ('know', 'dontKnow');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "SyncEntityType" AS ENUM ('DECK', 'CARD', 'STUDY_EVENT', 'CHAT_THREAD', 'CHAT_MESSAGE');

-- CreateEnum
CREATE TYPE "SyncChangeType" AS ENUM ('UPSERT', 'DELETE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "answer" VARCHAR(1500) NOT NULL,
    "explanation" VARCHAR(500) NOT NULL DEFAULT '',
    "progress" JSONB NOT NULL,
    "status" "CardStatus" NOT NULL,
    "reviewLevel" INTEGER NOT NULL,
    "dueAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "direction" "StudyDirection" NOT NULL,
    "answer" "StudyAnswer" NOT NULL,
    "deviceSequence" INTEGER NOT NULL,
    "answeredAt" TIMESTAMPTZ(6) NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_events_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "role" "ChatMessageRole" NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "receivedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_changes" (
    "sequence" BIGSERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "entityType" "SyncEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "changeType" "SyncChangeType" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_changes_pkey" PRIMARY KEY ("sequence")
);

-- CreateIndex
CREATE INDEX "devices_userId_lastSeenAt_idx" ON "devices"("userId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "decks_userId_deletedAt_updatedAt_idx" ON "decks"("userId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "decks_userId_version_idx" ON "decks"("userId", "version");

-- CreateIndex
CREATE INDEX "cards_userId_deckId_deletedAt_idx" ON "cards"("userId", "deckId", "deletedAt");

-- CreateIndex
CREATE INDEX "cards_userId_status_dueAt_idx" ON "cards"("userId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "study_events_userId_receivedAt_idx" ON "study_events"("userId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "study_events_userId_deviceId_deviceSequence_key" ON "study_events"("userId", "deviceId", "deviceSequence");

-- CreateIndex
CREATE INDEX "chat_threads_userId_deletedAt_updatedAt_idx" ON "chat_threads"("userId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_userId_cardId_key" ON "chat_threads"("userId", "cardId");

-- CreateIndex
CREATE INDEX "chat_messages_userId_threadId_createdAt_idx" ON "chat_messages"("userId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_userId_cardId_deletedAt_idx" ON "chat_messages"("userId", "cardId", "deletedAt");

-- CreateIndex
CREATE INDEX "sync_changes_userId_sequence_idx" ON "sync_changes"("userId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "sync_changes_userId_operationId_key" ON "sync_changes"("userId", "operationId");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_changes" ADD CONSTRAINT "sync_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
