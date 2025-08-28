import { describe, expect, it } from "vitest";
import { buildAiJsonPrompt } from "./ai-prompt";

describe("AI import prompt", () => {
  it("includes the active deck name as topic context", () => {
    const prompt = buildAiJsonPrompt("Programming fundamentals");

    expect(prompt).toContain("Deck/topic: Programming fundamentals");
    expect(prompt).toContain(
      "Use the deck/topic as context when the source text is short or ambiguous.",
    );
    expect(prompt).toContain("Return only JSON");
  });
});
