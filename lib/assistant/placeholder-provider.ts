import type { AssistantProvider } from "./types";

const PLACEHOLDER_REPLY =
  "Assistant replies will appear here soon. For now, review the card answer and explanation, then try recalling it in both directions.";

export function createPlaceholderAssistantProvider(): AssistantProvider {
  return {
    async reply() {
      return { content: PLACEHOLDER_REPLY };
    },
  };
}
