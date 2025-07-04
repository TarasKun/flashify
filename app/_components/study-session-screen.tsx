"use client";

import {
  ArrowLeft,
  Check,
  RotateCcw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  answerCard,
  getNextStudyDirection,
  selectActivePool,
  type Card,
  type StudyDirection,
} from "@/lib/domain";
import { createIndexedDbStorage } from "@/lib/storage";

type StudySessionScreenProps = {
  deckId: string;
};

type StudyCard = {
  card: Card;
  direction: StudyDirection;
};

type UndoEntry = {
  card: Card;
};

const SWIPE_THRESHOLD = 84;
const TAP_THRESHOLD = 8;

export function StudySessionScreen({ deckId }: StudySessionScreenProps) {
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  const [explanationError, setExplanationError] = useState("");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartXRef = useRef<number | null>(null);

  const loadStudyCards = useCallback(async () => {
    setIsLoading(true);
    const studyCards = await storage.listStudyCards({
      deckId,
      now: new Date(),
    });
    const activePool = selectActivePool(studyCards, new Date());

    setCards(
      activePool.map((card) => ({
        card,
        direction: getNextStudyDirection(card),
      })),
    );
    setIsAnswerVisible(false);
    setIsExplanationVisible(false);
    setExplanationError("");
    setIsLoading(false);
  }, [deckId, storage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStudyCards();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadStudyCards]);

  const currentStudyCard = cards[0] ?? null;
  const progressText = currentStudyCard
    ? `1/${cards.length}`
    : cards.length.toString();
  const currentExplanation = currentStudyCard?.card.explanation.trim() ?? "";

  const submitAnswer = useCallback(
    async (answer: "know" | "dontKnow") => {
      if (!currentStudyCard || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      const updatedCard = answerCard({
        card: currentStudyCard.card,
        direction: currentStudyCard.direction,
        answer,
        now: new Date(),
      });

      setUndoStack((currentStack) => [
        ...currentStack,
        {
          card: currentStudyCard.card,
        },
      ]);
      await storage.saveCardProgress(updatedCard);
      await loadStudyCards();
      setDragOffset(0);
      setIsSubmitting(false);
    },
    [currentStudyCard, isSubmitting, loadStudyCards, storage],
  );

  const undoLastAnswer = useCallback(async () => {
    const previousEntry = undoStack.at(-1);

    if (!previousEntry || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await storage.saveCardProgress(previousEntry.card);
    setUndoStack((currentStack) => currentStack.slice(0, -1));
    await loadStudyCards();
    setDragOffset(0);
    setIsSubmitting(false);
  }, [isSubmitting, loadStudyCards, storage, undoStack]);

  const showExplanation = useCallback(async () => {
    if (!currentStudyCard || isLoadingExplanation) {
      return;
    }

    setIsExplanationVisible(true);
    setExplanationError("");

    if (currentStudyCard.card.explanation.trim()) {
      return;
    }

    setIsLoadingExplanation(true);

    try {
      const response = await fetch("/api/ai/explain-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: currentStudyCard.card.question,
          answer: currentStudyCard.card.answer,
        }),
      });
      const payload = (await response.json()) as {
        explanation?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Explanation failed.");
      }

      const explanation =
        typeof payload.explanation === "string" ? payload.explanation.trim() : "";

      if (!explanation) {
        throw new Error("AI returned an empty explanation.");
      }

      const updatedCard = await storage.updateCard(currentStudyCard.card.id, {
        explanation,
      });

      setCards((currentCards) =>
        currentCards.map((studyCard) =>
          studyCard.card.id === updatedCard.id
            ? {
                ...studyCard,
                card: updatedCard,
              }
            : studyCard,
        ),
      );
    } catch (error) {
      setExplanationError(
        error instanceof Error ? error.message : "Explanation failed.",
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [currentStudyCard, isLoadingExplanation, storage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setIsAnswerVisible((currentValue) => !currentValue);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void submitAnswer("know");
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void submitAnswer("dontKnow");
        return;
      }

      if (
        event.key === "Backspace" ||
        (event.key.toLowerCase() === "z" && event.metaKey)
      ) {
        event.preventDefault();
        void undoLastAnswer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitAnswer, undoLastAnswer]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (dragStartXRef.current === null) {
      return;
    }

    setDragOffset(event.clientX - dragStartXRef.current);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragStartXRef.current === null) {
      return;
    }

    const offset = event.clientX - dragStartXRef.current;

    dragStartXRef.current = null;
    setDragOffset(0);

    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      void submitAnswer(offset > 0 ? "know" : "dontKnow");
      return;
    }

    if (Math.abs(offset) <= TAP_THRESHOLD) {
      setIsAnswerVisible((currentValue) => !currentValue);
    }
  }

  function handlePointerCancel() {
    dragStartXRef.current = null;
    setDragOffset(0);
  }

  function getPromptText(studyCard: StudyCard): string {
    return studyCard.direction === "forward"
      ? studyCard.card.question
      : studyCard.card.answer;
  }

  function getAnswerText(studyCard: StudyCard): string {
    return studyCard.direction === "forward"
      ? studyCard.card.answer
      : studyCard.card.question;
  }

  return (
    <section className="grid min-h-[calc(100dvh-9rem)] gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-muted)]"
          href={`/decks/${deckId}`}
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.3} />
          Deck
        </Link>
        <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--app-text-muted)]">
          {isLoading ? "..." : progressText}
        </span>
      </div>

      {isLoading ? (
        <div className="grid min-h-80 place-items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm font-medium text-[var(--app-text-muted)]">
          Loading study cards
        </div>
      ) : currentStudyCard ? (
        <>
          <button
            className="flex min-h-96 flex-col justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-left shadow-[var(--app-shadow)]"
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              transform: `translateX(${dragOffset}px) rotate(${dragOffset / 22}deg)`,
              transition: dragOffset === 0 ? "transform 160ms ease" : "none",
            }}
            type="button"
          >
            <span className="text-sm font-medium text-[var(--app-text-muted)]">
              {isAnswerVisible ? "Answer" : "Prompt"}
            </span>
            <span className="whitespace-pre-wrap text-3xl font-semibold leading-tight tracking-normal">
              {isAnswerVisible
                ? getAnswerText(currentStudyCard)
                : getPromptText(currentStudyCard)}
            </span>
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--app-text-muted)]">
              <RotateCcw aria-hidden="true" size={16} strokeWidth={2.2} />
              Tap to flip, swipe to answer
            </span>
          </button>

          <div className="grid grid-cols-[1fr_3.5rem_1fr] gap-3">
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-lg border border-[var(--app-danger)] bg-[var(--app-surface)] px-4 font-semibold text-[var(--app-danger)]"
              onClick={() => submitAnswer("dontKnow")}
              disabled={isSubmitting}
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={2.4} />
              Don&apos;t know
            </button>
            <button
              aria-label="Undo"
              className="grid size-14 place-items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] disabled:opacity-40"
              disabled={undoStack.length === 0 || isSubmitting}
              onClick={undoLastAnswer}
              title="Undo"
              type="button"
            >
              <Undo2 aria-hidden="true" size={20} strokeWidth={2.3} />
            </button>
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-[var(--app-success)] px-4 font-semibold text-white"
              onClick={() => submitAnswer("know")}
              disabled={isSubmitting}
              type="button"
            >
              <Check aria-hidden="true" size={20} strokeWidth={2.4} />
              Know
            </button>
          </div>

          <section className="grid gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-4 font-semibold disabled:opacity-50"
              disabled={isLoadingExplanation}
              onClick={showExplanation}
              type="button"
            >
              <Sparkles aria-hidden="true" size={18} strokeWidth={2.3} />
              {isLoadingExplanation ? "Loading" : "Tell me more"}
            </button>

            {isExplanationVisible ? (
              <div className="rounded-lg bg-[var(--app-surface-muted)] p-4">
                {explanationError ? (
                  <p className="text-sm font-medium text-[var(--app-danger)]">
                    {explanationError}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--app-text-muted)]">
                    {isLoadingExplanation
                      ? "Asking AI for a short explanation..."
                      : currentExplanation}
                  </p>
                )}
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <div className="grid gap-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-center">
          <p className="text-xl font-semibold">No cards due</p>
          <p className="text-sm text-[var(--app-text-muted)]">
            Add new cards or come back when reviews are ready.
          </p>
          <Link
            className="flex h-11 items-center justify-center rounded-lg bg-[var(--app-primary)] px-4 font-semibold text-[var(--app-primary-contrast)]"
            href={`/decks/${deckId}`}
          >
            Back to deck
          </Link>
        </div>
      )}
    </section>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}
