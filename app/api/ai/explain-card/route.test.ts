import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestJsonCompletion } = vi.hoisted(() => ({
  requestJsonCompletion: vi.fn(),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  OpenRouterConfigError: class OpenRouterConfigError extends Error {},
  OpenRouterRequestError: class OpenRouterRequestError extends Error {
    status = 500;
  },
  requestJsonCompletion,
}));

vi.mock("@/lib/domain", () => ({
  CONTENT_LIMITS: {
    cardExplanation: 500,
  },
}));

import { POST } from "./route";

function explainRequest() {
  return new Request("http://localhost/api/ai/explain-card", {
    body: JSON.stringify({
      question: "What is a DTO?",
      answer: "A Data Transfer Object.",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

describe("POST /api/ai/explain-card", () => {
  beforeEach(() => {
    requestJsonCompletion.mockReset();
  });

  it("returns a compliant explanation without a second AI request", async () => {
    requestJsonCompletion.mockResolvedValueOnce({
      explanation:
        "A DTO describes the data that moves between parts of an application. It keeps the expected shape explicit. This makes validation easier. It also reduces accidental coupling between layers.",
    });

    const response = await POST(explainRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      explanation:
        "A DTO describes the data that moves between parts of an application. It keeps the expected shape explicit. This makes validation easier. It also reduces accidental coupling between layers.",
    });
    expect(requestJsonCompletion).toHaveBeenCalledTimes(1);
    expect(requestJsonCompletion.mock.calls[0]?.[0].messages[0].content).toContain(
      "4-5 meaningful sentences",
    );
    expect(requestJsonCompletion.mock.calls[0]?.[0].messages[0].content).toContain(
      "500 characters",
    );
  });

  it("makes one shortening attempt when the first explanation exceeds 500 characters", async () => {
    requestJsonCompletion
      .mockResolvedValueOnce({ explanation: "x".repeat(501) })
      .mockResolvedValueOnce({
        explanation:
          "A DTO is a small object used to carry data between application layers. It defines an expected data shape. This makes incoming and outgoing data easier to validate. It also keeps transport details separate from business logic.",
      });

    const response = await POST(explainRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      explanation: expect.stringContaining("A DTO is a small object"),
    });
    expect(requestJsonCompletion).toHaveBeenCalledTimes(2);
    expect(requestJsonCompletion.mock.calls[1]?.[0].messages[0].content).toContain(
      "Rewrite the draft",
    );
  });

  it("rejects an explanation that remains too long after the shortening attempt", async () => {
    requestJsonCompletion
      .mockResolvedValueOnce({ explanation: "x".repeat(501) })
      .mockResolvedValueOnce({ explanation: "y".repeat(501) });

    const response = await POST(explainRequest());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Explanation must be 500 characters or fewer.",
    });
    expect(requestJsonCompletion).toHaveBeenCalledTimes(2);
  });
});
