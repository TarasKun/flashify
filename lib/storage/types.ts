import type {
  Card,
  CreateCardInput,
  CreateDeckInput,
  Deck,
  EntityId,
  UpdateCardInput,
  UpdateDeckInput,
} from "@/lib/domain";

export type ThemePreference = "system" | "light" | "dark";

export type AppSettings = {
  theme: ThemePreference;
};

export type DeckProgress = {
  deckId: EntityId;
  learned: number;
  total: number;
};

export type ListStudyCardsOptions = {
  deckId: EntityId;
  now: Date;
};

export type FlashifyStorage = {
  listDecks(): Promise<Deck[]>;
  getDeck(id: EntityId): Promise<Deck | null>;
  createDeck(input: CreateDeckInput): Promise<Deck>;
  updateDeck(id: EntityId, input: UpdateDeckInput): Promise<Deck>;
  deleteDeck(id: EntityId): Promise<void>;

  listCardsForDeck(deckId: EntityId): Promise<Card[]>;
  listStudyCards(options: ListStudyCardsOptions): Promise<Card[]>;
  getCard(id: EntityId): Promise<Card | null>;
  createCard(input: CreateCardInput): Promise<Card>;
  createCards(inputs: CreateCardInput[]): Promise<Card[]>;
  updateCard(id: EntityId, input: UpdateCardInput): Promise<Card>;
  saveCardProgress(card: Card): Promise<Card>;
  deleteCard(id: EntityId): Promise<void>;

  getDeckProgress(deckId: EntityId): Promise<DeckProgress>;

  getSettings(): Promise<AppSettings>;
  updateSettings(input: Partial<AppSettings>): Promise<AppSettings>;
};

export class StorageRecordNotFoundError extends Error {
  constructor(entityName: string, id: EntityId) {
    super(`${entityName} not found: ${id}`);
    this.name = "StorageRecordNotFoundError";
  }
}
