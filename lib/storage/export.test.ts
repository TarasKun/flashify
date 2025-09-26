import { describe, expect, it } from "vitest";
import { createEmptyCardProgress } from "../domain";
import type { Card, Deck } from "../domain";
import {
  exportFlashifyData,
  parseFlashifyBackupJson,
  restoreFlashifyData,
} from "./export";

describe("Flashify export", () => {
  it("exports settings, decks, and cards grouped by deck", async () => {
    const exportedAt = new Date("2025-06-01T12:00:00.000Z");
    const decks = [
      makeDeck("english", "English"),
      makeDeck("programming", "Programming"),
    ];
    const cards = {
      english: [makeCard("cat", "english", "cat", "кіт")],
      programming: [
        makeCard("dto", "programming", "What is a DTO?", "Data Transfer Object"),
      ],
    };

    const data = await exportFlashifyData(
      {
        getSettings: async () => ({ theme: "dark" }),
        listDecks: async () => decks,
        listCardsForDeck: async (deckId) => cards[deckId as keyof typeof cards],
      },
      exportedAt,
    );

    expect(data).toEqual({
      version: 1,
      exportedAt: "2025-06-01T12:00:00.000Z",
      settings: {
        theme: "dark",
      },
      decks: [
        {
          deck: decks[0],
          cards: cards.english,
        },
        {
          deck: decks[1],
          cards: cards.programming,
        },
      ],
    });
  });

  it("parses a valid backup JSON file", () => {
    const deck = makeDeck("english", "English");
    const card = makeCard("cat", "english", "cat", "кіт");
    const backup = {
      version: 1,
      exportedAt: "2025-06-01T12:00:00.000Z",
      settings: {
        theme: "light",
      },
      decks: [
        {
          deck,
          cards: [card],
        },
      ],
    };

    expect(parseFlashifyBackupJson(JSON.stringify(backup))).toEqual(backup);
  });

  it("rejects backup cards that point at another deck", () => {
    const deck = makeDeck("english", "English");
    const card = makeCard("cat", "programming", "cat", "кіт");
    const backup = {
      version: 1,
      exportedAt: "2025-06-01T12:00:00.000Z",
      settings: {
        theme: "system",
      },
      decks: [
        {
          deck,
          cards: [card],
        },
      ],
    };

    expect(parseFlashifyBackupJson(JSON.stringify(backup))).toBeNull();
  });

  it("restores a backup by replacing storage data", async () => {
    const deck = makeDeck("english", "English");
    const card = makeCard("cat", "english", "cat", "кіт");
    const calls: unknown[] = [];

    await restoreFlashifyData(
      {
        replaceAllData: async (input) => {
          calls.push(input);
        },
      },
      {
        version: 1,
        exportedAt: "2025-06-01T12:00:00.000Z",
        settings: {
          theme: "dark",
        },
        decks: [
          {
            deck,
            cards: [card],
          },
        ],
      },
    );

    expect(calls).toEqual([
      {
        decks: [deck],
        cards: [card],
        settings: {
          theme: "dark",
        },
      },
    ]);
  });
});

function makeDeck(id: string, name: string): Deck {
  return {
    id,
    name,
    createdAt: "2025-06-01T10:00:00.000Z",
    updatedAt: "2025-06-01T10:00:00.000Z",
  };
}

function makeCard(
  id: string,
  deckId: string,
  question: string,
  answer: string,
): Card {
  return {
    id,
    deckId,
    question,
    answer,
    explanation: "",
    status: "new",
    reviewLevel: 0,
    dueAt: null,
    progress: createEmptyCardProgress(),
    createdAt: "2025-06-01T10:00:00.000Z",
    updatedAt: "2025-06-01T10:00:00.000Z",
    deletedAt: null,
  };
}
