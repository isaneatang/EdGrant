"use client";

import { useChainId } from "wagmi";
import { explorerLink } from "@/lib/chains";
import { shortAddress } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { ExternalIcon } from "./icons";

/**
 * An address is a fact a donor may want to check, so it is always shown in full on
 * wide screens, truncated only where space genuinely forces it, and always copyable.
 * Never rendered as a friendly nickname: a nickname is exactly the layer an
 * impersonator would want us to insert.
 */
export function AddressDisplay({
  address,
  variant = "inline",
  truncate = true,
  chars = 4,
  showCopy = true,
  showExplorer = true,
  className = "",
}: {
  address: string;
  variant?: "inline" | "block";
  truncate?: boolean;
  chars?: number;
  showCopy?: boolean;
  showExplorer?: boolean;
  className?: string;
}) {
  const chainId = useChainId();
  const href = showExplorer ? explorerLink(chainId, "address", address) : null;

  const text = truncate ? shortAddress(address, chars) : address;

  if (variant === "block") {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-sm border border-rule bg-surface-sunken px-2.5 py-2 ${className}`}
      >
        <code
          className="min-w-0 flex-1 font-mono text-[0.8125rem] leading-snug break-all text-ink"
          title={address}
        >
          {text}
        </code>
        {showCopy ? <CopyButton value={address} label="Copy address" /> : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            title="View on block explorer"
            aria-label="View on block explorer"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xs text-ink-faint hover:bg-surface hover:text-ink"
          >
            <ExternalIcon size={13} />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <code className="font-mono text-[0.8125rem] text-ink-soft" title={address}>
        {text}
      </code>
      {showCopy ? <CopyButton value={address} label="Copy address" /> : null}
    </span>
  );
}
