import {
  OpenRouterConfigError,
  OpenRouterRequestError,
  requestJsonCompletion,
} from "@/lib/ai/openrouter";
import { CONTENT_LIMITS } from "@/lib/domain";

type ExplainCardRequest = {
  question?: unknown;
  answer?: unknown;
};

type ExplainCardResponse = {
  explanation: string;
};

const EXPLAIN_CARD_SCHEMA = {
  name: "explain_card",
  schema: {
    type: "object",
    properties: {
      explanation: { type: "string" },
    },
    required: ["explanation"],
    additionalProperties: false,
  },
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExplainCardRequest;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!question || !answer) {
      return Response.json(
        { error: "Question and answer are required." },
        { status: 400 },
      );
    }

    const parsed = await requestJsonCompletion<ExplainCardResponse>({
      jsonSchema: EXPLAIN_CARD_SCHEMA,
      maxTokens: 260,
      messages: [
        {
          role: "system",
          content:
            "You explain flashcard answers in 4-5 meaningful sentences for beginners. The explanation must complement the answer, not repeat it. Do not change the question or answer. Keep the full explanation at 500 characters or fewer.",
        },
        {
          role: "user",
          content: `Question: ${question}\nAnswer: ${answer}\n\nExplain the answer.`,
        },
      ],
    });

    const initialExplanation = normalizeExplanation(parsed.explanation);

    if (isValidExplanation(initialExplanation)) {
      return Response.json({ explanation: initialExplanation });
    }

    const shortened = await requestJsonCompletion<ExplainCardResponse>({
      jsonSchema: EXPLAIN_CARD_SCHEMA,
      maxTokens: 180,
      messages: [
        {
          role: "system",
          content:
            "Rewrite the draft as 4-5 meaningful, beginner-friendly sentences. Keep the full explanation at 500 characters or fewer. Preserve useful context, do not change the question or answer, and return only the JSON response.",
        },
        {
          role: "user",
          content: `Question: ${question}\nAnswer: ${answer}\n\nDraft explanation:\n${initialExplanation}`,
        },
      ],
    });

    const shortenedExplanation = normalizeExplanation(shortened.explanation);

    if (!isValidExplanation(shortenedExplanation)) {
      return Response.json(
        {
          error: `Explanation must be ${CONTENT_LIMITS.cardExplanation} characters or fewer.`,
        },
        { status: 422 },
      );
    }

    return Response.json({ explanation: shortenedExplanation });
  } catch (error) {
    return handleAiRouteError(error);
  }
}

function normalizeExplanation(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidExplanation(value: string): boolean {
  return Boolean(value) && value.length <= CONTENT_LIMITS.cardExplanation;
}

function handleAiRouteError(error: unknown) {
  if (error instanceof OpenRouterConfigError) {
    return Response.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof OpenRouterRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "AI explanation failed." }, { status: 500 });
}
