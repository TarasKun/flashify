import { describe, expect, it } from "vitest";
import { createEmptyCardProgress } from "../domain";
import type { Card, Deck } from "../domain";
import { exportFlashifyData } from "./export";

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
