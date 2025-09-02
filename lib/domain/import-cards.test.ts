import { describe, expect, it } from "vitest";
import { isJsonLikeImportText, parseImportJson } from "./import-cards";

describe("import card JSON parser", () => {
  it("parses a card array with optional explanations", () => {
    const cards = parseImportJson(`
      [
        {
          "question": "cat",
          "answer": "кіт",
          "explanation": "A common domestic animal."
        },
        {
          "question": "dog",
          "answer": "пес"
        }
      ]
    `);

    expect(cards).toMatchObject([
      {
        question: "cat",
        answer: "кіт",
        explanation: "A common domestic animal.",
      },
      {
        question: "dog",
        answer: "пес",
        explanation: "",
      },
    ]);
  });

  it("parses a cards property from an object payload", () => {
    const cards = parseImportJson(`
      {
        "cards": [
          {
            "question": "DTO",
            "answer": "Data Transfer Object"
          }
        ]
      }
    `);

    expect(cards).toMatchObject([
      {
        question: "DTO",
        answer: "Data Transfer Object",
        explanation: "",
      },
    ]);
  });

  it("parses a single card object payload", () => {
    const cards = parseImportJson(`
      {
        "question": "cat",
        "answer": "кіт"
      }
    `);

    expect(cards).toMatchObject([
      {
        question: "cat",
        answer: "кіт",
        explanation: "",
      },
    ]);
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    const cards = parseImportJson(`
      \`\`\`json
      [
        {
          "question": "dog",
          "answer": "пес"
        }
      ]
      \`\`\`
    `);

    expect(cards).toMatchObject([
      {
        question: "dog",
        answer: "пес",
      },
    ]);
  });

  it("skips invalid card entries", () => {
    const cards = parseImportJson(`
      [
        { "question": "valid", "answer": "ok" },
        { "question": "", "answer": "missing question" },
        { "question": "missing answer" },
        "not a card"
      ]
    `);

    expect(cards).toHaveLength(1);
    expect(cards?.[0]).toMatchObject({
      question: "valid",
      answer: "ok",
    });
  });

  it("returns null when the text is not JSON", () => {
    expect(parseImportJson("cat - кіт")).toBeNull();
  });

  it("detects JSON-like import text", () => {
    expect(isJsonLikeImportText('[{ "question": "cat"')).toBe(true);
    expect(isJsonLikeImportText("```json\n[]\n```")).toBe(true);
    expect(isJsonLikeImportText("cat - кіт")).toBe(false);
  });
});
