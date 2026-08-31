"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useChainId, useConnect, useConnectors, useDisconnect } from "wagmi";
import { formatUnits } from "viem";
import { chainName, explorerLink } from "@/lib/chains";
import { shortAddress } from "@/lib/format";
import { useToast } from "@/providers/toast";
import { AddressDisplay } from "@/components/ui/address-display";
import { ChevronDownIcon, ExternalIcon, WalletIcon, SpinnerIcon } from "@/components/ui/icons";

/**
 * Wallet connection.
 *
 * Injected wallets are listed first. WalletConnect appears only when a Reown project
 * id is configured (see lib/wagmi.ts); with none set this is injected-only as before.
 * EIP-6963 discovery means whatever the browser announces shows up here without us
 * maintaining a list.
 *
 * This interface never asks for a seed phrase or a private key, and there is no code
 * path where it could: it only ever requests signatures through the provider.
 */
export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const connectors = useConnectors();
  const { mutate: connect, isPending: connectPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: native } = useBalance({
    address,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Injected wallets first, then WalletConnect. Ordered rather than filtered: the old
  // filter kept only injected connectors, so adding WalletConnect to the wagmi config
  // would have silently produced no visible change here.
  const rank = (c: (typeof connectors)[number]) =>
    c.type === "injected" || c.id === "injected" ? 0 : 1;
  const options = [...connectors].sort((a, b) => rank(a) - rank(b));

  if (!isConnected) {
    const busy = isConnecting || isReconnecting || connectPending;

    if (options.length === 0) {
      return (
        <a
          href="https://ethereum.org/en/wallets/find-wallet/"
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary btn-sm"
        >
          No wallet detected
          <ExternalIcon size={13} />
        </a>
      );
    }

    if (options.length === 1) {
      const only = options[0]!;
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            connect(
              { connector: only },
              {
                onError: (error) =>
                  push({
                    tone: "fault",
                    title: "Wallet did not connect",
                    body: cleanError(error),
                  }),
              },
            )
          }
          className="btn btn-primary btn-sm"
        >
          {busy ? <SpinnerIcon size={14} /> : <WalletIcon size={15} />}
          {busy ? "Connecting…" : compact ? "Connect" : "Connect wallet"}
        </button>
      );
    }

    return (
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="btn btn-primary btn-sm"
        >
          {busy ? <SpinnerIcon size={14} /> : <WalletIcon size={15} />}
          {compact ? "Connect" : "Connect wallet"}
        </button>
        {open ? (
          <div
            role="menu"
            className="animate-rise absolute right-0 z-50 mt-2 w-64 rounded-md border border-rule bg-surface-raised p-1.5 overlay-shadow"
          >
            <p className="px-2.5 pt-1.5 pb-2 text-[0.75rem] text-ink-faint">
              Choose a wallet. EdGrant never asks for a seed phrase.
            </p>
            {options.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  connect(
                    { connector },
                    {
                      onError: (error) =>
                        push({
                          tone: "fault",
                          title: "Wallet did not connect",
                          body: cleanError(error),
                        }),
                    },
                  );
                }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm text-ink-soft hover:bg-surface-sunken hover:text-ink"
              >
                {connector.icon ? (
                  <img src={connector.icon} alt="" className="h-5 w-5 rounded-xs" />
                ) : (
                  <WalletIcon size={17} />
                )}
                {connector.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const explorer = address ? explorerLink(chainId, "address", address) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn-secondary btn-sm font-mono text-[0.8125rem]"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-delivered"
          aria-label="Connected"
          role="img"
        />
        {shortAddress(address, compact ? 3 : 4)}
        <ChevronDownIcon size={13} className="text-ink-faint" />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-rise absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-rule bg-surface-raised p-3 overlay-shadow"
        >
          <p className="eyebrow text-ink-faint">Connected wallet</p>
          <div className="mt-1.5">
            <AddressDisplay address={address!} truncate={false} variant="block" />
          </div>

          <dl className="mt-3 text-[0.8125rem]">
            <div className="data-row py-2">
              <dt className="text-ink-muted">Network</dt>
              <dd className="text-ink">{chainName(chainId)}</dd>
            </div>
            <div className="data-row border-b-0 py-2">
              <dt className="text-ink-muted">Gas balance</dt>
              <dd className="tabular text-ink">
                {native
                  ? `${Number(formatUnits(native.value, native.decimals)).toLocaleString("en-GB", { maximumFractionDigits: 4 })} ${native.symbol}`
                  : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex gap-2">
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-secondary btn-sm flex-1"
              >
                Explorer
                <ExternalIcon size={12} />
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                disconnect();
              }}
              className="btn btn-ghost btn-sm flex-1"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0]?.slice(0, 180) ?? "Unknown error";
}
