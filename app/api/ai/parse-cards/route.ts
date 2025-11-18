import {
  OpenRouterConfigError,
  OpenRouterRequestError,
  requestJsonCompletion,
} from "@/lib/ai/openrouter";

type ParseCardsRequest = {
  text?: unknown;
};

type ParsedCard = {
  question: string;
  answer: string;
  explanation: string;
};

type ParseCardsResponse = {
  cards: ParsedCard[];
};

const PARSE_CARDS_SCHEMA = {
  name: "parse_cards",
  schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["question", "answer", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["cards"],
    additionalProperties: false,
  },
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ParseCardsRequest;
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return Response.json({ error: "Text is required." }, { status: 400 });
    }

    const parsed = await requestJsonCompletion<ParseCardsResponse>({
      jsonSchema: PARSE_CARDS_SCHEMA,
      maxTokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You parse supplied study notes into flashcards. Parse only the provided text. Do not invent unrelated cards. Keep each full answer in the answer field. Add a 1-3 sentence explanation for every card that complements the answer with useful context, an example, or a nuance without simply repeating the answer.",
        },
        {
          role: "user",
          content: `Parse this text into flashcards:\n\n${text}`,
        },
      ],
    });

    return Response.json({
      cards: sanitizeParsedCards(parsed.cards),
    });
  } catch (error) {
    return handleAiRouteError(error);
  }
}

function sanitizeParsedCards(cards: ParsedCard[]): ParsedCard[] {
  return cards
    .map((card) => ({
      question: card.question.trim(),
      answer: card.answer.trim(),
      explanation: card.explanation.trim(),
    }))
    .filter((card) => card.question && card.answer);
}

function handleAiRouteError(error: unknown) {
  if (error instanceof OpenRouterConfigError) {
    return Response.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof OpenRouterRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "AI parsing failed." }, { status: 500 });
}
