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

const SWIPE_THRESHOLD = 84;
const TAP_THRESHOLD = 8;
const ANSWER_ANIMATION_MS = 1300;

export function StudySessionScreen({ deckId }: StudySessionScreenProps) {
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
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
    <section className="relative flex h-full min-h-0 max-w-full flex-col gap-4 overflow-hidden">
      {isLoading ? (
        <div className="grid min-h-0 flex-1 place-items-center rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[image:var(--app-card-gradient)] p-6 text-sm font-bold text-[var(--app-text-muted)] shadow-[var(--app-shadow-soft)]">
          Loading study cards
        </div>
      ) : currentStudyCard ? (
        <>
          <div
            aria-label="Flashcard"
            className="flashcard-perspective min-h-0 w-full max-w-full flex-1 touch-none select-none overflow-hidden rounded-[2.25rem] border border-white/75 bg-[image:var(--app-card-gradient)] text-center shadow-[var(--app-shadow)] dark:border-white/10"
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
              className="flashcard-inner relative h-full min-h-0"
              data-flipped={isAnswerVisible}
            >
              <FlashcardFace
                text={getPromptText(currentStudyCard)}
              />
              <FlashcardFace
                isBack
                text={getAnswerText(currentStudyCard)}
              />
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3">
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
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--app-success)] px-4 font-black text-white shadow-[var(--app-shadow-soft)] disabled:opacity-50"
              onClick={(event) => handleAnswerClick(event, "know")}
              disabled={isSubmitting}
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
          className="absolute inset-x-0 bottom-20 z-20 grid gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow)]"
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
        className="absolute bottom-20 right-0 z-10 grid size-12 place-items-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)]"
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
      <span className="w-full whitespace-pre-wrap break-words text-center text-[2.35rem] font-black leading-[1.08] tracking-normal">
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
