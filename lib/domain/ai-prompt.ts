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
    "explanation": "short explanation or example sentence, optional"
  }
]
\`\`\`

Rules:
- question and answer are required strings.
- explanation is optional. Omit it if there is no useful explanation.
- Do not add extra fields.
- Wrap the JSON in exactly one \`\`\`json code block.
- The content inside the code block must be valid JSON.
- Escape any double quotes inside string values with a backslash.
- Example of a valid escaped string: "Example: [\\"HTML\\", \\"CSS\\", \\"JavaScript\\"] is an array."
- Preserve the original meaning.
- Keep questions and answers relevant to the deck/topic.`;
}
