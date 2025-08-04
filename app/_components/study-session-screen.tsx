"use client";

import {
  ArrowLeft,
  Check,
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
  type MouseEvent,
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

type StudyAnswer = "know" | "dontKnow";

const SWIPE_THRESHOLD = 84;
const TAP_THRESHOLD = 8;
const ANSWER_ANIMATION_MS = 640;

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
  const [answerAnimation, setAnswerAnimation] = useState<StudyAnswer | null>(
    null,
  );
  const dragStartXRef = useRef<number | null>(null);
  const dragLastOffsetRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const answerTimerRef = useRef<number | null>(null);

  const loadStudyCards = useCallback(async (preferredCardId?: string) => {
    setIsLoading(true);
    const studyCards = await storage.listStudyCards({
      deckId,
      now: new Date(),
    });
    const activePool = selectActivePool(studyCards, new Date());
    const orderedPool = preferredCardId
      ? moveCardToFront(activePool, preferredCardId)
      : activePool;

    setCards(
      orderedPool.map((card) => ({
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

  useEffect(() => {
    return () => {
      if (answerTimerRef.current !== null) {
        window.clearTimeout(answerTimerRef.current);
      }
    };
  }, []);

  const currentStudyCard = cards[0] ?? null;
  const currentExplanation = currentStudyCard?.card.explanation.trim() ?? "";

  const submitAnswer = useCallback(
    async (answer: StudyAnswer) => {
      if (!currentStudyCard) {
        return;
      }

      try {
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
      } finally {
        setAnswerAnimation(null);
        setIsSubmitting(false);
      }
    },
    [currentStudyCard, loadStudyCards, storage],
  );

  const answerWithAnimation = useCallback(
    (answer: StudyAnswer) => {
      if (!currentStudyCard || isSubmitting || answerAnimation) {
        return;
      }

      setIsSubmitting(true);
      setAnswerAnimation(answer);

      answerTimerRef.current = window.setTimeout(() => {
        answerTimerRef.current = null;
        void submitAnswer(answer);
      }, ANSWER_ANIMATION_MS);
    },
    [answerAnimation, currentStudyCard, isSubmitting, submitAnswer],
  );

  const undoLastAnswer = useCallback(async () => {
    const previousEntry = undoStack.at(-1);

    if (!previousEntry || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await storage.saveCardProgress(previousEntry.card);
      setUndoStack((currentStack) => currentStack.slice(0, -1));
      await loadStudyCards(previousEntry.card.id);
      setDragOffset(0);
    } finally {
      setIsSubmitting(false);
    }
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
      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setIsAnswerVisible((currentValue) => !currentValue);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        answerWithAnimation("know");
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        answerWithAnimation("dontKnow");
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
  }, [answerWithAnimation, undoLastAnswer]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    dragStartXRef.current = event.clientX;
    dragLastOffsetRef.current = 0;
    hasDraggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartXRef.current === null) {
      return;
    }

    const nextOffset = event.clientX - dragStartXRef.current;

    dragLastOffsetRef.current = nextOffset;
    hasDraggedRef.current =
      hasDraggedRef.current || Math.abs(nextOffset) > TAP_THRESHOLD;
    setDragOffset(nextOffset);

    if (Math.abs(nextOffset) > TAP_THRESHOLD) {
      event.preventDefault();
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStartXRef.current === null) {
      return;
    }

    const offset = event.clientX - dragStartXRef.current;
    const wasTap = !hasDraggedRef.current && Math.abs(offset) <= TAP_THRESHOLD;

    resetDragState(event);

    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      answerWithAnimation(offset > 0 ? "know" : "dontKnow");
      return;
    }

    if (wasTap) {
      setIsAnswerVisible((currentValue) => !currentValue);
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    const offset = dragLastOffsetRef.current;

    resetDragState(event);

    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      answerWithAnimation(offset > 0 ? "know" : "dontKnow");
    }
  }

  function resetDragState(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStartXRef.current = null;
    dragLastOffsetRef.current = 0;
    hasDraggedRef.current = false;
    setDragOffset(0);
  }

  function handleAnswerClick(
    event: MouseEvent<HTMLButtonElement>,
    answer: StudyAnswer,
  ) {
    event.preventDefault();
    event.stopPropagation();
    answerWithAnimation(answer);
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

  const animationDirection =
    answerAnimation === "know" ? 1 : answerAnimation === "dontKnow" ? -1 : 0;
  const activeOffset =
    animationDirection !== 0 ? animationDirection * SWIPE_THRESHOLD : dragOffset;
  const tintIntensity =
    animationDirection !== 0
      ? 1
      : Math.min(Math.abs(activeOffset) / SWIPE_THRESHOLD, 1);
  const tintColor =
    activeOffset >= 0 ? "16 155 100" : "229 72 77";
  const cardTransform =
    animationDirection !== 0
      ? `translate3d(${animationDirection * 115}vw, -9rem, 0) rotate(${animationDirection * 24}deg) scale(0.96)`
      : `translateX(${dragOffset}px) rotate(${dragOffset / 22}deg)`;

  return (
    <section className="grid min-h-[calc(100dvh-9rem)] gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm font-bold text-[var(--app-text-muted)] shadow-sm backdrop-blur dark:bg-white/10"
          href={`/decks/${deckId}`}
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.3} />
          Deck
        </Link>
      </div>

      {isLoading ? (
        <div className="grid min-h-80 place-items-center rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-6 text-sm font-bold text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)]">
          Loading study cards
        </div>
      ) : currentStudyCard ? (
        <>
          <div
            aria-label="Flashcard"
            className="flashcard-perspective min-h-[27rem] touch-none select-none rounded-[2.25rem] border border-white/75 bg-[image:var(--app-card-gradient)] text-left shadow-[var(--app-shadow)] dark:border-white/10"
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            role="button"
            style={{
              backgroundImage: `linear-gradient(rgba(${tintColor} / ${tintIntensity * 0.34}), rgba(${tintColor} / ${tintIntensity * 0.2})), var(--app-card-gradient)`,
              borderColor:
                activeOffset === 0
                  ? undefined
                  : `rgba(${tintColor} / ${0.28 + tintIntensity * 0.42})`,
              opacity: animationDirection !== 0 ? 0 : 1,
              transform: cardTransform,
              transition:
                animationDirection !== 0
                  ? `transform ${ANSWER_ANIMATION_MS}ms cubic-bezier(0.19, 1, 0.22, 1), opacity ${ANSWER_ANIMATION_MS}ms ease`
                  : dragOffset === 0
                    ? "transform 160ms ease, background-color 160ms ease, border-color 160ms ease"
                    : "none",
            }}
            tabIndex={0}
          >
            <div
              className="flashcard-inner relative min-h-[27rem]"
              data-flipped={isAnswerVisible}
            >
              <FlashcardFace
                directionLabel={
                  currentStudyCard.direction === "forward"
                    ? "Question -> answer"
                    : "Answer -> question"
                }
                label="Prompt"
                text={getPromptText(currentStudyCard)}
              />
              <FlashcardFace
                directionLabel={
                  currentStudyCard.direction === "forward"
                    ? "Question -> answer"
                    : "Answer -> question"
                }
                isBack
                label="Answer"
                text={getAnswerText(currentStudyCard)}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_3.5rem_1fr] gap-3">
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-full border border-[var(--app-danger)] bg-[var(--app-danger-soft)] px-4 font-black text-[var(--app-danger)] shadow-[var(--app-shadow-soft)] disabled:opacity-50"
              onClick={(event) => handleAnswerClick(event, "dontKnow")}
              disabled={isSubmitting}
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={2.4} />
              Don&apos;t know
            </button>
            <button
              aria-label="Undo"
              className="grid size-14 place-items-center rounded-full border border-[var(--app-border)] bg-white/70 text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)] backdrop-blur disabled:opacity-40 dark:bg-white/10"
              disabled={undoStack.length === 0 || isSubmitting}
              onClick={undoLastAnswer}
              title="Undo"
              type="button"
            >
              <Undo2 aria-hidden="true" size={20} strokeWidth={2.3} />
            </button>
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--app-success)] px-4 font-black text-white shadow-[var(--app-shadow-soft)] disabled:opacity-50"
              onClick={(event) => handleAnswerClick(event, "know")}
              disabled={isSubmitting}
              type="button"
            >
              <Check aria-hidden="true" size={20} strokeWidth={2.4} />
              Know
            </button>
          </div>

          <section className="grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-4 shadow-[var(--app-shadow-soft)]">
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-white/65 px-4 font-black disabled:opacity-50 dark:bg-white/10"
              disabled={isLoadingExplanation}
              onClick={showExplanation}
              type="button"
            >
              <Sparkles aria-hidden="true" size={18} strokeWidth={2.3} />
              {isLoadingExplanation ? "Loading" : "Tell me more"}
            </button>

            {isExplanationVisible ? (
              <div className="rounded-[var(--app-radius-md)] bg-white/60 p-4 dark:bg-white/10">
                {explanationError ? (
                  <p className="text-sm font-medium text-[var(--app-danger)]">
                    {explanationError}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--app-text-muted)]">
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
        <div className="grid gap-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-panel-gradient)] p-6 text-center shadow-[var(--app-shadow)]">
          <p className="text-2xl font-black">No cards due</p>
          <p className="text-sm font-semibold leading-6 text-[var(--app-text-muted)]">
            Add new cards or come back when reviews are ready.
          </p>
          <Link
            className="flex h-12 items-center justify-center rounded-full bg-[var(--app-primary)] px-4 font-black text-[var(--app-primary-contrast)]"
            href={`/decks/${deckId}`}
          >
            Back to deck
          </Link>
        </div>
      )}
    </section>
  );
}

function FlashcardFace({
  directionLabel,
  isBack = false,
  label,
  text,
}: {
  directionLabel: string;
  isBack?: boolean;
  label: string;
  text: string;
}) {
  return (
    <div
      className={`flashcard-face flex min-h-[27rem] flex-col justify-between rounded-[2.25rem] p-6 ${
        isBack ? "flashcard-face-back" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-3 text-sm font-black text-[var(--app-text-muted)]">
        <span>{label}</span>
        <span className="rounded-full bg-[var(--app-primary-soft)] px-3 py-1 text-xs text-[var(--app-primary)]">
          {directionLabel}
        </span>
      </span>
      <span className="whitespace-pre-wrap break-words text-[2.35rem] font-black leading-[1.08] tracking-normal">
        {text}
      </span>
      <span aria-hidden="true" className="h-7" />
    </div>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button" ||
    tagName === "a" ||
    target.isContentEditable
  );
}

function moveCardToFront(cards: Card[], cardId: string): Card[] {
  const cardIndex = cards.findIndex((card) => card.id === cardId);

  if (cardIndex <= 0) {
    return cards;
  }

  const nextCards = [...cards];
  const [card] = nextCards.splice(cardIndex, 1);

  return [card, ...nextCards];
}
