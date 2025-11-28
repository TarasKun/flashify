import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyCardProgress, type Card } from "../domain";
import { createIndexedDbStorage } from "../storage";
import {
  retryAssistantReply,
  sendAssistantMessage,
} from "./conversation";
import type { AssistantProvider } from "./types";

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  });
  Object.defineProperty(globalThis, "IDBKeyRange", {
    configurable: true,
    value: IDBKeyRange,
  });
});

describe("assistant conversation persistence", () => {
  it("keeps independent conversations for two cards after storage is reopened", async () => {
    const storage = createIndexedDbStorage();
    const provider = replyWith("Placeholder reply.");
    const firstCard = makeCard("card-1");
    const secondCard = makeCard("card-2");

    const firstMessages = await sendAssistantMessage({
      ...conversationInput(storage, provider, firstCard),
      message: "How does this work?",
    });
    const secondMessages = await sendAssistantMessage({
      ...conversationInput(storage, provider, secondCard),
      message: "Can you give an example?",
    });

    const reopenedStorage = createIndexedDbStorage();
    const firstThread = await reopenedStorage.getOrCreateChatThread(firstCard.id);
    const secondThread = await reopenedStorage.getOrCreateChatThread(secondCard.id);

    expect(firstThread.id).not.toBe(secondThread.id);
    await expect(reopenedStorage.listChatMessages(firstThread.id)).resolves.toEqual(
      firstMessages,
    );
    await expect(reopenedStorage.listChatMessages(secondThread.id)).resolves.toEqual(
      secondMessages,
    );
  });

  it("retains a user message and allows retry after a provider failure", async () => {
    const storage = createIndexedDbStorage();
    const card = makeCard("card-1");
    const failingProvider: AssistantProvider = {
      reply: async () => {
        throw new Error("Provider unavailable.");
      },
    };

    await expect(
      sendAssistantMessage({
        ...conversationInput(storage, failingProvider, card),
        message: "What should I remember?",
      }),
    ).rejects.toThrow("Provider unavailable.");

    const thread = await storage.getOrCreateChatThread(card.id);
    const [userMessage] = await storage.listChatMessages(thread.id);

    expect(userMessage).toMatchObject({
      content: "What should I remember?",
      role: "user",
    });

    const retriedMessages = await retryAssistantReply({
      ...conversationInput(storage, replyWith("Retry succeeded."), card),
      userMessage: userMessage!,
    });

    expect(retriedMessages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });
});

function conversationInput(
  storage: ReturnType<typeof createIndexedDbStorage>,
  provider: AssistantProvider,
  card: Card,
) {
  return {
    storage,
    provider,
    card,
    deckName: "Programming",
    direction: "forward" as const,
    visibleSide: "prompt" as const,
  };
}

function replyWith(content: string): AssistantProvider {
  return {
    reply: async () => ({ content }),
  };
}

function makeCard(id: string): Card {
  return {
    answer: "A Data Transfer Object.",
    createdAt: "2026-07-12T10:00:00.000Z",
    deckId: "deck-1",
    deletedAt: null,
    dueAt: null,
    explanation: "It defines data passed between application layers.",
    id,
    progress: createEmptyCardProgress(),
    question: "What is a DTO?",
    reviewLevel: 0,
    status: "new",
    updatedAt: "2026-07-12T10:00:00.000Z",
  };
}
