import { describe, expect, it } from "vitest";
import { buildAiJsonPrompt } from "./ai-prompt";

describe("AI import prompt", () => {
  it("includes the active deck name as topic context", () => {
    const prompt = buildAiJsonPrompt("Programming fundamentals");

    expect(prompt).toContain("Deck/topic: Programming fundamentals");
    expect(prompt).toContain(
      "Use the deck/topic as context when the source text is short or ambiguous.",
    );
    expect(prompt).toContain("Return one JSON code block");
    expect(prompt).toContain("```json");
    expect(prompt).toContain(
      'Example: [\\"HTML\\", \\"CSS\\", \\"JavaScript\\"] is an array.',
    );
    expect(prompt).toContain("explanation is required for every card");
    expect(prompt).toContain(
      "explanation must add useful context, an example, or a nuance",
    );
  });
});
