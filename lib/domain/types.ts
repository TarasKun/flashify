export type ISODateString = string;

export type EntityId = string;

export type Deck = {
  id: EntityId;
  name: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CardStatus = "new" | "learning" | "resting" | "learned" | "review";

export type ReviewLevel = 0 | 1 | 2 | 3 | 4;

export type StudyDirection = "forward" | "reverse";

export type DirectionProgress = {
  correctStreak: number;
  mistakes: number;
  lastAnsweredAt: ISODateString | null;
};

export type CardProgress = {
  forward: DirectionProgress;
  reverse: DirectionProgress;
};

export type Card = {
  id: EntityId;
  deckId: EntityId;
  question: string;
  answer: string;
  explanation: string;
  status: CardStatus;
  reviewLevel: ReviewLevel;
  dueAt: ISODateString | null;
  progress: CardProgress;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt: ISODateString | null;
};

export type CreateDeckInput = {
  name: string;
};

export type UpdateDeckInput = Partial<CreateDeckInput>;

export type CreateCardInput = {
  deckId: EntityId;
  question: string;
  answer: string;
  explanation?: string;
};

export type UpdateCardInput = Partial<{
  question: string;
  answer: string;
  explanation: string;
  status: CardStatus;
  reviewLevel: ReviewLevel;
  dueAt: ISODateString | null;
  progress: CardProgress;
  deletedAt: ISODateString | null;
}>;

export type StudyCardSide = "prompt" | "answer";

export type StudyCardView = {
  cardId: EntityId;
  direction: StudyDirection;
  side: StudyCardSide;
};

export type StudyAnswer = "know" | "dontKnow";
