export const CONTENT_LIMITS = {
  deckName: 80,
  cardQuestion: 500,
  cardAnswer: 1_500,
  cardExplanation: 500,
  importSourceText: 50_000,
  importCardCount: 200,
  chatMessage: 2_000,
} as const;

export type ContentValidationResult =
  | { isValid: true }
  | { isValid: false; message: string };

export type CardContent = {
  question: string;
  answer: string;
  explanation?: string;
};

export function validateDeckName(value: string): ContentValidationResult {
  return validateRequiredText(value, "Deck name", CONTENT_LIMITS.deckName);
}

export function validateCardContent(
  value: CardContent,
): ContentValidationResult {
  const questionResult = validateRequiredText(
    value.question,
    "Question",
    CONTENT_LIMITS.cardQuestion,
  );

  if (!questionResult.isValid) {
    return questionResult;
  }

  const answerResult = validateRequiredText(
    value.answer,
    "Answer",
    CONTENT_LIMITS.cardAnswer,
  );

  if (!answerResult.isValid) {
    return answerResult;
  }

  return validateOptionalText(
    value.explanation ?? "",
    "Explanation",
    CONTENT_LIMITS.cardExplanation,
  );
}

export function validateImportSourceText(
  value: string,
): ContentValidationResult {
  return validateOptionalText(
    value,
    "Import text",
    CONTENT_LIMITS.importSourceText,
  );
}

export function validateImportCardCount(
  count: number,
): ContentValidationResult {
  if (count <= CONTENT_LIMITS.importCardCount) {
    return { isValid: true };
  }

  return {
    isValid: false,
    message: `Import supports up to ${CONTENT_LIMITS.importCardCount} cards.`,
  };
}

export function validateImportCards(
  cards: CardContent[],
): ContentValidationResult {
  const countResult = validateImportCardCount(cards.length);

  if (!countResult.isValid) {
    return countResult;
  }

  for (const [index, card] of cards.entries()) {
    const cardResult = validateCardContent(card);

    if (!cardResult.isValid) {
      return {
        isValid: false,
        message: `Card ${index + 1}: ${cardResult.message}`,
      };
    }
  }

  return { isValid: true };
}

export function validateChatMessage(value: string): ContentValidationResult {
  return validateRequiredText(value, "Message", CONTENT_LIMITS.chatMessage);
}

function validateRequiredText(
  value: string,
  label: string,
  maxLength: number,
): ContentValidationResult {
  if (!value.trim()) {
    return {
      isValid: false,
      message: `${label} is required.`,
    };
  }

  return validateOptionalText(value, label, maxLength);
}

function validateOptionalText(
  value: string,
  label: string,
  maxLength: number,
): ContentValidationResult {
  if (value.length <= maxLength) {
    return { isValid: true };
  }

  return {
    isValid: false,
    message: `${label} must be ${formatLimit(maxLength)} characters or fewer.`,
  };
}

function formatLimit(limit: number): string {
  return new Intl.NumberFormat("en-US").format(limit);
}
