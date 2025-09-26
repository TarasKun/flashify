import {
  createEmptyCardProgress,
  isEligibleForStudy,
  type Card,
  type CreateCardInput,
  type CreateDeckInput,
  type Deck,
  type EntityId,
  type UpdateCardInput,
  type UpdateDeckInput,
} from "@/lib/domain";
import type {
  AppSettings,
  DeckProgress,
  FlashifyStorage,
  ListStudyCardsOptions,
} from "./types";
import { StorageRecordNotFoundError } from "./types";

const DB_NAME = "flashify";
const DB_VERSION = 1;

const DECKS_STORE = "decks";
const CARDS_STORE = "cards";
const SETTINGS_STORE = "settings";
const APP_SETTINGS_ID = "app";

type SettingsRecord = AppSettings & {
  id: typeof APP_SETTINGS_ID;
};

const DEFAULT_SETTINGS: SettingsRecord = {
  id: APP_SETTINGS_ID,
  theme: "system",
};

export function createIndexedDbStorage(): FlashifyStorage {
  return new IndexedDbFlashifyStorage();
}

class IndexedDbFlashifyStorage implements FlashifyStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async listDecks(): Promise<Deck[]> {
    const db = await this.getDb();
    const decks = await getAllFromStore<Deck>(db, DECKS_STORE);

