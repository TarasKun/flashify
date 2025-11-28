import type {
  CardProgress,
  ChatMessage,
  StudyCardSide,
  StudyDirection,
} from "../domain";

export type AssistantContext = {
  deckName: string;
  question: string;
  answer: string;
  explanation: string;
  direction: StudyDirection;
  visibleSide: StudyCardSide;
  progress: CardProgress;
  messages: ChatMessage[];
};

export type AssistantProvider = {
  reply(input: {
    context: AssistantContext;
    message: string;
  }): Promise<{ content: string }>;
};
