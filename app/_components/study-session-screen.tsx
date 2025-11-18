"use client";

import { Check, Plus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  answerCard,
  getNextStudyDirection,
  isEligibleForStudy,
  LEARNING_CONFIG,
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

type StudyAnswer = "know" | "dontKnow";

type OutgoingStudyCard = {
  answer: StudyAnswer;
  isAnswerVisible: boolean;
  startOffset: DragOffset;
  studyCard: StudyCard;
};

type DragOffset = {
  x: number;
  y: number;
};

const SWIPE_THRESHOLD = 84;
const TAP_THRESHOLD = 8;
const ANSWER_ANIMATION_MS = 760;
const DEPRIORITIZE_REST_HOURS = 24;
const EMPTY_DRAG_OFFSET: DragOffset = {
  x: 0,
  y: 0,
};

export function StudySessionScreen({ deckId }: StudySessionScreenProps) {
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState<DragOffset>(EMPTY_DRAG_OFFSET);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [outgoingStudyCard, setOutgoingStudyCard] =
    useState<OutgoingStudyCard | null>(null);
  const [visibleExplanationCardId, setVisibleExplanationCardId] = useState<
    string | null
  >(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState("");
  const dragStartRef = useRef<DragOffset | null>(null);
  const dragLastOffsetRef = useRef<DragOffset>(EMPTY_DRAG_OFFSET);
  const hasDraggedRef = useRef(false);
  const answerTimerRef = useRef<number | null>(null);

  const loadStudyCards = useCallback(async (preferredCardId?: string) => {
    setIsLoading(true);
    const now = new Date();
    const studyCards = await storage.listStudyCards({
      deckId,
      now,
    });
    const activePool = selectActivePool(studyCards, now);
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
    setVisibleExplanationCardId(null);
    setExplanationError("");
    setIsLoadingExplanation(false);
    setIsLoading(false);
  }, [deckId, storage]);

  const refillSessionQueue = useCallback(async () => {
    const now = new Date();
    const studyCards = await storage.listStudyCards({
      deckId,
      now,
    });
    const sortedCandidates = selectActivePool(studyCards, now, {
      ACTIVE_POOL_SIZE: studyCards.length,
    });

    setCards((currentCards) => {
      if (currentCards.length >= LEARNING_CONFIG.ACTIVE_POOL_SIZE) {
        return currentCards;
      }

      const currentCardIds = new Set(
        currentCards.map((studyCard) => studyCard.card.id),
      );
      const fillCards = sortedCandidates
        .filter((card) => !currentCardIds.has(card.id))
        .slice(0, LEARNING_CONFIG.ACTIVE_POOL_SIZE - currentCards.length)
        .map(toStudyCard);

      return [...currentCards, ...fillCards];
    });
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

  const submitAnswer = useCallback(
    async (studyCard: StudyCard, answer: StudyAnswer) => {
      try {
        const now = new Date();
        const updatedCard = answerCard({
          card: studyCard.card,
          direction: studyCard.direction,
          answer,
          now,
        });

        await storage.saveCardProgress(updatedCard);
        setCards((currentCards) =>
          insertAnsweredCardInSessionQueue(currentCards, updatedCard, now),
        );
        await refillSessionQueue();
        setDragOffset(EMPTY_DRAG_OFFSET);
      } finally {
        setIsSubmitting(false);
      }
    },
    [refillSessionQueue, storage],
  );

  const answerWithAnimation = useCallback(
    (answer: StudyAnswer, startOffset: DragOffset = EMPTY_DRAG_OFFSET) => {
      if (!currentStudyCard || isSubmitting || outgoingStudyCard) {
        return false;
      }

      const answeredStudyCard = currentStudyCard;

      setIsSubmitting(true);
      setOutgoingStudyCard({
        answer,
        isAnswerVisible,
        startOffset,
        studyCard: answeredStudyCard,
      });
      setCards((currentCards) =>
        currentCards[0]?.card.id === answeredStudyCard.card.id
          ? currentCards.slice(1)
          : currentCards,
      );
      setIsAnswerVisible(false);
      setVisibleExplanationCardId(null);
      setExplanationError("");
      setDragOffset(EMPTY_DRAG_OFFSET);

      answerTimerRef.current = window.setTimeout(() => {
        answerTimerRef.current = null;
        setOutgoingStudyCard(null);
      }, ANSWER_ANIMATION_MS);

      void submitAnswer(answeredStudyCard, answer);

      return true;
    },
    [
      currentStudyCard,
      isAnswerVisible,
      isSubmitting,
      outgoingStudyCard,
      submitAnswer,
    ],
  );

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
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [answerWithAnimation]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    dragLastOffsetRef.current = EMPTY_DRAG_OFFSET;
    hasDraggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) {
      return;
    }

    const nextOffset = {
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    };
    const hasMovedPastTapThreshold =
      Math.hypot(nextOffset.x, nextOffset.y) > TAP_THRESHOLD;

    dragLastOffsetRef.current = nextOffset;
    hasDraggedRef.current = hasDraggedRef.current || hasMovedPastTapThreshold;
    setDragOffset(nextOffset);

    if (hasMovedPastTapThreshold) {
      event.preventDefault();
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) {
      return;
    }

    const offset = {
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    };
    const wasTap = !hasDraggedRef.current && Math.hypot(offset.x, offset.y) <= TAP_THRESHOLD;

    if (Math.abs(offset.x) >= SWIPE_THRESHOLD) {
      const didAnswer = answerWithAnimation(
        offset.x > 0 ? "know" : "dontKnow",
        offset,
      );

      finishDragGesture(event, { resetOffset: !didAnswer });
      return;
    }

    finishDragGesture(event);

    if (wasTap) {
      setIsAnswerVisible((currentValue) => !currentValue);
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    const offset = dragLastOffsetRef.current;

    if (Math.abs(offset.x) >= SWIPE_THRESHOLD) {
      const didAnswer = answerWithAnimation(
        offset.x > 0 ? "know" : "dontKnow",
        offset,
      );

      finishDragGesture(event, { resetOffset: !didAnswer });
      return;
    }

    finishDragGesture(event);
  }

  function finishDragGesture(
    event: PointerEvent<HTMLDivElement>,
    { resetOffset = true }: { resetOffset?: boolean } = {},
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStartRef.current = null;
    dragLastOffsetRef.current = EMPTY_DRAG_OFFSET;
    hasDraggedRef.current = false;

    if (resetOffset) {
      setDragOffset(EMPTY_DRAG_OFFSET);
    }
  }

  function handleAnswerClick(
    event: MouseEvent<HTMLButtonElement>,
    answer: StudyAnswer,
  ) {
    event.preventDefault();
    event.stopPropagation();
    answerWithAnimation(answer);
  }

  async function deprioritizeCurrentCard() {
    if (!currentStudyCard || isSubmitting) {
      return;
    }

    const cardId = currentStudyCard.card.id;
    const now = new Date();
    const dueAt = new Date(
      now.getTime() + DEPRIORITIZE_REST_HOURS * 60 * 60 * 1000,
    ).toISOString();

    setIsSubmitting(true);
    setIsAnswerVisible(false);
    setVisibleExplanationCardId(null);
    setExplanationError("");
    setDragOffset(EMPTY_DRAG_OFFSET);
    setCards((currentCards) =>
      currentCards.filter((studyCard) => studyCard.card.id !== cardId),
    );

    try {
      await storage.updateCard(cardId, {
        status: "resting",
        dueAt,
      });
      await refillSessionQueue();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleCurrentCardExplanation() {
    if (!currentStudyCard || isSubmitting || isLoadingExplanation) {
      return;
    }

    if (visibleExplanationCardId === currentStudyCard.card.id) {
      setVisibleExplanationCardId(null);
      setExplanationError("");
      return;
    }

    setVisibleExplanationCardId(currentStudyCard.card.id);
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

      if (!response.ok || typeof payload.explanation !== "string") {
        throw new Error(payload.error ?? "Could not load explanation.");
      }

      const explanation = payload.explanation.trim();

      if (!explanation) {
        throw new Error("Could not load explanation.");
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
        error instanceof Error ? error.message : "Could not load explanation.",
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = newQuestion.trim();
    const answer = newAnswer.trim();

    if (!question || !answer) {
      return;
    }

    const card = await storage.createCard({
      deckId,
      question,
      answer,
    });

    setNewQuestion("");
    setNewAnswer("");
    setIsAddingCard(false);
    await loadStudyCards(card.id);
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

  const activeOffset = dragOffset.x;
  const tintIntensity =
    Math.min(Math.abs(activeOffset) / SWIPE_THRESHOLD, 1);
  const tintColor = activeOffset >= 0 ? "16 155 100" : "229 72 77";
  const currentCardStyle = getStudyCardStyle({
    dragOffset,
    tintColor,
    tintIntensity,
  });
  const nextStudyCard = currentStudyCard ? cards[1] ?? null : cards[0] ?? null;
  const currentExplanationText = currentStudyCard?.card.explanation.trim() ?? "";
  const isExplanationVisible =
    visibleExplanationCardId === currentStudyCard?.card.id;

  return (
    <section className="relative flex h-full min-h-0 max-w-full flex-col gap-4 overflow-visible sm:pb-0">
      {isLoading ? (
        <div className="grid min-h-0 flex-1 place-items-center rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-6 text-sm font-bold text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)]">
          Loading study cards
        </div>
      ) : currentStudyCard || outgoingStudyCard ? (
        <>
          <div className="flashcard-stage relative min-h-0 w-full max-w-full flex-1 pt-0">
            <div aria-hidden="true" className="flashcard-shadow-card flashcard-shadow-card-deep" />
            {nextStudyCard ? (
              <div
                aria-hidden="true"
                className="flashcard-perspective flashcard-next-card pointer-events-none absolute inset-x-0 bottom-3 top-1 z-[5] overflow-visible rounded-[2.25rem] border border-slate-200/75 bg-[image:var(--app-card-gradient)] text-center dark:border-white/15"
                key={`next-${nextStudyCard.card.id}-${nextStudyCard.direction}`}
              >
                <div className="flashcard-inner relative h-full min-h-0">
                  <FlashcardFace text={getPromptText(nextStudyCard)} />
                </div>
              </div>
            ) : (
              <div aria-hidden="true" className="flashcard-shadow-card flashcard-shadow-card-near" />
            )}
            {currentStudyCard ? (
              <div
                aria-label="Flashcard"
                className="flashcard-perspective absolute inset-x-0 bottom-3 top-1 z-10 touch-none select-none overflow-visible rounded-[2.25rem] border border-slate-200/80 bg-[image:var(--app-card-gradient)] text-center dark:border-white/15"
                onPointerCancel={handlePointerCancel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                key={`current-${currentStudyCard.card.id}-${currentStudyCard.direction}`}
                role="button"
                style={currentCardStyle}
                tabIndex={0}
              >
                <div
                  className="flashcard-inner relative h-full min-h-0"
                  data-flipped={isAnswerVisible}
                >
                  <FlashcardFace text={getPromptText(currentStudyCard)} />
                  <FlashcardFace isBack text={getAnswerText(currentStudyCard)} />
                </div>
                <StudyCardFeedbackControls
                  isDisabled={isSubmitting}
                  explanationError={explanationError}
                  explanationText={currentExplanationText}
                  isExplanationVisible={isExplanationVisible}
                  isLoadingExplanation={isLoadingExplanation}
                  onToggleExplanation={toggleCurrentCardExplanation}
                  onThumbsDown={deprioritizeCurrentCard}
                />
              </div>
            ) : null}

            {outgoingStudyCard ? (
              <div
                aria-hidden="true"
                className="flashcard-perspective pointer-events-none absolute inset-x-0 bottom-3 top-1 z-20 overflow-visible rounded-[2.25rem] border border-slate-200/80 bg-[image:var(--app-card-gradient)] text-center dark:border-white/15"
                key={`outgoing-${outgoingStudyCard.studyCard.card.id}-${outgoingStudyCard.studyCard.direction}`}
                style={getOutgoingCardStyle(outgoingStudyCard)}
              >
                <div
                  className="flashcard-inner relative h-full min-h-0"
                  data-flipped={outgoingStudyCard.isAnswerVisible}
                >
                  <FlashcardFace
                    text={getPromptText(outgoingStudyCard.studyCard)}
                  />
                  <FlashcardFace
                    isBack
                    text={getAnswerText(outgoingStudyCard.studyCard)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden shrink-0 grid-cols-2 gap-3 sm:grid">
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-full border border-[var(--app-danger)] bg-[var(--app-danger-soft)] px-4 font-black text-[var(--app-danger)] shadow-[var(--app-shadow-soft)] disabled:opacity-50"
              onClick={(event) => handleAnswerClick(event, "dontKnow")}
              disabled={isSubmitting || !currentStudyCard}
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={2.4} />
              Don&apos;t know
            </button>
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--app-success)] px-4 font-black text-white shadow-[var(--app-shadow-soft)] disabled:opacity-50"
              onClick={(event) => handleAnswerClick(event, "know")}
              disabled={isSubmitting || !currentStudyCard}
              type="button"
            >
              <Check aria-hidden="true" size={20} strokeWidth={2.4} />
              Know
            </button>
          </div>
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

      {isAddingCard ? (
        <form
          className="fixed inset-x-7 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)]"
          onSubmit={createCard}
        >
          <textarea
            aria-label="New card question"
            className="min-h-20 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base font-bold outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
            onChange={(event) => setNewQuestion(event.target.value)}
            placeholder="Question"
            value={newQuestion}
          />
          <textarea
            aria-label="New card answer"
            className="min-h-24 w-full resize-none rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-white/70 p-3 text-base outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
            onChange={(event) => setNewAnswer(event.target.value)}
            placeholder="Answer"
            value={newAnswer}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-3 font-black text-[var(--app-primary-contrast)] disabled:opacity-50"
              disabled={!newQuestion.trim() || !newAnswer.trim()}
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

      <button
        aria-label="Add card"
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-7 z-[2147483647] grid size-12 place-items-center rounded-full border border-white/80 bg-white/90 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10"
        onClick={() => setIsAddingCard((currentValue) => !currentValue)}
        type="button"
      >
        <Plus aria-hidden="true" size={22} strokeWidth={2.5} />
      </button>
    </section>
  );
}

function FlashcardFace({
  isBack = false,
  text,
}: {
  isBack?: boolean;
  text: string;
}) {
  return (
    <div
      className={`flashcard-face flex h-full min-h-0 flex-col items-center justify-center rounded-[2.25rem] p-6 text-center ${
        isBack ? "flashcard-face-back" : ""
      }`}
    >
      <span className="w-full whitespace-pre-wrap break-words text-center text-[1.7rem] font-semibold leading-[1.14] tracking-normal text-[var(--app-text)]">
        {text}
      </span>
    </div>
  );
}

function StudyCardFeedbackControls({
  explanationError,
  explanationText,
  isDisabled,
  isExplanationVisible,
  isLoadingExplanation,
  onToggleExplanation,
  onThumbsDown,
}: {
  explanationError: string;
  explanationText: string;
  isDisabled: boolean;
  isExplanationVisible: boolean;
  isLoadingExplanation: boolean;
  onToggleExplanation: () => void;
  onThumbsDown: () => void;
}) {
  const visibleText = explanationText || explanationError;
  const explanationLabel = isExplanationVisible ? "Hide explanation" : "Explain more";

  return (
    <div
      className="pointer-events-auto absolute inset-x-5 bottom-6 z-20 grid gap-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {isExplanationVisible ? (
        <div className="max-h-32 overscroll-contain rounded-[var(--app-radius-sm)] border border-slate-200/80 bg-white/85 p-3 text-left text-xs font-semibold leading-5 text-[var(--app-text-muted)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
          {isLoadingExplanation && !visibleText
            ? "Loading explanation..."
            : visibleText}
        </div>
      ) : null}
      <button
        className="mx-auto flex h-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/55 px-4 text-xs font-semibold text-slate-500/90 transition hover:bg-white/80 disabled:opacity-45 dark:border-white/10 dark:bg-white/10 dark:text-slate-300/70"
        disabled={isDisabled || isLoadingExplanation}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleExplanation();
        }}
        type="button"
      >
        {isLoadingExplanation ? "Loading..." : explanationLabel}
      </button>
      <div className="flex items-center justify-center gap-6">
        <button
          aria-label="Lower card priority"
          className="grid size-11 place-items-center rounded-full text-slate-400/75 transition hover:text-slate-500 disabled:opacity-35 dark:text-slate-300/55"
          disabled={isDisabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onThumbsDown();
          }}
          type="button"
        >
          <ThumbsDown aria-hidden="true" size={22} strokeWidth={2.2} />
        </button>
        <button
          aria-label="Thumbs up"
          className="grid size-11 place-items-center rounded-full text-slate-400/60 dark:text-slate-300/45"
          disabled
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          type="button"
        >
          <ThumbsUp aria-hidden="true" size={22} strokeWidth={2.2} />
        </button>
      </div>
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

function toStudyCard(card: Card): StudyCard {
  return {
    card,
    direction: getNextStudyDirection(card),
  };
}

function insertAnsweredCardInSessionQueue(
  currentCards: StudyCard[],
  updatedCard: Card,
  now: Date,
): StudyCard[] {
  const cardsWithoutAnsweredCard = currentCards.filter(
    (studyCard) => studyCard.card.id !== updatedCard.id,
  );

  if (!isEligibleForStudy(updatedCard, now)) {
    return cardsWithoutAnsweredCard;
  }

  return [...cardsWithoutAnsweredCard, toStudyCard(updatedCard)];
}

function getStudyCardStyle({
  dragOffset,
  tintColor,
  tintIntensity,
}: {
  dragOffset: DragOffset;
  tintColor: string;
  tintIntensity: number;
}) {
  return {
    backgroundImage: `linear-gradient(rgba(${tintColor} / ${tintIntensity * 0.34}), rgba(${tintColor} / ${tintIntensity * 0.2})), var(--app-card-gradient)`,
    borderColor:
      dragOffset.x === 0
        ? undefined
        : `rgba(${tintColor} / ${0.28 + tintIntensity * 0.42})`,
    transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x / 22}deg)`,
    transition:
      dragOffset.x === 0 && dragOffset.y === 0
        ? "transform 160ms ease, background-color 160ms ease, border-color 160ms ease"
        : "none",
  };
}

function getOutgoingCardStyle(outgoingStudyCard: OutgoingStudyCard) {
  const direction = outgoingStudyCard.answer === "know" ? 1 : -1;
  const tintColor =
    outgoingStudyCard.answer === "know" ? "16 155 100" : "229 72 77";
  const animationName =
    outgoingStudyCard.answer === "know"
      ? "flashcard-exit-right"
      : "flashcard-exit-left";

  return {
    animation: `${animationName} ${ANSWER_ANIMATION_MS}ms cubic-bezier(0.19, 1, 0.22, 1) forwards`,
    backgroundImage: `linear-gradient(rgba(${tintColor} / 0.36), rgba(${tintColor} / 0.22)), var(--app-card-gradient)`,
    borderColor: `rgba(${tintColor} / 0.72)`,
    "--flashcard-exit-x": `${direction * 118}vw`,
    "--flashcard-exit-y": `${outgoingStudyCard.startOffset.y - 160}px`,
    "--flashcard-exit-rotate": `${direction * 26}deg`,
    "--flashcard-start-rotate": `${outgoingStudyCard.startOffset.x / 22}deg`,
    "--flashcard-start-x": `${outgoingStudyCard.startOffset.x}px`,
    "--flashcard-start-y": `${outgoingStudyCard.startOffset.y}px`,
  };
}
