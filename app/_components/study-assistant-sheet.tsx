"use client";

import { ChevronDown, ChevronUp, RefreshCw, Send } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import { CONTENT_LIMITS, type ChatMessage } from "@/lib/domain";

type StudyAssistantSheetProps = {
  error: string;
  hasRetry: boolean;
  isOpen: boolean;
  isSending: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onOpen: () => void;
  onRetry: () => void;
  onSend: (message: string) => void;
};

const DRAG_THRESHOLD = 52;

export function StudyAssistantSheet({
  error,
  hasRetry,
  isOpen,
  isSending,
  messages,
  onClose,
  onOpen,
  onRetry,
  onSend,
}: StudyAssistantSheetProps) {
  const [draft, setDraft] = useState("");
  const [isSheetMounted, setIsSheetMounted] = useState(false);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isPullingOpen, setIsPullingOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const ignoreHandleClickRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (isOpen) {
      let visibleAnimationFrame: number | null = null;
      const mountAnimationFrame = window.requestAnimationFrame(() => {
        setIsSheetMounted(true);
        visibleAnimationFrame = window.requestAnimationFrame(() => {
          setIsSheetVisible(true);
        });
      });

      return () => {
        window.cancelAnimationFrame(mountAnimationFrame);

        if (visibleAnimationFrame !== null) {
          window.cancelAnimationFrame(visibleAnimationFrame);
        }
      };
    }

    if (isSheetMounted && !isPullingOpen) {
      const closeAnimationFrame = window.requestAnimationFrame(() => {
        setIsSheetVisible(false);
      });
      closeTimerRef.current = window.setTimeout(() => {
        setIsSheetMounted(false);
        closeTimerRef.current = null;
      }, 300);

      return () => window.cancelAnimationFrame(closeAnimationFrame);
    }
  }, [isOpen, isPullingOpen, isSheetMounted]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStartYRef.current = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (dragStartYRef.current === null) {
      return;
    }

    const deltaY = event.clientY - dragStartYRef.current;

    if (isOpen && deltaY > 0) {
      setDragOffset(Math.min(deltaY, 280));
      return;
    }

    if (!isOpen && deltaY < 0) {
      setIsSheetMounted(true);
      setIsPullingOpen(true);
      setDragOffset(Math.min(-deltaY, 220));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragStartYRef.current === null) {
      return;
    }

    const deltaY = event.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    setIsDragging(false);

    if (isOpen && deltaY >= DRAG_THRESHOLD) {
      ignoreHandleClickRef.current = true;
      onClose();
    } else if (!isOpen && deltaY <= -DRAG_THRESHOLD) {
      ignoreHandleClickRef.current = true;
      setIsSheetMounted(true);
      setIsSheetVisible(true);
      setIsPullingOpen(false);
      setDragOffset(0);
      onOpen();
    } else {
      setIsPullingOpen(false);
      setDragOffset(0);
    }
  }

  function handlePointerCancel() {
    dragStartYRef.current = null;
    setIsDragging(false);
    setIsPullingOpen(false);
    setDragOffset(0);
  }

  function handleHandleClick() {
    if (ignoreHandleClickRef.current) {
      ignoreHandleClickRef.current = false;
      return;
    }

    if (isOpen) {
      onClose();
    } else {
      setIsSheetMounted(true);
      setIsSheetVisible(false);
      onOpen();
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();

    if (!message || isSending) {
      return;
    }

    onSend(message);
    setDraft("");
  }

  const shouldRenderSheet = isSheetMounted || isPullingOpen;
  const sheetTransform = isPullingOpen
    ? `translateY(calc(100% - ${dragOffset}px))`
    : isSheetVisible
      ? `translateY(${dragOffset}px)`
      : "translateY(100%)";

  return (
    <>
      {!isOpen && (!isSheetVisible || isPullingOpen) ? (
      <button
        aria-label="Open assistant"
        className={`fixed bottom-[calc(1.15rem+env(safe-area-inset-bottom))] left-1/2 z-30 grid h-16 w-36 -translate-x-1/2 place-items-center touch-none transition-opacity ${
          isPullingOpen ? "opacity-0" : ""
        }`}
        onClick={handleHandleClick}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        type="button"
      >
        <span className="grid size-11 place-items-center rounded-full border border-slate-300/70 bg-white/65 text-slate-400/80 backdrop-blur transition hover:bg-white/90 hover:text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300/60">
          <ChevronUp aria-hidden="true" size={22} strokeWidth={2.1} />
        </span>
      </button>
      ) : null}
      {shouldRenderSheet ? (
        <>
          <button
        aria-label="Close assistant"
        className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
          <section
        aria-label="Card assistant"
        className="fixed inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),0.75rem)] z-50 flex min-h-0 flex-col rounded-t-[var(--app-radius-lg)] border-x border-t border-[var(--app-border)] bg-[var(--app-surface)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0 shadow-[var(--app-shadow)]"
        data-assistant-open
        style={{
          transform: sheetTransform,
          transition: isDragging
            ? "none"
            : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
          >
        <button
          aria-label="Close assistant"
          className="-mx-5 flex h-16 w-[calc(100%+2.5rem)] touch-none flex-col items-center justify-center gap-1 text-slate-400/80 transition hover:bg-slate-100/70 hover:text-slate-500 dark:text-slate-300/60 dark:hover:bg-white/10"
          onClick={handleHandleClick}
          onPointerCancel={handlePointerCancel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          type="button"
        >
          <span aria-hidden="true" className="h-1 w-12 rounded-full bg-current opacity-35" />
          <ChevronDown aria-hidden="true" size={24} strokeWidth={2.1} />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-2">
          {messages.length ? (
            <ol className="grid gap-3" role="log">
              {messages.map((message) => (
                <li
                  className={`max-w-[88%] rounded-[var(--app-radius-md)] px-3 py-2 text-sm leading-5 ${
                    message.role === "user"
                      ? "ml-auto bg-[var(--app-primary)] text-[var(--app-primary-contrast)]"
                      : "border border-[var(--app-border)] bg-white/65 text-[var(--app-text)] dark:bg-white/10"
                  }`}
                  key={message.id}
                >
                  {message.content}
                </li>
              ))}
            </ol>
          ) : (
            <p className="pt-8 text-center text-sm font-semibold leading-6 text-[var(--app-text-muted)]">
              Ask about this card in any language.
            </p>
          )}
        </div>
        {error ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--app-radius-sm)] border border-[var(--app-danger)]/35 bg-[var(--app-danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-danger)]">
            <span>{error}</span>
            {hasRetry ? (
              <button
                aria-label="Retry assistant reply"
                className="grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-white/55"
                disabled={isSending}
                onClick={onRetry}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={17} strokeWidth={2.2} />
              </button>
            ) : null}
          </div>
        ) : null}
        <form className="flex items-end gap-2" onSubmit={submitMessage}>
          <textarea
            aria-label="Message the assistant"
            className="min-h-12 max-h-32 flex-1 resize-none rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-white/65 px-3 py-3 text-sm leading-5 text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)] dark:bg-white/10"
            maxLength={CONTENT_LIMITS.chatMessage}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about this card"
            value={draft}
          />
          <button
            aria-label="Send message"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-contrast)] disabled:opacity-45"
            disabled={!draft.trim() || isSending}
            type="submit"
          >
            <Send aria-hidden="true" size={19} strokeWidth={2.3} />
          </button>
        </form>
          </section>
        </>
      ) : null}
    </>
  );
}
