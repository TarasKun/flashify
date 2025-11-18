export function buildAiJsonPrompt(deckName: string): string {
  return `Convert vocabulary or flashcard content into valid JSON for this deck.

Deck/topic: ${deckName}

Use the deck/topic as context when the source text is short or ambiguous.

Return one JSON code block and nothing else, so I can use the copy button.

Accepted format:
\`\`\`json
[
  {
    "question": "word, phrase, or question to study",
    "answer": "translation or answer",
    "explanation": "short extra context, example, or nuance that complements the answer"
  }
]
\`\`\`

Rules:
- question and answer are required strings.
- explanation is required for every card. Keep it to 1-3 short sentences.
- explanation must add useful context, an example, or a nuance. Do not simply repeat the answer.
- Do not add extra fields.
- Wrap the JSON in exactly one \`\`\`json code block.
- The content inside the code block must be valid JSON.
- Escape any double quotes inside string values with a backslash.
- Example of a valid escaped string: "Example: [\\"HTML\\", \\"CSS\\", \\"JavaScript\\"] is an array."
- Preserve the original meaning.
- Keep questions and answers relevant to the deck/topic.
- Make every card useful for bidirectional study whenever possible: either side should be a reasonable prompt for the other side.
- Prefer precise term/concept <-> clear definition/translation/example pairs.
- Avoid vague prompts like "What is important here?", "Explain this concept", or questions with many valid answers.
- If the source describes a concept, put the exact concept name or term on one side and a specific, unambiguous definition on the other side.
- Keep answers deterministic: the user should know exactly what answer is expected, not guess from an abstract clue.
- Do not create cards where reversing question and answer would feel confusing unless the source only supports one direction.`;
}
