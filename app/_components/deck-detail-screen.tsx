"use client";

import {
  ArrowLeft,
  Check,
  X,
  FileInput,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Card, Deck } from "@/lib/domain";
import { createIndexedDbStorage, type DeckProgress } from "@/lib/storage";

type DeckDetailScreenProps = {
  deckId: string;
};

type ImportPreviewCard = {
  id: string;
  question: string;
  answer: string;
};

export function DeckDetailScreen({ deckId }: DeckDetailScreenProps) {
  const router = useRouter();
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [progress, setProgress] = useState<DeckProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [isImportingText, setIsImportingText] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [isImportingCards, setIsImportingCards] = useState(false);
  const [importPreviewCards, setImportPreviewCards] = useState<
    ImportPreviewCard[]
  >([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState("");
  const [editingAnswer, setEditingAnswer] = useState("");

  const loadDeck = useCallback(async () => {
    setIsLoading(true);
    const nextDeck = await storage.getDeck(deckId);

    if (!nextDeck) {
      setDeck(null);
      setCards([]);
      setProgress(null);
      setIsLoading(false);
      return;
    }

    const [nextCards, nextProgress] = await Promise.all([
      storage.listCardsForDeck(deckId),
      storage.getDeckProgress(deckId),
    ]);

    setDeck(nextDeck);
    setDeckName(nextDeck.name);
    setCards(nextCards);
    setProgress(nextProgress);
    setIsLoading(false);
  }, [deckId, storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDeck();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDeck]);

  async function renameDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = deckName.trim();

    if (!deck || !name) {
      return;
    }

    await storage.updateDeck(deck.id, { name });
    setIsEditing(false);
    await loadDeck();
  }

  async function deleteDeck() {
    if (!deck) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${deck.name}"?`);

    if (!shouldDelete) {
      return;
    }

    await storage.deleteDeck(deck.id);
    router.push("/");
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = newQuestion.trim();
    const answer = newAnswer.trim();

    if (!deck || !question || !answer) {
      return;
    }

    await storage.createCard({
      deckId: deck.id,
      question,
      answer,
    });
    setNewQuestion("");
    setNewAnswer("");
    setIsAddingCard(false);
    await loadDeck();
  }

  async function previewImportCards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = importText.trim();

    if (!deck || !text || isImportingCards) {
      return;
    }

    setImportError("");
    setImportPreviewCards([]);
    setIsImportingCards(true);

    try {
      const response = await fetch("/api/ai/parse-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as {
        cards?: Array<{
          question?: unknown;
          answer?: unknown;
          explanation?: unknown;
        }>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Import failed.");
      }

      const parsedCards = (payload.cards ?? [])
        .map((card) => ({
          id: crypto.randomUUID(),
          question: typeof card.question === "string" ? card.question.trim() : "",
          answer: typeof card.answer === "string" ? card.answer.trim() : "",
        }))
        .filter((card) => card.question && card.answer);

      if (parsedCards.length === 0) {
        throw new Error("No cards were found in this text.");
      }

      setImportPreviewCards(parsedCards);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Import failed.",
      );
    } finally {
      setIsImportingCards(false);
    }
  }

  function updateImportPreviewCard(
    id: string,
    field: "question" | "answer",
    value: string,
  ) {
    setImportPreviewCards((currentCards) =>
      currentCards.map((card) =>
        card.id === id
          ? {
              ...card,
              [field]: value,
            }
          : card,
      ),
    );
  }

  function removeImportPreviewCard(id: string) {
    setImportPreviewCards((currentCards) =>
      currentCards.filter((card) => card.id !== id),
    );
  }

  async function saveImportPreview() {
    if (!deck || isImportingCards) {
      return;
    }

    const cardsToSave = importPreviewCards
      .map((card) => ({
        deckId: deck.id,
        question: card.question.trim(),
        answer: card.answer.trim(),
        explanation: "",
      }))
      .filter((card) => card.question && card.answer);

    if (cardsToSave.length === 0) {
      setImportError("No valid cards to save.");
      return;
    }

    setImportError("");
    setIsImportingCards(true);

    try {
      await storage.createCards(cardsToSave);
      setImportText("");
      setImportPreviewCards([]);
      setIsImportingText(false);
      await loadDeck();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsImportingCards(false);
    }
  }

  function startEditingCard(card: Card) {
    setEditingCardId(card.id);
    setEditingQuestion(card.question);
    setEditingAnswer(card.answer);
  }

  async function updateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = editingQuestion.trim();
    const answer = editingAnswer.trim();

    if (!editingCardId || !question || !answer) {
      return;
    }

    await storage.updateCard(editingCardId, {
      question,
      answer,
    });
    setEditingCardId(null);
    setEditingQuestion("");
    setEditingAnswer("");
    await loadDeck();
  }

  async function deleteCard(card: Card) {
    const shouldDelete = window.confirm(`Delete "${card.question}"?`);

    if (!shouldDelete) {
      return;
    }

    await storage.deleteCard(card.id);
    await loadDeck();
  }

  if (isLoading) {
    return (
      <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-5 shadow-[var(--app-shadow-soft)]">
        <p className="text-sm font-medium text-[var(--app-text-muted)]">
          Loading deck
        </p>
      </section>
    );
  }

  if (!deck) {
    return (
      <section className="grid gap-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-5 shadow-[var(--app-shadow-soft)]">
        <p className="font-black">Deck not found</p>
        <Link
          className="flex h-12 items-center justify-center rounded-full bg-[var(--app-primary)] px-4 font-black text-[var(--app-primary-contrast)]"
          href="/"
        >
          Back to decks
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <Link
        className="flex w-fit items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm font-bold text-[var(--app-text-muted)] shadow-sm backdrop-blur dark:bg-white/10"
        href="/"
      >
        <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.3} />
        Decks
      </Link>

      <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-panel-gradient)] p-5 shadow-[var(--app-shadow)]">
        {isEditing ? (
          <form className="grid gap-3" onSubmit={renameDeck}>
            <input
              className="h-14 rounded-full border border-[var(--app-border)] bg-white/70 px-4 text-xl font-black outline-none focus:border-[var(--app-primary)] dark:bg-white/10"
              onChange={(event) => setDeckName(event.target.value)}
              value={deckName}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="h-12 rounded-full bg-[var(--app-primary)] px-4 font-black text-[var(--app-primary-contrast)]"
                type="submit"
              >
                Save
              </button>
              <button
                className="h-12 rounded-full border border-[var(--app-border)] bg-white/60 px-4 font-black dark:bg-white/10"
                onClick={() => setIsEditing(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--app-text-muted)]">
                  Deck
                </p>
                <h2 className="mt-2 truncate text-3xl font-black">
                  {deck.name}
                </h2>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  aria-label="Rename deck"
                  className="grid size-11 place-items-center rounded-full border border-[var(--app-border)] bg-white/70 text-[var(--app-text-muted)] shadow-sm dark:bg-white/10"
                  onClick={() => setIsEditing(true)}
                  title="Rename deck"
                  type="button"
                >
                  <Pencil aria-hidden="true" size={17} strokeWidth={2.2} />
                </button>
                <button
                  aria-label="Delete deck"
                  className="grid size-11 place-items-center rounded-full border border-[var(--app-border)] bg-white/70 text-[var(--app-danger)] shadow-sm dark:bg-white/10"
                  onClick={deleteDeck}
                  title="Delete deck"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm font-semibold text-[var(--app-text-muted)]">
              {progress?.learned ?? 0}/{progress?.total ?? 0} learned
            </p>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/65 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--app-primary)]"
                style={{
                  width:
                    progress && progress.total > 0
                      ? `${Math.round((progress.learned / progress.total) * 100)}%`
                      : "0%",
                }}
              />
            </div>

            <Link
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-5 text-base font-black text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)]"
              href={`/decks/${deck.id}/study`}
            >
              <Play aria-hidden="true" size={19} strokeWidth={2.4} />
              Start study
            </Link>
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          className="flex h-28 flex-col justify-between rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-4 text-left font-black shadow-[var(--app-shadow-soft)]"
          onClick={() => setIsAddingCard((currentValue) => !currentValue)}
          type="button"
        >
          <Plus
            aria-hidden="true"
            className="text-[var(--app-primary)]"
            size={22}
            strokeWidth={2.3}
          />
          <span>Add card</span>
        </button>
        <button
          className="flex h-28 flex-col justify-between rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-4 text-left font-black shadow-[var(--app-shadow-soft)]"
          onClick={() => setIsImportingText((currentValue) => !currentValue)}
          type="button"
        >
          <FileInput
            aria-hidden="true"
            className="text-[var(--app-success)]"
            size={22}
            strokeWidth={2.3}
          />
          <span>Import text</span>
        </button>
      </section>

      {isAddingCard ? (
        <form
          className="grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-4 shadow-[var(--app-shadow-soft)]"
          onSubmit={createCard}
        >
          <div>
            <label
              className="text-sm font-medium text-[var(--app-text-muted)]"
              htmlFor="new-card-question"
            >
              Question
            </label>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base font-semibold outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
              id="new-card-question"
              onChange={(event) => setNewQuestion(event.target.value)}
              placeholder="What is a DTO?"
              value={newQuestion}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-[var(--app-text-muted)]"
              htmlFor="new-card-answer"
            >
              Answer
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
              id="new-card-answer"
              onChange={(event) => setNewAnswer(event.target.value)}
              placeholder="DTO means Data Transfer Object."
              value={newAnswer}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-3 font-black text-[var(--app-primary-contrast)]"
              type="submit"
            >
              <Check aria-hidden="true" size={18} strokeWidth={2.3} />
              Save
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-white/60 px-3 font-black dark:bg-white/10"
              onClick={() => setIsAddingCard(false)}
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={2.3} />
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {isImportingText ? (
        <form
          className="grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-4 shadow-[var(--app-shadow-soft)]"
          onSubmit={previewImportCards}
        >
          <div>
            <label
              className="text-sm font-medium text-[var(--app-text-muted)]"
              htmlFor="import-text"
            >
              Text to import
            </label>
            <textarea
              className="mt-2 min-h-40 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
              id="import-text"
              onChange={(event) => {
                setImportText(event.target.value);
                setImportPreviewCards([]);
                setImportError("");
              }}
              placeholder="What is a DTO?&#10;DTO means Data Transfer Object.&#10;Why are DTOs used?&#10;They make request data explicit."
              value={importText}
            />
          </div>

          {importError ? (
            <p className="rounded-[var(--app-radius-sm)] border border-[var(--app-danger)] bg-[var(--app-danger-soft)] p-3 text-sm font-bold text-[var(--app-danger)]">
              {importError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-4 font-black text-[var(--app-primary-contrast)] disabled:opacity-50"
              disabled={isImportingCards || !importText.trim()}
              type="submit"
            >
              <FileInput aria-hidden="true" size={18} strokeWidth={2.3} />
              {isImportingCards ? "Parsing" : "Preview"}
            </button>
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-white/60 px-4 font-black dark:bg-white/10"
              onClick={() => {
                setIsImportingText(false);
                setImportPreviewCards([]);
                setImportError("");
              }}
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={2.3} />
              Cancel
            </button>
          </div>

          {importPreviewCards.length > 0 ? (
            <section className="grid gap-3 border-t border-[var(--app-border)] pt-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">Preview</h4>
                <span className="rounded-full bg-[var(--app-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-primary)]">
                  {importPreviewCards.length} cards
                </span>
              </div>

              <div className="grid gap-3">
                {importPreviewCards.map((card, index) => (
                  <article
                    className="grid gap-2 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-white/65 p-3 shadow-sm dark:bg-white/10"
                    key={card.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Card {index + 1}</p>
                      <button
                        aria-label={`Remove card ${index + 1}`}
                        className="grid size-9 place-items-center rounded-full border border-[var(--app-border)] bg-white/70 text-[var(--app-danger)] dark:bg-white/10"
                        onClick={() => removeImportPreviewCard(card.id)}
                        type="button"
                      >
                        <Trash2
                          aria-hidden="true"
                          size={16}
                          strokeWidth={2.2}
                        />
                      </button>
                    </div>
                    <textarea
                      aria-label={`Question for card ${index + 1}`}
                      className="min-h-20 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-sm font-bold outline-none transition focus:border-[var(--app-primary)]"
                      onChange={(event) =>
                        updateImportPreviewCard(
                          card.id,
                          "question",
                          event.target.value,
                        )
                      }
                      value={card.question}
                    />
                    <textarea
                      aria-label={`Answer for card ${index + 1}`}
                      className="min-h-24 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-sm outline-none transition focus:border-[var(--app-primary)]"
                      onChange={(event) =>
                        updateImportPreviewCard(
                          card.id,
                          "answer",
                          event.target.value,
                        )
                      }
                      value={card.answer}
                    />
                  </article>
                ))}
              </div>

              <button
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--app-success)] px-4 font-black text-white disabled:opacity-50"
                disabled={isImportingCards}
                onClick={saveImportPreview}
                type="button"
              >
                <Check aria-hidden="true" size={18} strokeWidth={2.3} />
                Save preview
              </button>
            </section>
          ) : null}
        </form>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Cards</h3>
          <span className="text-sm font-medium text-[var(--app-text-muted)]">
            {cards.length}
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-5 text-sm font-semibold text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)]">
            No cards yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {cards.map((card) => (
              <article
                className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-4 shadow-[var(--app-shadow-soft)]"
                key={card.id}
              >
                {editingCardId === card.id ? (
                  <form className="grid gap-3" onSubmit={updateCard}>
                    <textarea
                      className="min-h-20 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base font-bold outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
                      onChange={(event) =>
                        setEditingQuestion(event.target.value)
                      }
                      value={editingQuestion}
                    />
                    <textarea
                      className="min-h-24 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
                      onChange={(event) => setEditingAnswer(event.target.value)}
                      value={editingAnswer}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="h-11 rounded-full bg-[var(--app-primary)] px-4 text-sm font-black text-[var(--app-primary-contrast)]"
                        type="submit"
                      >
                        Save
                      </button>
                      <button
                        className="h-11 rounded-full border border-[var(--app-border)] bg-white/60 px-4 text-sm font-black dark:bg-white/10"
                        onClick={() => setEditingCardId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h4 className="line-clamp-2 text-lg font-black">
                      {card.question}
                    </h4>
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--app-text-muted)]">
                      {card.answer}
                    </p>
                    {card.explanation ? (
                      <p className="mt-3 w-fit rounded-full bg-[var(--app-success-soft)] px-3 py-1 text-xs font-black text-[var(--app-success)]">
                        Explanation saved
                      </p>
                    ) : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        aria-label="Edit card"
                        className="grid size-10 place-items-center rounded-full border border-[var(--app-border)] bg-white/60 text-[var(--app-text-muted)] dark:bg-white/10"
                        onClick={() => startEditingCard(card)}
                        title="Edit card"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={17} strokeWidth={2.2} />
                      </button>
                      <button
                        aria-label="Delete card"
                        className="grid size-10 place-items-center rounded-full border border-[var(--app-border)] bg-white/60 text-[var(--app-danger)] dark:bg-white/10"
                        onClick={() => deleteCard(card)}
                        title="Delete card"
                        type="button"
                      >
                        <Trash2
                          aria-hidden="true"
                          size={17}
                          strokeWidth={2.2}
                        />
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
