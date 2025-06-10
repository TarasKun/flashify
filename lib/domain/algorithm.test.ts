import { describe, expect, it } from "vitest";
import {
  answerCard,
  createEmptyCardProgress,
  getNextStudyDirection,
  isCardStageComplete,
  isEligibleForStudy,
  selectActivePool,
} from "./algorithm";
import type { Card } from "./types";

const NOW = new Date("2025-06-10T14:23:00.000Z");
const ISO_NOW = NOW.toISOString();

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    deckId: "deck-1",
    question: "What is a DTO?",
    answer: "Data Transfer Object",
    explanation: "",
    status: "new",
    reviewLevel: 0,
    dueAt: null,
    progress: createEmptyCardProgress(),
    createdAt: "2025-06-01T10:00:00.000Z",
    updatedAt: "2025-06-01T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("learning algorithm", () => {
  it("increments the current direction streak on a correct answer", () => {
    const card = makeCard();

    const updatedCard = answerCard({
      card,
      direction: "forward",
      answer: "know",
      now: NOW,
    });

    expect(updatedCard.status).toBe("learning");
    expect(updatedCard.progress.forward.correctStreak).toBe(1);
    expect(updatedCard.progress.forward.mistakes).toBe(0);
    expect(updatedCard.progress.forward.lastAnsweredAt).toBe(ISO_NOW);
    expect(updatedCard.progress.reverse.correctStreak).toBe(0);
  });

  it("reduces the current direction streak on a wrong answer without going below zero", () => {
    const card = makeCard({
      status: "learning",
      progress: {
        forward: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: null,
        },
        reverse: {
          correctStreak: 0,
          mistakes: 0,
          lastAnsweredAt: null,
        },
      },
    });

    const firstWrongAnswer = answerCard({
      card,
      direction: "forward",
      answer: "dontKnow",
      now: NOW,
    });
    const secondWrongAnswer = answerCard({
      card: firstWrongAnswer,
      direction: "forward",
      answer: "dontKnow",
      now: NOW,
    });

    expect(firstWrongAnswer.progress.forward.correctStreak).toBe(0);
    expect(firstWrongAnswer.progress.forward.mistakes).toBe(1);
    expect(secondWrongAnswer.progress.forward.correctStreak).toBe(0);
    expect(secondWrongAnswer.progress.forward.mistakes).toBe(2);
  });

  it("does not complete a card until both directions reach the required streak", () => {
    const card = makeCard({
      status: "learning",
      progress: {
        forward: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
      },
    });

    expect(isCardStageComplete(card)).toBe(false);
    expect(getNextStudyDirection(card)).toBe("reverse");

    const completedCard = answerCard({
      card,
      direction: "reverse",
      answer: "know",
      now: NOW,
    });

    expect(completedCard.status).toBe("resting");
    expect(completedCard.reviewLevel).toBe(1);
  });

  it("moves a completed initial stage to the 3 hour rest stage", () => {
    const card = makeCard({
      status: "learning",
      progress: {
        forward: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
      },
    });

    const updatedCard = answerCard({
      card,
      direction: "reverse",
      answer: "know",
      now: NOW,
    });

    expect(updatedCard.status).toBe("resting");
    expect(updatedCard.reviewLevel).toBe(1);
    expect(updatedCard.dueAt).toBe("2025-06-10T17:23:00.000Z");
    expect(updatedCard.progress).toEqual(createEmptyCardProgress());
  });

  it("moves a completed second stage to the 12 hour rest stage", () => {
    const card = makeCard({
      status: "learning",
      reviewLevel: 1,
      progress: {
        forward: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
      },
    });

    const updatedCard = answerCard({
      card,
      direction: "reverse",
      answer: "know",
      now: NOW,
    });

    expect(updatedCard.status).toBe("resting");
    expect(updatedCard.reviewLevel).toBe(2);
    expect(updatedCard.dueAt).toBe("2025-06-11T02:23:00.000Z");
  });

  it("marks a card learned and schedules the 7 day review after the third successful stage", () => {
    const card = makeCard({
      status: "learning",
      reviewLevel: 2,
      progress: {
        forward: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
      },
    });

    const updatedCard = answerCard({
      card,
      direction: "reverse",
      answer: "know",
      now: NOW,
    });

    expect(updatedCard.status).toBe("learned");
    expect(updatedCard.reviewLevel).toBe(3);
    expect(updatedCard.dueAt).toBe("2025-06-17T14:23:00.000Z");
  });

  it("schedules the 30 day review after a successful 7 day review", () => {
    const card = makeCard({
      status: "review",
      reviewLevel: 3,
      progress: {
        forward: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
      },
    });

    const updatedCard = answerCard({
      card,
      direction: "reverse",
      answer: "know",
      now: NOW,
    });

    expect(updatedCard.status).toBe("learned");
    expect(updatedCard.reviewLevel).toBe(4);
    expect(updatedCard.dueAt).toBe("2025-07-10T14:23:00.000Z");
  });

  it("resets a failed learned review fully to learning", () => {
    const card = makeCard({
      status: "learned",
      reviewLevel: 3,
      dueAt: "2025-06-09T14:23:00.000Z",
      progress: {
        forward: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 2,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
      },
    });

    const updatedCard = answerCard({
      card,
      direction: "forward",
      answer: "dontKnow",
      now: NOW,
    });

    expect(updatedCard.status).toBe("learning");
    expect(updatedCard.reviewLevel).toBe(0);
    expect(updatedCard.dueAt).toBeNull();
    expect(updatedCard.progress).toEqual(createEmptyCardProgress());
  });

  it("prioritizes due cards over learning and new cards in the active pool", () => {
    const overdueResting = makeCard({
      id: "overdue-resting",
      status: "resting",
      reviewLevel: 1,
      dueAt: "2025-06-10T13:00:00.000Z",
    });
    const dueReview = makeCard({
      id: "due-review",
      status: "learned",
      reviewLevel: 3,
      dueAt: "2025-06-10T13:30:00.000Z",
    });
    const learning = makeCard({
      id: "learning",
      status: "learning",
      updatedAt: "2025-06-10T12:00:00.000Z",
    });
    const newCard = makeCard({
      id: "new",
      status: "new",
      updatedAt: "2025-06-10T11:00:00.000Z",
    });
    const learnedNotDue = makeCard({
      id: "learned-not-due",
      status: "learned",
      reviewLevel: 3,
      dueAt: "2025-06-12T14:23:00.000Z",
    });

    const pool = selectActivePool(
      [newCard, learnedNotDue, learning, dueReview, overdueResting],
      NOW,
      { ACTIVE_POOL_SIZE: 10 },
    );

    expect(pool.map((card) => card.id)).toEqual([
      "overdue-resting",
      "due-review",
      "learning",
      "new",
    ]);
  });

  it("excludes deleted cards and learned cards that are not due", () => {
    const deletedCard = makeCard({
      deletedAt: "2025-06-09T14:23:00.000Z",
    });
    const learnedNotDue = makeCard({
      status: "learned",
      reviewLevel: 3,
      dueAt: "2025-06-12T14:23:00.000Z",
    });
    const learnedDue = makeCard({
      status: "learned",
      reviewLevel: 3,
      dueAt: "2025-06-09T14:23:00.000Z",
    });

    expect(isEligibleForStudy(deletedCard, NOW)).toBe(false);
    expect(isEligibleForStudy(learnedNotDue, NOW)).toBe(false);
    expect(isEligibleForStudy(learnedDue, NOW)).toBe(true);
  });
});
