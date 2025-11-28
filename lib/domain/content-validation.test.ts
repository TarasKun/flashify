import { describe, expect, it } from "vitest";
import {
  CONTENT_LIMITS,
  validateCardContent,
  validateChatMessage,
  validateDeckName,
  validateImportCardCount,
  validateImportCards,
  validateImportSourceText,
} from "./content-validation";

describe("content validation", () => {
  it("rejects a whitespace-only deck name", () => {
    expect(validateDeckName("   ")).toEqual({
      isValid: false,
      message: "Deck name is required.",
    });
  });

  it("accepts a deck name at the maximum length and rejects one over it", () => {
    expect(validateDeckName("d".repeat(CONTENT_LIMITS.deckName))).toEqual({
      isValid: true,
    });
    expect(validateDeckName("d".repeat(CONTENT_LIMITS.deckName + 1))).toEqual({
      isValid: false,
      message: "Deck name must be 80 characters or fewer.",
    });
  });

  it("rejects missing question and answer values after trimming", () => {
    expect(
      validateCardContent({
        question: "  ",
        answer: "Answer",
      }),
    ).toEqual({
      isValid: false,
      message: "Question is required.",
    });
    expect(
      validateCardContent({
        question: "Question",
        answer: "  ",
      }),
    ).toEqual({
      isValid: false,
      message: "Answer is required.",
    });
  });

  it("enforces every card field limit", () => {
    expect(
      validateCardContent({
        question: "q".repeat(CONTENT_LIMITS.cardQuestion + 1),
        answer: "Answer",
      }),
    ).toEqual({
      isValid: false,
      message: "Question must be 500 characters or fewer.",
    });
    expect(
      validateCardContent({
        question: "Question",
        answer: "a".repeat(CONTENT_LIMITS.cardAnswer + 1),
      }),
    ).toEqual({
      isValid: false,
      message: "Answer must be 1,500 characters or fewer.",
    });
    expect(
      validateCardContent({
        question: "Question",
        answer: "Answer",
        explanation: "e".repeat(CONTENT_LIMITS.cardExplanation + 1),
      }),
    ).toEqual({
      isValid: false,
      message: "Explanation must be 500 characters or fewer.",
    });
  });

  it("accepts a card at every field boundary", () => {
    expect(
      validateCardContent({
        question: "q".repeat(CONTENT_LIMITS.cardQuestion),
        answer: "a".repeat(CONTENT_LIMITS.cardAnswer),
        explanation: "e".repeat(CONTENT_LIMITS.cardExplanation),
      }),
    ).toEqual({ isValid: true });
  });

  it("enforces import source and card batch limits", () => {
    expect(
      validateImportSourceText("x".repeat(CONTENT_LIMITS.importSourceText)),
    ).toEqual({ isValid: true });
    expect(
      validateImportSourceText(
        "x".repeat(CONTENT_LIMITS.importSourceText + 1),
      ),
    ).toEqual({
      isValid: false,
      message: "Import text must be 50,000 characters or fewer.",
    });
    expect(validateImportCardCount(CONTENT_LIMITS.importCardCount)).toEqual({
      isValid: true,
    });
    expect(validateImportCardCount(CONTENT_LIMITS.importCardCount + 1)).toEqual(
      {
        isValid: false,
        message: "Import supports up to 200 cards.",
      },
    );
  });

  it("identifies the first invalid import card", () => {
    expect(
      validateImportCards([
        { question: "Question", answer: "Answer", explanation: "" },
        {
          question: "Question",
          answer: "a".repeat(CONTENT_LIMITS.cardAnswer + 1),
          explanation: "",
        },
      ]),
    ).toEqual({
      isValid: false,
      message: "Card 2: Answer must be 1,500 characters or fewer.",
    });
  });

  it("rejects whitespace-only and oversized chat messages", () => {
    expect(validateChatMessage("  ")).toEqual({
      isValid: false,
      message: "Message is required.",
    });
    expect(
      validateChatMessage("m".repeat(CONTENT_LIMITS.chatMessage + 1)),
    ).toEqual({
      isValid: false,
      message: "Message must be 2,000 characters or fewer.",
    });
  });
});
