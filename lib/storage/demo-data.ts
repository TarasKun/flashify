import type { CreateCardInput, Deck } from "@/lib/domain";
import type { FlashifyStorage } from "./types";

type DemoDeck = {
  name: string;
  cards: Array<{
    question: string;
    answer: string;
  }>;
};

export type SeedDemoDataResult = {
  seeded: boolean;
  decks: Deck[];
};

const DEMO_DECKS: DemoDeck[] = [
  {
    name: "English basics",
    cards: [
      {
        question: "cat",
        answer: "A small domesticated animal. In Ukrainian: kit.",
      },
      {
        question: "to borrow",
        answer: "To take and use something temporarily, then return it.",
      },
      {
        question: "reliable",
        answer: "Something or someone that can be trusted to work well.",
      },
      {
        question: "What does 'actually' mean?",
        answer: "It means 'in fact' or 'really', often used to correct an idea.",
      },
    ],
  },
  {
    name: "Programming fundamentals",
    cards: [
      {
        question: "What is a DTO?",
        answer:
          "DTO means Data Transfer Object. It defines the shape of data sent between client and server.",
      },
      {
        question: "Why are DTOs used?",
        answer:
          "They make request data explicit, typed, and easier to validate.",
      },
      {
        question: "What is IndexedDB?",
        answer:
          "IndexedDB is a browser database for storing structured data locally.",
      },
      {
        question: "What is a pure function?",
        answer:
          "A function that returns the same output for the same input and does not cause side effects.",
      },
    ],
  },
];

export async function seedDemoData(
  storage: FlashifyStorage,
): Promise<SeedDemoDataResult> {
  const existingDecks = await storage.listDecks();

  if (existingDecks.length > 0) {
    return {
      seeded: false,
      decks: existingDecks,
    };
  }

  const createdDecks: Deck[] = [];

  for (const demoDeck of DEMO_DECKS) {
    const deck = await storage.createDeck({
      name: demoDeck.name,
    });
    const cards = demoDeck.cards.map<CreateCardInput>((card) => ({
      deckId: deck.id,
      question: card.question,
      answer: card.answer,
    }));

    await storage.createCards(cards);
    createdDecks.push(deck);
  }

  return {
    seeded: true,
    decks: createdDecks,
  };
}
