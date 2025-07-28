export type ImportCardDraft = {
  id: string;
  question: string;
  answer: string;
  explanation: string;
};

export function parseImportJson(text: string): ImportCardDraft[] | null {
  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }

  const rawCards =
    Array.isArray(payload) ? payload : getCardsArrayFromObject(payload);

  return rawCards
    .map((card) => normalizeImportCard(card))
    .filter((card): card is ImportCardDraft => card !== null);
}

function getCardsArrayFromObject(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const cards = (payload as { cards?: unknown }).cards;

  return Array.isArray(cards) ? cards : [];
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
