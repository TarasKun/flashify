-- Prevent a record for one user from referencing another user's device, deck,
-- card, or chat thread. Application services will still perform authorization,
-- while these constraints make cross-account data corruption impossible.

-- DropForeignKey
ALTER TABLE "cards" DROP CONSTRAINT "cards_deckId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_cardId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_threadId_fkey";

-- DropForeignKey
ALTER TABLE "chat_threads" DROP CONSTRAINT "chat_threads_cardId_fkey";

-- DropForeignKey
ALTER TABLE "study_events" DROP CONSTRAINT "study_events_cardId_fkey";

-- DropForeignKey
ALTER TABLE "study_events" DROP CONSTRAINT "study_events_deckId_fkey";

-- DropForeignKey
ALTER TABLE "study_events" DROP CONSTRAINT "study_events_deviceId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "cards_id_userId_key" ON "cards"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_id_userId_key" ON "chat_threads"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "decks_id_userId_key" ON "decks"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_id_userId_key" ON "devices"("id", "userId");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_deckId_userId_fkey" FOREIGN KEY ("deckId", "userId") REFERENCES "decks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_deviceId_userId_fkey" FOREIGN KEY ("deviceId", "userId") REFERENCES "devices"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_deckId_userId_fkey" FOREIGN KEY ("deckId", "userId") REFERENCES "decks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_cardId_userId_fkey" FOREIGN KEY ("cardId", "userId") REFERENCES "cards"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_cardId_userId_fkey" FOREIGN KEY ("cardId", "userId") REFERENCES "cards"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threadId_userId_fkey" FOREIGN KEY ("threadId", "userId") REFERENCES "chat_threads"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_cardId_userId_fkey" FOREIGN KEY ("cardId", "userId") REFERENCES "cards"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
