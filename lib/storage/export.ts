import {
  createEmptyCardProgress,
  type Card,
  type CardProgress,
  type CardStatus,
  type Deck,
  type ReviewLevel,
} from "../domain";
import type { AppSettings, FlashifyStorage } from "./types";

export type FlashifyExportDeck = {
  deck: Deck;
  cards: Card[];
};

export type FlashifyExportData = {
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  decks: FlashifyExportDeck[];
};

export async function exportFlashifyData(
  storage: Pick<FlashifyStorage, "getSettings" | "listCardsForDeck" | "listDecks">,
  now = new Date(),
): Promise<FlashifyExportData> {
  const [settings, decks] = await Promise.all([
    storage.getSettings(),
    storage.listDecks(),
  ]);
  const exportDecks = await Promise.all(
    decks.map(async (deck) => ({
      deck,
      cards: await storage.listCardsForDeck(deck.id),
    })),
  );

  return {
    version: 1,
    exportedAt: now.toISOString(),
    settings,
    decks: exportDecks,
  };
}

export function parseFlashifyBackupJson(text: string): FlashifyExportData | null {
  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }

  return normalizeFlashifyExportData(payload);
}

export async function restoreFlashifyData(
  storage: Pick<FlashifyStorage, "replaceAllData">,
  data: FlashifyExportData,
): Promise<void> {
  await storage.replaceAllData({
    decks: data.decks.map(({ deck }) => deck),
    cards: data.decks.flatMap(({ cards }) => cards),
    settings: data.settings,
  });
}

function normalizeFlashifyExportData(payload: unknown): FlashifyExportData | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    decks?: unknown;
    exportedAt?: unknown;
    settings?: unknown;
    version?: unknown;
  };

  if (
    record.version !== 1 ||
    typeof record.exportedAt !== "string" ||
    !isValidDate(record.exportedAt) ||
    !Array.isArray(record.decks)
  ) {
    return null;
  }

  const settings = normalizeSettings(record.settings);

  if (!settings) {
    return null;
  }

  const decks = record.decks
    .map((deckRecord) => normalizeExportDeck(deckRecord))
    .filter((deckRecord): deckRecord is FlashifyExportDeck => deckRecord !== null);
  const deckIds = new Set(decks.map(({ deck }) => deck.id));

  if (decks.length !== record.decks.length) {
    return null;
  }

  if (
    decks.some(({ cards }) => cards.some((card) => !deckIds.has(card.deckId)))
  ) {
    return null;
  }

  return {
    version: 1,
    exportedAt: record.exportedAt,
    settings,
    decks,
  };
}

function normalizeExportDeck(payload: unknown): FlashifyExportDeck | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    cards?: unknown;
    deck?: unknown;
  };
  const deck = normalizeDeck(record.deck);

  if (!deck || !Array.isArray(record.cards)) {
    return null;
  }

  const cards = record.cards
    .map((card) => normalizeCard(card, deck.id))
    .filter((card): card is Card => card !== null);

  if (cards.length !== record.cards.length) {
    return null;
  }

  return {
    deck,
    cards,
  };
}

function normalizeDeck(payload: unknown): Deck | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    createdAt?: unknown;
    id?: unknown;
    name?: unknown;
    updatedAt?: unknown;
  };

  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    !record.id.trim() ||
    !record.name.trim() ||
    !isValidDate(record.createdAt) ||
    !isValidDate(record.updatedAt)
  ) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeCard(payload: unknown, expectedDeckId: string): Card | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    answer?: unknown;
    createdAt?: unknown;
    deckId?: unknown;
    deletedAt?: unknown;
    dueAt?: unknown;
    explanation?: unknown;
    id?: unknown;
    progress?: unknown;
    question?: unknown;
    reviewLevel?: unknown;
    status?: unknown;
    updatedAt?: unknown;
  };

  if (
    typeof record.id !== "string" ||
    typeof record.deckId !== "string" ||
    record.deckId !== expectedDeckId ||
    typeof record.question !== "string" ||
    typeof record.answer !== "string" ||
    typeof record.explanation !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    !record.id.trim() ||
    !record.question.trim() ||
    !record.answer.trim() ||
    !isValidCardStatus(record.status) ||
    !isValidReviewLevel(record.reviewLevel) ||
    !isNullableDate(record.dueAt) ||
    !isNullableDate(record.deletedAt) ||
    !isValidDate(record.createdAt) ||
    !isValidDate(record.updatedAt)
  ) {
    return null;
  }

  return {
    id: record.id,
    deckId: record.deckId,
    question: record.question,
    answer: record.answer,
    explanation: record.explanation,
    status: record.status,
    reviewLevel: record.reviewLevel,
    dueAt: record.dueAt,
    progress: normalizeProgress(record.progress),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function normalizeSettings(payload: unknown): AppSettings | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const theme = (payload as { theme?: unknown }).theme;

  if (theme !== "system" && theme !== "light" && theme !== "dark") {
    return null;
  }

  return {
    theme,
  };
}

function normalizeProgress(payload: unknown): CardProgress {
  if (!payload || typeof payload !== "object") {
    return createEmptyCardProgress();
  }

  const record = payload as {
    forward?: unknown;
    reverse?: unknown;
  };

  return {
    forward: normalizeDirectionProgress(record.forward),
    reverse: normalizeDirectionProgress(record.reverse),
  };
}

function normalizeDirectionProgress(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      correctStreak: 0,
      mistakes: 0,
      lastAnsweredAt: null,
    };
  }

  const record = payload as {
    correctStreak?: unknown;
    lastAnsweredAt?: unknown;
    mistakes?: unknown;
  };

  return {
    correctStreak:
      typeof record.correctStreak === "number" && record.correctStreak >= 0
        ? record.correctStreak
        : 0,
    mistakes:
      typeof record.mistakes === "number" && record.mistakes >= 0
        ? record.mistakes
        : 0,
    lastAnsweredAt: isNullableDate(record.lastAnsweredAt)
      ? record.lastAnsweredAt
      : null,
  };
}

function isValidCardStatus(value: unknown): value is CardStatus {
  return (
    value === "new" ||
    value === "learning" ||
    value === "resting" ||
    value === "learned" ||
    value === "review"
  );
}

function isValidReviewLevel(value: unknown): value is ReviewLevel {
  return (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4
  );
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && isValidDate(value));
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
