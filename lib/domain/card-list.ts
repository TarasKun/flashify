import { LEARNING_CONFIG } from "./learning";
import type { Card } from "./types";

export type CardLearningProgress = {
  completed: number;
  total: number;
  percent: number;
  isLearned: boolean;
  label: string;
};

export function sortCardsForDeckList(cards: Card[]): Card[] {
  return [...cards].sort((left, right) => {
    const learnedDelta =
      Number(left.status === "learned") - Number(right.status === "learned");

    if (learnedDelta !== 0) {
      return learnedDelta;
    }

    const progressDelta =
      getCardLearningProgress(left).completed -
      getCardLearningProgress(right).completed;

    if (progressDelta !== 0) {
      return progressDelta;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function getCardLearningProgress(card: Card): CardLearningProgress {
  const requiredStreak = LEARNING_CONFIG.REQUIRED_STREAK_PER_DIRECTION;
  const stageSize = requiredStreak * 2;
  const total = stageSize * 3;
  const currentStageProgress = Math.min(
    stageSize,
    Math.min(card.progress.forward.correctStreak, requiredStreak) +
      Math.min(card.progress.reverse.correctStreak, requiredStreak),
  );
  const isLearned = card.status === "learned";
  const completed = isLearned
    ? total
    : Math.min(total, card.reviewLevel * stageSize + currentStageProgress);

  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    isLearned,
    label: isLearned ? "Learned" : getStatusLabel(card.status),
  };
}

function getStatusLabel(status: Card["status"]): string {
  switch (status) {
    case "new":
      return "New";
    case "learning":
      return "Learning";
    case "resting":
      return "Resting";
    case "review":
      return "Review";
    case "learned":
      return "Learned";
  }
}
