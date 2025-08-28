export function buildAiJsonPrompt(deckName: string): string {
  return `Convert vocabulary or flashcard content into valid JSON for this deck.

Deck/topic: ${deckName}

Use the deck/topic as context when the source text is short or ambiguous.

Return only JSON, no markdown, no comments.

Accepted format:
[
  {
    "question": "word, phrase, or question to study",
    "answer": "translation or answer",
    "explanation": "short explanation or example sentence, optional"
  }
]

Rules:
- question and answer are required strings.
- explanation is optional. Omit it if there is no useful explanation.
- Do not add extra fields.
- Do not wrap the JSON in markdown.
- Preserve the original meaning.
- Keep questions and answers relevant to the deck/topic.`;
}
