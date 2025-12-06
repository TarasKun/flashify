import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyCardProgress, type Card, type Deck } from "../domain";
import { createIndexedDbStorage } from "./indexeddb";

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

describe("IndexedDbFlashifyStorage chat migration", () => {
  it("keeps version-one deck, card, and settings data while adding chat stores", async () => {
    const deck = makeDeck();
    const card = makeCard(deck.id);
    await createVersionOneDatabase({ card, deck });

    const storage = createIndexedDbStorage();

    await expect(storage.listDecks()).resolves.toEqual([deck]);
    await expect(storage.listCardsForDeck(deck.id)).resolves.toEqual([card]);
    await expect(storage.getSettings()).resolves.toEqual({ theme: "dark" });
    await expect(storage.getOrCreateChatThread(card.id)).resolves.toMatchObject({
      cardId: card.id,
    });
  });

  it("reuses one thread per card and restores messages in creation order", async () => {
    const storage = createIndexedDbStorage();
    const thread = await storage.getOrCreateChatThread("card-1");
    const sameThread = await storage.getOrCreateChatThread("card-1");

    const userMessage = await storage.createChatMessage({
      cardId: "card-1",
      content: "Can you give an example?",
      role: "user",
      threadId: thread.id,
    });
    const assistantMessage = await storage.createChatMessage({
      cardId: "card-1",
      content: "A placeholder answer.",
      role: "assistant",
      threadId: thread.id,
    });

    expect(sameThread.id).toBe(thread.id);
    expect(userMessage.id).not.toBe(assistantMessage.id);
    await expect(storage.listChatMessages(thread.id)).resolves.toEqual([
      userMessage,
      assistantMessage,
    ]);

    const reopenedStorage = createIndexedDbStorage();
    await expect(reopenedStorage.listChatMessages(thread.id)).resolves.toEqual([
      userMessage,
      assistantMessage,
    ]);
  });
});

async function createVersionOneDatabase({
  card,
  deck,
}: {
  card: Card;
  deck: Deck;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("flashify", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("decks", { keyPath: "id" });
      const cardsStore = db.createObjectStore("cards", { keyPath: "id" });
      cardsStore.createIndex("deckId", "deckId", { unique: false });
      cardsStore.createIndex("status", "status", { unique: false });
      cardsStore.createIndex("dueAt", "dueAt", { unique: false });
      db.createObjectStore("settings", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["decks", "cards", "settings"], "readwrite");
      transaction.objectStore("decks").put(deck);
      transaction.objectStore("cards").put(card);
      transaction.objectStore("settings").put({ id: "app", theme: "dark" });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

function makeDeck(): Deck {
  return {
    createdAt: "2026-07-12T10:00:00.000Z",
    id: "deck-1",
    name: "Programming",
    updatedAt: "2026-07-12T10:00:00.000Z",
  };
}

function makeCard(deckId: string): Card {
  return {
    answer: "A Data Transfer Object.",
    createdAt: "2026-07-12T10:00:00.000Z",
    deckId,
    deletedAt: null,
    dueAt: null,
    explanation: "",
    id: "card-1",
    progress: createEmptyCardProgress(),
    question: "What is a DTO?",
    reviewLevel: 0,
    status: "new",
    updatedAt: "2026-07-12T10:00:00.000Z",
  };
}
