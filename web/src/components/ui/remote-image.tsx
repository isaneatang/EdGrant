"use client";

import { useState } from "react";
import { safeImageSrc } from "@/lib/uri";

/**
 * A school-supplied image.
 *
 * Three things this handles that a bare <img> does not:
 *
 *   1. The URI is untrusted, so it goes through the same allowlist as every other link —
 *      only http(s) and ipfs:// resolve to anything.
 *   2. It is fetched by the visitor's browser, never proxied by our server, so a school
 *      cannot make us request arbitrary URLs on its behalf.
 *   3. It will sometimes fail — a dead IPFS pin, a moved file, a host that refuses
 *      cross-origin reads. A broken logo must degrade to something dignified rather than
 *      leaving a torn-image glyph on an institution's page.
 */
export function RemoteImage({
  src,
  alt = "",
  className = "",
  fallback,
}: {
  src: string | undefined;
  alt?: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const resolved = safeImageSrc(src);

  if (!resolved || broken) return <>{fallback}</>;

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

/** Initials placeholder, used when a school has no logo or its logo will not load. */
export function InstitutionMonogram({
  name,
  className = "h-10 w-10",
}: {
  name: string;
  className?: string;
}) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length === 0
      ? "—"
      : words
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-sm border border-rule bg-surface-sunken font-serif text-sm font-semibold text-ink-faint ${className}`}
    >
      {initials}
    </span>
  );
}
