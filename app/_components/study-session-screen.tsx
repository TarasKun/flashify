"use client";

import { Check, Plus, X } from "lucide-react";
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
        return;
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
      setDragOffset(EMPTY_DRAG_OFFSET);

      answerTimerRef.current = window.setTimeout(() => {
        answerTimerRef.current = null;
        setOutgoingStudyCard(null);
      }, ANSWER_ANIMATION_MS);

      void submitAnswer(answeredStudyCard, answer);
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
      finishDragGesture(event, { resetOffset: false });
      answerWithAnimation(offset.x > 0 ? "know" : "dontKnow", offset);
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
      finishDragGesture(event, { resetOffset: false });
      answerWithAnimation(offset.x > 0 ? "know" : "dontKnow", offset);
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

  return (
    <section className="relative flex h-full min-h-0 max-w-full flex-col gap-4 overflow-visible pb-16 sm:pb-0">
      {isLoading ? (
        <div className="grid min-h-0 flex-1 place-items-center rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-6 text-sm font-bold text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)]">
          Loading study cards
        </div>
      ) : currentStudyCard || outgoingStudyCard ? (
        <>
          <div className="flashcard-stage relative min-h-0 w-full max-w-full flex-1 pt-5">
            <div aria-hidden="true" className="flashcard-shadow-card flashcard-shadow-card-deep" />
            <div aria-hidden="true" className="flashcard-shadow-card flashcard-shadow-card-near" />
            {currentStudyCard ? (
              <div
                aria-label="Flashcard"
                className="flashcard-perspective absolute inset-x-0 bottom-1 top-5 z-10 touch-none select-none overflow-visible rounded-[2.25rem] border border-slate-200/80 bg-[image:var(--app-card-gradient)] text-center dark:border-white/15"
                onPointerCancel={handlePointerCancel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
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
              </div>
            ) : null}

            {outgoingStudyCard ? (
              <div
                aria-hidden="true"
                className="flashcard-perspective pointer-events-none absolute inset-x-0 bottom-1 top-5 z-20 overflow-visible rounded-[2.25rem] border border-slate-200/80 bg-[image:var(--app-card-gradient)] text-center dark:border-white/15"
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
          className="absolute inset-x-0 bottom-16 z-20 grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)] sm:bottom-20"
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
        className="absolute bottom-0 right-0 z-10 grid size-12 place-items-center rounded-full border border-white/80 bg-white/90 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10 sm:bottom-20 sm:bg-[var(--app-primary)] sm:text-[var(--app-primary-contrast)]"
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
