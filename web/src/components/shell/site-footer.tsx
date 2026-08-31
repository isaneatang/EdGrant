"use client";

import Link from "next/link";
import { useChainId } from "wagmi";
import { chainName, explorerLink } from "@/lib/chains";
import { contractsFor } from "@/lib/contracts";
import { CONSOLE_NAV, PRIMARY_NAV } from "./nav-items";
import { ExternalIcon } from "@/components/ui/icons";

/**
 * The footer publishes the deployed contract addresses.
 *
 * Not a formality: a donor who wants to audit this system needs to know which code they
 * are trusting, and being able to read the vault on a block explorer is the difference
 * between "trust us" and "check for yourself".
 */
export function SiteFooter() {
  const chainId = useChainId();
  const contracts = contractsFor(chainId);

  const entries = contracts
    ? ([
        ["Registry", contracts.registry],
        ["Vault", contracts.vault],
        ["Profiles", contracts.profiles],
        ["Lens (read-only)", contracts.lens],
        ["Token (USDT)", contracts.token],
      ] as const)
    : [];

  return (
    <footer className="mt-20 border-t border-rule bg-surface-sunken">
      <div className="container-page py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="font-serif text-base font-semibold text-ink">EdGrant</p>
            <p className="mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-ink-muted">
              A verified school attests that a student owes fees. If the goal is met, the
              contract pays the school directly. The student never has custody, so the money
              cannot be misappropriated by anyone who never holds it.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="eyebrow text-ink-faint">Browse</p>
            <ul className="mt-3 space-y-2">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[0.8125rem] text-ink-muted hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Roles">
            <p className="eyebrow text-ink-faint">Roles</p>
            <ul className="mt-3 space-y-2">
              {CONSOLE_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[0.8125rem] text-ink-muted hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="eyebrow text-ink-faint">
              Contracts on {chainName(chainId)}
            </p>
            {entries.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {entries.map(([label, address]) => {
                  const href = explorerLink(chainId, "address", address);
                  return (
                    <li key={label} className="flex items-baseline justify-between gap-2">
                      <span className="shrink-0 text-[0.8125rem] text-ink-muted">{label}</span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="link-evidence inline-flex items-baseline gap-1 font-mono text-[0.75rem]"
                        >
                          {address.slice(0, 6)}…{address.slice(-4)}
                          <ExternalIcon size={10} />
                        </a>
                      ) : (
                        <code className="font-mono text-[0.75rem] text-ink-faint">
                          {address.slice(0, 6)}…{address.slice(-4)}
                        </code>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
                Not deployed on this network.
              </p>
            )}
          </div>
        </div>

        <div className="mt-10 border-t border-rule pt-6">
          <p className="text-[0.75rem] leading-relaxed text-ink-faint">
            The vault has no administrative override, no pause, and no way to cancel a request
            or seize contributions. Verification is the one deliberately centralised part of
            this system and it is proof-of-control, not a judgement about any institution.
            every verified badge links to a public proof you can re-check yourself. These
            contracts have not been professionally audited.
          </p>
        </div>
      </div>
    </footer>
  );
}
