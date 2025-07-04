type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

type RequestJsonCompletionOptions = {
  messages: OpenRouterMessage[];
  jsonSchema: OpenRouterJsonSchema;
  maxTokens?: number;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-8b-instruct:free";

export class OpenRouterConfigError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not configured.");
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.status = status;
  }
}

export async function requestJsonCompletion<T>({
  messages,
  jsonSchema,
  maxTokens = 800,
}: RequestJsonCompletionOptions): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new OpenRouterConfigError();
  }

  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Flashify",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: jsonSchema.name,
          strict: true,
          schema: jsonSchema.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new OpenRouterRequestError(
      response.status,
      await getOpenRouterErrorMessage(response),
    );
  }

  const payload = (await response.json()) as OpenRouterChatResponse;
  const content = normalizeMessageContent(payload.choices?.[0]?.message?.content);

  return parseJsonContent<T>(content);
}

async function getOpenRouterErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };

    return payload.error?.message ?? `OpenRouter request failed: ${response.status}`;
  } catch {
    return `OpenRouter request failed: ${response.status}`;
  }
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function parseJsonContent<T>(content: string): T {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("AI response was empty.");
  }

  try {
    return JSON.parse(trimmedContent) as T;
  } catch {
    const jsonMatch = trimmedContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON.");
    }

    return JSON.parse(jsonMatch[0]) as T;
  }
}
