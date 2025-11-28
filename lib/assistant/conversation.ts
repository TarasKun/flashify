import type { Card, ChatMessage, StudyCardSide, StudyDirection } from "../domain";
import type { FlashifyStorage } from "../storage";
import { buildAssistantContext } from "./context";
import type { AssistantProvider } from "./types";

type AssistantConversationInput = {
  storage: Pick<
    FlashifyStorage,
    "createChatMessage" | "getOrCreateChatThread" | "listChatMessages"
  >;
  provider: AssistantProvider;
  card: Card;
  deckName: string;
  direction: StudyDirection;
  visibleSide: StudyCardSide;
};

export async function sendAssistantMessage(
  input: AssistantConversationInput & { message: string },
): Promise<ChatMessage[]> {
  const thread = await input.storage.getOrCreateChatThread(input.card.id);
  const existingMessages = await input.storage.listChatMessages(thread.id);
  const userMessage = await input.storage.createChatMessage({
    threadId: thread.id,
    cardId: input.card.id,
    role: "user",
    content: input.message,
  });
  const messagesForReply = [...existingMessages, userMessage];
  const reply = await input.provider.reply({
    context: buildAssistantContext({
      card: input.card,
      deckName: input.deckName,
      direction: input.direction,
      messages: messagesForReply,
      visibleSide: input.visibleSide,
    }),
    message: userMessage.content,
  });
  const assistantMessage = await input.storage.createChatMessage({
    threadId: thread.id,
    cardId: input.card.id,
    role: "assistant",
    content: reply.content,
  });

  return [...messagesForReply, assistantMessage];
}

export async function retryAssistantReply(
  input: AssistantConversationInput & { userMessage: ChatMessage },
): Promise<ChatMessage[]> {
  const messages = await input.storage.listChatMessages(input.userMessage.threadId);
  const reply = await input.provider.reply({
    context: buildAssistantContext({
      card: input.card,
      deckName: input.deckName,
      direction: input.direction,
      messages,
      visibleSide: input.visibleSide,
    }),
    message: input.userMessage.content,
  });
  const assistantMessage = await input.storage.createChatMessage({
    threadId: input.userMessage.threadId,
    cardId: input.card.id,
    role: "assistant",
    content: reply.content,
  });

  return [...messages, assistantMessage];
}
