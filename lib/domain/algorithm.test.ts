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

  it("resets card progress on a wrong answer", () => {
    const card = makeCard({
      status: "learning",
      progress: {
        forward: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: null,
        },
        reverse: {
          correctStreak: 1,
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
    expect(firstWrongAnswer.progress.reverse.correctStreak).toBe(0);
    expect(secondWrongAnswer.progress.forward.correctStreak).toBe(0);
    expect(secondWrongAnswer.progress.forward.mistakes).toBe(2);
  });

  it("flips direction after one correct answer without completing the card", () => {
    const card = makeCard({
      status: "learning",
    });

    const updatedCard = answerCard({
      card,
      direction: "forward",
      answer: "know",
      now: NOW,
    });

    expect(isCardStageComplete(updatedCard)).toBe(false);
    expect(getNextStudyDirection(updatedCard)).toBe("reverse");
    expect(updatedCard.status).toBe("learning");
  });

  it("marks a card learned after one correct answer in each direction", () => {
    const card = makeCard({
      status: "learning",
      progress: {
        forward: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 0,
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
    expect(updatedCard.progress).toEqual(createEmptyCardProgress());
  });

  it("marks legacy resting progress learned after the next completed stage", () => {
    const card = makeCard({
      status: "learning",
      reviewLevel: 1,
      progress: {
        forward: {
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 0,
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
          correctStreak: 1,
          mistakes: 0,
          lastAnsweredAt: ISO_NOW,
        },
        reverse: {
          correctStreak: 0,
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

  it("prioritizes due cards and keeps recently answered active cards later", () => {
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
