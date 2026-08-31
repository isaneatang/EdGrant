"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef } from "react";
import { CONSOLE_NAV, PRIMARY_NAV, isActive } from "./nav-items";
import { CloseIcon } from "@/components/ui/icons";
import { ThemeToggle } from "./theme-toggle";
import { NetworkPicker } from "./network-picker";

/**
 * Mobile navigation drawer.
 *
 * Built by hand rather than pulled in, because the accessibility details are the point:
 *
 *   - Escape closes it, and focus returns to the button that opened it.
 *   - Focus is trapped inside while open, so Tab cannot wander into the page behind.
 *   - Background scroll is locked without the iOS rubber-band jump (position is left
 *     alone; `overflow: hidden` plus `touch-action: none` on <html>).
 *   - Every target is at least 48px tall — this is used one-handed on a phone.
 *   - Padded for safe-area insets so it clears notches and home indicators.
 *   - Navigating closes it, including when the same route is tapped again.
 */
export function MobileNav({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Close on route change. A tapped link should never leave the drawer hanging open.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Scroll lock on <html>. Applied as a class so the rule lives with the rest of the
  // theme rather than as inline style scattered through JS.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("scroll-locked");
    return () => root.classList.remove("scroll-locked");
  }, [open]);

  // Move focus in on open, and back to the trigger on close.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => closeRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
    returnFocusRef.current?.focus();
  }, [open, returnFocusRef]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" onKeyDown={onKeyDown}>
      <div
        className="animate-fade-in absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-slide-in absolute inset-y-0 right-0 flex w-[min(21rem,88vw)] flex-col border-l border-rule bg-surface overlay-shadow"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-rule px-4">
          <h2 id={titleId} className="eyebrow font-sans! text-ink-muted">
            Menu
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-sm text-ink-soft hover:bg-surface-sunken hover:text-ink"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <DrawerLink item={item} active={isActive(pathname, item)} onClose={onClose} />
              </li>
            ))}
          </ul>

          <div className="mt-5 mb-2 flex items-center gap-3 px-3">
            <span className="eyebrow text-ink-faint">Roles</span>
            <span className="h-px flex-1 bg-rule" aria-hidden />
          </div>
          <p className="mb-1.5 px-3 text-[0.75rem] leading-relaxed text-ink-faint">
            Only useful if this wallet is a verified institution or a verifier.
          </p>
          <ul className="space-y-0.5">
            {CONSOLE_NAV.map((item) => (
              <li key={item.href}>
                <DrawerLink item={item} active={isActive(pathname, item)} onClose={onClose} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 space-y-3 border-t border-rule px-4 py-4">
          <div>
            <p className="eyebrow mb-1.5 text-ink-faint">Network</p>
            <NetworkPicker className="w-full" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] text-ink-muted">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerLink({
  item,
  active,
  onClose,
}: {
  item: (typeof PRIMARY_NAV)[number];
  active: boolean;
  onClose: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[3rem] items-start gap-3 rounded-sm px-3 py-2.5 transition-colors ${
        active
          ? "bg-evidence-soft text-evidence"
          : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${active ? "text-evidence" : "text-ink-faint"}`}>
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] leading-tight font-medium">{item.label}</span>
        <span
          className={`mt-0.5 block text-[0.75rem] leading-snug ${active ? "text-evidence/75" : "text-ink-faint"}`}
        >
          {item.hint}
        </span>
      </span>
    </Link>
  );
}
