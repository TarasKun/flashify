import { describe, expect, it } from "vitest";
import {
  buildAssistantContext,
  createPlaceholderAssistantProvider,
  type AssistantContext,
} from "./index";
import { createEmptyCardProgress, type Card, type ChatMessage } from "../domain";

const card: Card = {
  answer: "A Data Transfer Object.",
  createdAt: "2026-07-12T10:00:00.000Z",
  deckId: "deck-1",
  deletedAt: null,
  dueAt: null,
  explanation: "It defines data passed between application layers.",
  id: "card-1",
  progress: createEmptyCardProgress(),
  question: "What is a DTO?",
  reviewLevel: 0,
  status: "new",
  updatedAt: "2026-07-12T10:00:00.000Z",
};

const messages: ChatMessage[] = [
  {
    cardId: card.id,
    content: "Can you show an example?",
    createdAt: "2026-07-12T10:01:00.000Z",
    deletedAt: null,
    id: "message-1",
    receivedAt: null,
    role: "user",
    threadId: "thread-1",
  },
];

describe("assistant context", () => {
  it("builds the complete card and conversation context", () => {
    expect(
      buildAssistantContext({
        card,
        deckName: "Programming",
        direction: "forward",
        messages,
        visibleSide: "answer",
      }),
    ).toEqual({
      answer: card.answer,
      deckName: "Programming",
      direction: "forward",
      explanation: card.explanation,
      messages,
      progress: card.progress,
      question: card.question,
      visibleSide: "answer",
    });
  });

  it("returns a deterministic placeholder reply through the provider interface", async () => {
    const context: AssistantContext = buildAssistantContext({
      card,
      deckName: "Programming",
      direction: "reverse",
      messages,
      visibleSide: "prompt",
    });

    await expect(
      createPlaceholderAssistantProvider().reply({
        context,
        message: "What should I remember?",
      }),
    ).resolves.toEqual({
      content:
        "Assistant replies will appear here soon. For now, review the card answer and explanation, then try recalling it in both directions.",
    });
  });
});
