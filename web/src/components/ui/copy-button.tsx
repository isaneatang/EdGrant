"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be denied (insecure context, permissions). Fall back to a
      // selection so the value is still recoverable by hand.
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.body.removeChild(el);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xs text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink ${className}`}
    >
      {copied ? <CheckIcon size={13} className="text-delivered" /> : <CopyIcon size={13} />}
    </button>
  );
}
