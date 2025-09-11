import { describe, expect, it } from "vitest";
import { createEmptyCardProgress } from "./algorithm";
import {
  getCardLearningProgress,
  sortCardsForDeckList,
} from "./card-list";
import type { Card } from "./types";

const BASE_DATE = "2025-06-01T10:00:00.000Z";

describe("deck card list helpers", () => {
  it("calculates visible learning progress from review level and direction streaks", () => {
    const card = makeCard({
      status: "learning",
      reviewLevel: 1,
      forwardStreak: 2,
      reverseStreak: 1,
    });

    expect(getCardLearningProgress(card)).toMatchObject({
      completed: 7,
      total: 12,
      percent: 58,
      isLearned: false,
      label: "Learning",
    });
  });

  it("clamps direction streak progress to the required streak per direction", () => {
    const card = makeCard({
      status: "review",
      reviewLevel: 2,
      forwardStreak: 99,
      reverseStreak: 99,
    });

    expect(getCardLearningProgress(card)).toMatchObject({
      completed: 12,
      total: 12,
      percent: 100,
      isLearned: false,
      label: "Review",
    });
  });

  it("marks learned cards as complete for the list indicator", () => {
    const card = makeCard({
      status: "learned",
      reviewLevel: 3,
    });

    expect(getCardLearningProgress(card)).toMatchObject({
      completed: 12,
      total: 12,
      percent: 100,
      isLearned: true,
      label: "Learned",
    });
  });

  it("sorts cards from least learned to most learned with learned cards last", () => {
    const cards = [
      makeCard({
        id: "learned",
        status: "learned",
        reviewLevel: 3,
        createdAt: "2025-06-01T09:00:00.000Z",
      }),
      makeCard({
        id: "resting",
        status: "resting",
        reviewLevel: 1,
        createdAt: "2025-06-01T08:00:00.000Z",
      }),
      makeCard({
        id: "new",
        status: "new",
        reviewLevel: 0,
        createdAt: "2025-06-01T11:00:00.000Z",
      }),
      makeCard({
        id: "learning",
        status: "learning",
        reviewLevel: 0,
        forwardStreak: 1,
        reverseStreak: 1,
        createdAt: "2025-06-01T07:00:00.000Z",
      }),
    ];

    expect(sortCardsForDeckList(cards).map((card) => card.id)).toEqual([
      "new",
      "learning",
      "resting",
      "learned",
    ]);
  });

  it("keeps older cards first when progress is equal", () => {
    const cards = [
      makeCard({
        id: "newer",
        createdAt: "2025-06-01T12:00:00.000Z",
      }),
      makeCard({
        id: "older",
        createdAt: "2025-06-01T06:00:00.000Z",
      }),
    ];

    expect(sortCardsForDeckList(cards).map((card) => card.id)).toEqual([
      "older",
      "newer",
    ]);
  });
});

function makeCard({
  id = "card",
  status = "new",
  reviewLevel = 0,
  forwardStreak = 0,
  reverseStreak = 0,
  createdAt = BASE_DATE,
}: Partial<{
  id: string;
  status: Card["status"];
  reviewLevel: Card["reviewLevel"];
  forwardStreak: number;
  reverseStreak: number;
  createdAt: string;
}> = {}): Card {
  return {
    id,
    deckId: "deck",
    question: "Question",
    answer: "Answer",
    explanation: "",
    status,
    reviewLevel,
    dueAt: null,
    progress: {
      ...createEmptyCardProgress(),
      forward: {
        correctStreak: forwardStreak,
        mistakes: 0,
        lastAnsweredAt: null,
      },
      reverse: {
        correctStreak: reverseStreak,
        mistakes: 0,
        lastAnsweredAt: null,
      },
    },
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}
