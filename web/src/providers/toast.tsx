"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastTone = "neutral" | "evidence" | "delivered" | "fault";

export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  /** Explorer link for a transaction hash, when there is one. */
  href?: string;
  hrefLabel?: string;
  /** Sticky toasts stay until dismissed. Failures are always sticky. */
  sticky?: boolean;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TTL = 7000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      const sticky = toast.sticky ?? toast.tone === "fault";
      setToasts((current) => [...current.slice(-3), { ...toast, id, sticky }]);
      if (!sticky) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), DEFAULT_TTL),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE_CLASS: Record<ToastTone, string> = {
  neutral: "border-rule",
  evidence: "border-evidence-rule",
  delivered: "border-delivered-rule",
  fault: "border-fault-rule",
};

const TONE_ACCENT: Record<ToastTone, string> = {
  neutral: "bg-ink-muted",
  evidence: "bg-evidence",
  delivered: "bg-delivered",
  fault: "bg-fault",
};

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:px-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`animate-rise pointer-events-auto flex w-full max-w-md gap-3 overflow-hidden rounded-md border bg-surface-raised pr-3 overlay-shadow ${TONE_CLASS[toast.tone]}`}
        >
          <div className={`w-1 shrink-0 ${TONE_ACCENT[toast.tone]}`} aria-hidden />
          <div className="min-w-0 flex-1 py-3">
            <p className="text-sm font-medium text-ink">{toast.title}</p>
            {toast.body ? (
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-muted break-words">
                {toast.body}
              </p>
            ) : null}
            {toast.href ? (
              <a
                href={toast.href}
                target="_blank"
                rel="noreferrer noopener"
                className="link-evidence mt-1.5 inline-block text-[0.8125rem]"
              >
                {toast.hrefLabel ?? "View transaction"} ↗
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="my-2 h-8 w-8 shrink-0 self-start rounded-xs text-ink-faint hover:bg-surface-sunken hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
