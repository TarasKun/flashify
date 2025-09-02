export type ImportCardDraft = {
  id: string;
  question: string;
  answer: string;
  explanation: string;
};

export function parseImportJson(text: string): ImportCardDraft[] | null {
  let payload: unknown;

  try {
    payload = JSON.parse(normalizeJsonText(text));
  } catch {
    return null;
  }

  const rawCards =
    Array.isArray(payload) ? payload : getCardsArrayFromObject(payload);

  return rawCards
    .map((card) => normalizeImportCard(card))
    .filter((card): card is ImportCardDraft => card !== null);
}

export function isJsonLikeImportText(text: string): boolean {
  const normalizedText = normalizeJsonText(text);

  return normalizedText.startsWith("[") || normalizedText.startsWith("{");
}

function normalizeJsonText(text: string): string {
  const trimmedText = text.trim();
  const fencedJsonMatch = trimmedText.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );

  return fencedJsonMatch?.[1]?.trim() ?? trimmedText;
}

function getCardsArrayFromObject(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (isImportCardObject(payload)) {
    return [payload];
  }

  const cards = (payload as { cards?: unknown }).cards;

  return Array.isArray(cards) ? cards : [];
}

function isImportCardObject(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as {
    question?: unknown;
    answer?: unknown;
  };

  return (
    typeof record.question === "string" && typeof record.answer === "string"
  );
}

function normalizeImportCard(card: unknown): ImportCardDraft | null {
  if (!card || typeof card !== "object") {
    return null;
  }

  const record = card as {
    question?: unknown;
    answer?: unknown;
    explanation?: unknown;
  };
  const question =
    typeof record.question === "string" ? record.question.trim() : "";
  const answer = typeof record.answer === "string" ? record.answer.trim() : "";
  const explanation =
    typeof record.explanation === "string" ? record.explanation.trim() : "";

  if (!question || !answer) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    question,
    answer,
    explanation,
  };
}