    return decks.sort((left, right) =>
      left.updatedAt.localeCompare(right.updatedAt),
    );
  }

  async getDeck(id: EntityId): Promise<Deck | null> {
    const db = await this.getDb();

    return getFromStore<Deck>(db, DECKS_STORE, id);
  }

  async createDeck(input: CreateDeckInput): Promise<Deck> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const deck: Deck = {
      id: createId(),
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await putInStore(db, DECKS_STORE, deck);

    return deck;
  }

  async updateDeck(id: EntityId, input: UpdateDeckInput): Promise<Deck> {
    const db = await this.getDb();
    const deck = await getRequiredFromStore<Deck>(db, DECKS_STORE, "Deck", id);
    const updatedDeck: Deck = {
      ...deck,
      ...input,
      name: input.name?.trim() ?? deck.name,
      updatedAt: new Date().toISOString(),
    };

    await putInStore(db, DECKS_STORE, updatedDeck);

    return updatedDeck;
  }

  async deleteDeck(id: EntityId): Promise<void> {
    const db = await this.getDb();
    const cardRecords = await getAllFromStore<Card>(db, CARDS_STORE);
    const tx = db.transaction([DECKS_STORE, CARDS_STORE], "readwrite");

    tx.objectStore(DECKS_STORE).delete(id);

    const cardsStore = tx.objectStore(CARDS_STORE);
    cardRecords
      .filter((card) => card.deckId === id)
      .forEach((card) => {
        cardsStore.delete(card.id);
      });

    await waitForTransaction(tx);
  }

  async listCardsForDeck(deckId: EntityId): Promise<Card[]> {
    const db = await this.getDb();
    const cards = await getAllCardsByDeck(db, deckId);

    return cards
      .filter((card) => !card.deletedAt)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async listStudyCards({ deckId, now }: ListStudyCardsOptions): Promise<Card[]> {
    const cards = await this.listCardsForDeck(deckId);

    return cards.filter((card) => isEligibleForStudy(card, now));
  }

  async getCard(id: EntityId): Promise<Card | null> {
    const db = await this.getDb();
    const card = await getFromStore<Card>(db, CARDS_STORE, id);

    if (card?.deletedAt) {
      return null;
    }

    return card;
  }

  async createCard(input: CreateCardInput): Promise<Card> {
    const [card] = await this.createCards([input]);

    return card;
  }

  async createCards(inputs: CreateCardInput[]): Promise<Card[]> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const cards = inputs.map<Card>((input) => ({
      id: createId(),
      deckId: input.deckId,
      question: input.question.trim(),
      answer: input.answer.trim(),
      explanation: input.explanation?.trim() ?? "",
      status: "new",
      reviewLevel: 0,
      dueAt: null,
      progress: createEmptyCardProgress(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));

    const tx = db.transaction(CARDS_STORE, "readwrite");
    const cardsStore = tx.objectStore(CARDS_STORE);

    cards.forEach((card) => {
      cardsStore.put(card);
    });

    await waitForTransaction(tx);

    return cards;
  }

  async updateCard(id: EntityId, input: UpdateCardInput): Promise<Card> {
    const db = await this.getDb();
    const card = await getRequiredFromStore<Card>(db, CARDS_STORE, "Card", id);
    const updatedCard: Card = {
      ...card,
      ...input,
      question: input.question?.trim() ?? card.question,
      answer: input.answer?.trim() ?? card.answer,
      explanation: input.explanation?.trim() ?? card.explanation,
      updatedAt: new Date().toISOString(),
    };

    await putInStore(db, CARDS_STORE, updatedCard);

    return updatedCard;
  }

  async saveCardProgress(card: Card): Promise<Card> {
    const db = await this.getDb();

    await putInStore(db, CARDS_STORE, {
      ...card,
      updatedAt: new Date().toISOString(),
    });

    return getRequiredFromStore<Card>(db, CARDS_STORE, "Card", card.id);
  }

  async deleteCard(id: EntityId): Promise<void> {
    await this.updateCard(id, {
      deletedAt: new Date().toISOString(),
    });
  }

  async getDeckProgress(deckId: EntityId): Promise<DeckProgress> {
    const cards = await this.listCardsForDeck(deckId);

    return {
      deckId,
      learned: cards.filter((card) => card.status === "learned").length,
      total: cards.length,
    };
  }

  async getSettings(): Promise<AppSettings> {
    const db = await this.getDb();
    const settings = await getFromStore<SettingsRecord>(
      db,
      SETTINGS_STORE,
      APP_SETTINGS_ID,
    );

    if (settings) {
      return {
        theme: settings.theme,
      };
    }

    await putInStore(db, SETTINGS_STORE, DEFAULT_SETTINGS);

    return {
      theme: DEFAULT_SETTINGS.theme,
    };
  }

  async updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
    const db = await this.getDb();
    const currentSettings = await this.getSettings();
    const nextSettings: SettingsRecord = {
      id: APP_SETTINGS_ID,
      ...currentSettings,
      ...input,
    };

    await putInStore(db, SETTINGS_STORE, nextSettings);

    return {
      theme: nextSettings.theme,
    };
  }

  async replaceAllData(input: {
    cards: Card[];
    decks: Deck[];
    settings: AppSettings;
  }): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([DECKS_STORE, CARDS_STORE, SETTINGS_STORE], "readwrite");

    const decksStore = tx.objectStore(DECKS_STORE);
    const cardsStore = tx.objectStore(CARDS_STORE);
    const settingsStore = tx.objectStore(SETTINGS_STORE);

    decksStore.clear();
    cardsStore.clear();
    settingsStore.clear();

    input.decks.forEach((deck) => decksStore.put(deck));
    input.cards.forEach((card) => cardsStore.put(card));
    settingsStore.put({
      id: APP_SETTINGS_ID,
      theme: input.settings.theme,
    } satisfies SettingsRecord);

    await waitForTransaction(tx);
  }

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase();
    }

    return this.dbPromise;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) {
    return Promise.reject(
      new Error("IndexedDB is not available in this environment."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DECKS_STORE)) {
        db.createObjectStore(DECKS_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(CARDS_STORE)) {
        const cardsStore = db.createObjectStore(CARDS_STORE, { keyPath: "id" });

        cardsStore.createIndex("deckId", "deckId", { unique: false });
        cardsStore.createIndex("status", "status", { unique: false });
        cardsStore.createIndex("dueAt", "dueAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFromStore<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function getRequiredFromStore<T>(
  db: IDBDatabase,
  storeName: string,
  entityName: string,
  id: EntityId,
): Promise<T> {
  const record = await getFromStore<T>(db, storeName, id);

  if (!record) {
    throw new StorageRecordNotFoundError(entityName, id);
  }

  return record;
}

function getAllFromStore<T>(
  db: IDBDatabase,
  storeName: string,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function getAllCardsByDeck(
  db: IDBDatabase,
  deckId: EntityId,
): Promise<Card[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(CARDS_STORE, "readonly")
      .objectStore(CARDS_STORE)
      .index("deckId")
      .getAll(deckId);

    request.onsuccess = () => resolve(request.result as Card[]);
    request.onerror = () => reject(request.error);
  });
}

function putInStore<T>(
  db: IDBDatabase,
  storeName: string,
  value: T,
): Promise<void> {
  const tx = db.transaction(storeName, "readwrite");

  tx.objectStore(storeName).put(value);

  return waitForTransaction(tx);
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function createId(): EntityId {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
