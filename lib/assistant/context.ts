import type { Card, ChatMessage, StudyCardSide, StudyDirection } from "../domain";
import type { AssistantContext } from "./types";

export function buildAssistantContext({
  card,
  deckName,
  direction,
  messages,
  visibleSide,
}: {
  card: Card;
  deckName: string;
  direction: StudyDirection;
  messages: ChatMessage[];
  visibleSide: StudyCardSide;
}): AssistantContext {
  return {
    deckName,
    question: card.question,
    answer: card.answer,
    explanation: card.explanation,
    direction,
    visibleSide,
    progress: card.progress,
    messages,
  };
}
