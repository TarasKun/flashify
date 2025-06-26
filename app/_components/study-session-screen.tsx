"use client";

import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export function StudySessionScreen({ deckId }: StudySessionScreenProps) {
  const storage = useMemo(() => createIndexedDbStorage(), []);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);

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

  async function submitAnswer(answer: "know" | "dontKnow") {
    if (!currentStudyCard) {
      return;
    }

    const updatedCard = answerCard({
      card: currentStudyCard.card,
      direction: currentStudyCard.direction,
      answer,
      now: new Date(),
    });

    await storage.saveCardProgress(updatedCard);
    await loadStudyCards();
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
            onClick={() =>
              setIsAnswerVisible((currentValue) => !currentValue)
            }
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
              Tap to flip
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-lg border border-[var(--app-danger)] bg-[var(--app-surface)] px-4 font-semibold text-[var(--app-danger)]"
              onClick={() => submitAnswer("dontKnow")}
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={2.4} />
              Don&apos;t know
            </button>
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-[var(--app-success)] px-4 font-semibold text-white"
              onClick={() => submitAnswer("know")}
              type="button"
            >
              <Check aria-hidden="true" size={20} strokeWidth={2.4} />
              Know
            </button>
          </div>
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
