"use client";

import { useEffect, useState } from "react";

function nowSeconds(): number {
  // 0 during SSR so the server-rendered shell and the client's first render agree. Nothing
  // time-derived is on screen at that point: every chain read is still undefined, so the
  // page is showing skeletons.
  return typeof window === "undefined" ? 0 : Math.floor(Date.now() / 1000);
}

/**
 * A deliberately coarse clock.
 *
 * Ticks once a minute, which is enough to move a request from "open" to "closed unmet"
 * shortly after its deadline and nowhere near often enough to render a countdown. That is
 * the point: urgency theatre is the fraudster's tool, and this product exists to replace it.
 * Deadlines are day-scale by construction — the vault's MIN_DURATION is one day — so a
 * minute of drift cannot change any outcome.
 *
 * Nothing that decides whether a *button* appears depends on this value; that comes from the
 * contract's own `refundable` verdict. This clock is for display.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(nowSeconds);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowSeconds()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
