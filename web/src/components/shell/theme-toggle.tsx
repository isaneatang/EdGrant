"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/providers/theme";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

/**
 * Hydration-safe "has this rendered on the client yet".
 *
 * `useSyncExternalStore` rather than an effect: React calls `getServerSnapshot` for the SSR
 * pass AND for the hydration render, then switches to `getSnapshot`. That is precisely the
 * guarantee needed here — server and first client render agree by construction — and unlike
 * setting state in an effect it does not fight the lint rule that exists to stop exactly
 * that pattern. Defined at module scope so the subscription is never torn down and rebuilt.
 */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The one control whose correct appearance is known to the browser before it is known to
 * React, which makes it the one place hydration has to be handled deliberately.
 *
 * The server cannot know a visitor's colour preference, so it always renders the light-mode
 * variant. The bootstrap script in <head> then puts the right class on <html> before first
 * paint. If this component read `resolved` during its first client render — which is correct
 * for the page and was what it used to do — that first render would disagree with the server
 * HTML and React would fail hydration for the whole tree.
 *
 * So the two halves are handled differently, according to what each one actually needs:
 *
 *   The GLYPH is chosen by CSS, off the same `dark` class the bootstrap script has already
 *   set. It is right on the first painted frame, with no JavaScript involved and nothing for
 *   React to disagree about. This matters: a toggle that blinks the wrong icon on every load
 *   is the same class of defect as a theme that flashes, and the fix for one should not
 *   reintroduce the other.
 *
 *   The ACCESSIBLE NAME cannot be done in CSS, and a name that changes between server and
 *   client is exactly the mismatch above. So it starts as a state-independent description
 *   and becomes the specific "Switch to X appearance" once hydrated. Server and first client
 *   render agree; the name is accurate either way, and correct before anyone can tab to it.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, cycle } = useTheme();

  const mounted = useSyncExternalStore(neverChanges, onClient, onServer);

  const label = mounted
    ? `Switch to ${resolved === "dark" ? "light" : "dark"} appearance`
    : "Switch between light and dark appearance";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink ${className}`}
    >
      <SunIcon size={17} className="hidden dark:block" />
      <MoonIcon size={17} className="block dark:hidden" />
    </button>
  );
}
