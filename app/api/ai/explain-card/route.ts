import {
  OpenRouterConfigError,
  OpenRouterRequestError,
  requestJsonCompletion,
} from "@/lib/ai/openrouter";

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
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You explain flashcard answers in 3-5 clear beginner-friendly sentences. Do not change the question or answer.",
        },
        {
          role: "user",
          content: `Question: ${question}\nAnswer: ${answer}\n\nExplain the answer.`,
        },
      ],
    });

    return Response.json({
      explanation: parsed.explanation.trim(),
    });
  } catch (error) {
    return handleAiRouteError(error);
  }
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
