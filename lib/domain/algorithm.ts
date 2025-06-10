import { LEARNING_CONFIG, type LearningConfig } from "./learning";
import type {
  Card,
  CardProgress,
  CardStatus,
  DirectionProgress,
  ReviewLevel,
  StudyAnswer,
  StudyDirection,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type StudyPriority = 0 | 1 | 2 | 3 | 4;

export type AnswerCardInput = {
  card: Card;
  direction: StudyDirection;
  answer: StudyAnswer;
  now: Date;
  config?: LearningConfig;
};

export function createEmptyDirectionProgress(): DirectionProgress {
  return {
    correctStreak: 0,
    mistakes: 0,
    lastAnsweredAt: null,
  };
}

export function createEmptyCardProgress(): CardProgress {
  return {
    forward: createEmptyDirectionProgress(),
    reverse: createEmptyDirectionProgress(),
  };
}

export function selectActivePool(
  cards: Card[],
  now: Date,
  config: Pick<LearningConfig, "ACTIVE_POOL_SIZE"> = LEARNING_CONFIG,
): Card[] {
  return cards
    .filter((card) => isEligibleForStudy(card, now))
    .sort((left, right) => compareStudyCards(left, right, now))
    .slice(0, config.ACTIVE_POOL_SIZE);
}

export function isEligibleForStudy(card: Card, now: Date): boolean {
  if (card.deletedAt) {
    return false;
  }

  if (card.status === "new" || card.status === "learning") {
    return true;
  }

  return isDue(card, now);
}

export function isDue(card: Card, now: Date): boolean {
  return Boolean(card.dueAt && Date.parse(card.dueAt) <= now.getTime());
}

export function getNextStudyDirection(card: Card): StudyDirection {
  if (!isDirectionComplete(card.progress.forward)) {
    return "forward";
  }

  return "reverse";
}

export function answerCard({
  card,
  direction,
  answer,
  now,
  config = LEARNING_CONFIG,
}: AnswerCardInput): Card {
  const preparedCard = prepareCardForStudy(card, now);

  if (answer === "dontKnow" && isLongReview(preparedCard)) {
    return resetCardToLearning(preparedCard, now);
  }

  const updatedProgress = updateProgressForAnswer(
    preparedCard.progress,
    direction,
    answer,
    now,
    config,
  );

  const updatedCard: Card = {
    ...preparedCard,
    progress: updatedProgress,
    updatedAt: now.toISOString(),
  };

  if (answer === "dontKnow") {
    return updatedCard;
  }

  if (!isCardStageComplete(updatedCard, config)) {
    return updatedCard;
  }

  return advanceCompletedCard(updatedCard, now, config);
}

export function isCardStageComplete(
  card: Pick<Card, "progress">,
  config: Pick<LearningConfig, "REQUIRED_STREAK_PER_DIRECTION"> = LEARNING_CONFIG,
): boolean {
  return (
    card.progress.forward.correctStreak >=
      config.REQUIRED_STREAK_PER_DIRECTION &&
    card.progress.reverse.correctStreak >= config.REQUIRED_STREAK_PER_DIRECTION
  );
}

export function resetCardToLearning(card: Card, now: Date): Card {
  return {
    ...card,
    status: "learning",
    reviewLevel: 0,
    dueAt: null,
    progress: createEmptyCardProgress(),
    updatedAt: now.toISOString(),
  };
}

function compareStudyCards(left: Card, right: Card, now: Date): number {
  const priorityDelta = getStudyPriority(left, now) - getStudyPriority(right, now);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return getStudyTimestamp(left) - getStudyTimestamp(right);
}

function getStudyPriority(card: Card, now: Date): StudyPriority {
  if (card.status === "resting" && isDue(card, now)) {
    return 0;
  }

  if (
    (card.status === "review" || card.status === "learned") &&
    isDue(card, now)
  ) {
    return 1;
  }

  if (card.status === "learning") {
    return 2;
  }

  if (card.status === "new") {
    return 3;
  }

  return 4;
}

function getStudyTimestamp(card: Card): number {
  if (card.dueAt) {
    return Date.parse(card.dueAt);
  }

  return Date.parse(card.updatedAt || card.createdAt);
}

function prepareCardForStudy(card: Card, now: Date): Card {
  if (card.status === "new") {
    return {
      ...card,
      status: "learning",
      updatedAt: now.toISOString(),
    };
  }

  if (card.status === "resting" && isDue(card, now)) {
    return {
      ...card,
      status: "learning",
      dueAt: null,
      updatedAt: now.toISOString(),
    };
  }

  if (card.status === "learned" && isDue(card, now)) {
    return {
      ...card,
      status: "review",
      dueAt: null,
      updatedAt: now.toISOString(),
    };
  }

  return card;
}

function updateProgressForAnswer(
  progress: CardProgress,
  direction: StudyDirection,
  answer: StudyAnswer,
  now: Date,
  config: Pick<LearningConfig, "WRONG_STREAK_PENALTY">,
): CardProgress {
  const directionProgress = progress[direction];
  const nextDirectionProgress =
    answer === "know"
      ? {
          ...directionProgress,
          correctStreak: directionProgress.correctStreak + 1,
          lastAnsweredAt: now.toISOString(),
        }
      : {
          ...directionProgress,
          correctStreak: Math.max(
            0,
            directionProgress.correctStreak - config.WRONG_STREAK_PENALTY,
          ),
          mistakes: directionProgress.mistakes + 1,
          lastAnsweredAt: now.toISOString(),
        };

  return {
    ...progress,
    [direction]: nextDirectionProgress,
  };
}

function advanceCompletedCard(
  card: Card,
  now: Date,
  config: LearningConfig,
): Card {
  const nextReviewLevel = getNextReviewLevel(card.reviewLevel);
  const nextStatus = getStatusForCompletedLevel(nextReviewLevel);
  const dueAt = getDueAtForCompletedLevel(nextReviewLevel, now, config);

  return {
    ...card,
    status: nextStatus,
    reviewLevel: nextReviewLevel,
    dueAt,
    progress: createEmptyCardProgress(),
    updatedAt: now.toISOString(),
  };
}

function getNextReviewLevel(reviewLevel: ReviewLevel): ReviewLevel {
  if (reviewLevel >= 4) {
    return 4;
  }

  return (reviewLevel + 1) as ReviewLevel;
}

function getStatusForCompletedLevel(reviewLevel: ReviewLevel): CardStatus {
  if (reviewLevel >= 3) {
    return "learned";
  }

  return "resting";
}

function getDueAtForCompletedLevel(
  reviewLevel: ReviewLevel,
  now: Date,
  config: LearningConfig,
): string {
  switch (reviewLevel) {
    case 1:
      return addHours(now, config.FIRST_REST_DELAY_HOURS).toISOString();
    case 2:
      return addHours(now, config.SECOND_REST_DELAY_HOURS).toISOString();
    case 3:
      return addDays(now, config.FIRST_LONG_REVIEW_DAYS).toISOString();
    case 4:
      return addDays(now, config.SECOND_LONG_REVIEW_DAYS).toISOString();
    case 0:
      return now.toISOString();
  }
}

function isLongReview(card: Card): boolean {
  return card.status === "learned" || card.status === "review";
}

function isDirectionComplete(directionProgress: DirectionProgress): boolean {
  return (
    directionProgress.correctStreak >=
    LEARNING_CONFIG.REQUIRED_STREAK_PER_DIRECTION
  );
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
