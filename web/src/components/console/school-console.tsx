"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDeployment, useEntity } from "@/hooks/use-edgrant";
import { ApplyForVerification } from "./apply-for-verification";
import { ProfileEditor } from "./profile-editor";
import { PostComposer } from "./post-composer";
import { NewRequestForm } from "./new-request-form";
import { SchoolRequests } from "./school-requests";
import { VerifiedBadge } from "@/components/trust/verified-badge";
import { AddressDisplay } from "@/components/ui/address-display";
import { WalletButton } from "@/components/shell/wallet-button";
import { EmptyState, ErrorState } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { BuildingIcon } from "@/components/ui/icons";
import { entityTypeLabel } from "@/lib/request";
import { formatDate } from "@/lib/format";

type Tab = "balances" | "profile" | "posts";

const TABS: { id: Tab; label: string }[] = [
  { id: "balances", label: "Fee balances" },
  { id: "profile", label: "Profile" },
  { id: "posts", label: "Announcements" },
];

/**
 * The school's console.
 *
 * Two states, and which one you see depends only on whether the connected wallet is
 * currently verified. There is no login, no role assignment, and nothing for us to grant:
 * the registry is the only authority, and the console simply reflects what it says.
 *
 * A revoked school lands back in the application state, because every write on both the
 * profile contract and the vault is gated on current verification. Its existing profile and
 * requests stay readable to the public on purpose, so a donor can see what was claimed
 * next to the fact that the badge is gone.
 */
export function SchoolConsole() {
  const { address, isConnected } = useAccount();
  const { ready } = useDeployment();
  const { entity, isLoading } = useEntity(address);
  const [tab, setTab] = useState<Tab>("balances");

  if (!isConnected || !address) {
    return (
      <EmptyState title="Connect your institution's wallet" icon={<BuildingIcon size={28} />}>
        This console reflects what the registry says about the connected address. There is no
        account to create and no password. The wallet is the identity.
        <div className="mt-5 flex justify-center">
          <WalletButton />
        </div>
      </EmptyState>
    );
  }

  if (!ready) {
    return (
      <ErrorState
        title="Not deployed on this network"
        message="Switch to a network where EdGrant is deployed."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const verified = entity?.active ?? false;

  if (!verified) {
    return (
      <div className="space-y-6">
        <div className="card px-4 py-3.5 sm:px-5">
          <p className="eyebrow text-ink-faint">Connected as</p>
          <div className="mt-1.5">
            <AddressDisplay address={address} variant="block" truncate={false} />
          </div>
          {entity && entity.verifiedAt > 0n ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-fault">
              This address was verified as{" "}
              <strong className="font-medium">{entity.name}</strong> on{" "}
              {formatDate(entity.verifiedAt)} and has since been revoked. It cannot publish or
              attest anything until it is verified again. Its existing profile and requests stay
              publicly readable.
            </p>
          ) : (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
              Not verified. Only a currently-verified institution can publish a profile or
              attest a fee balance. That gate is what makes the badge mean anything.
            </p>
          )}
        </div>
        <ApplyForVerification applicant={address} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="evidence-panel px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-ink-faint">Verified as</p>
            <p className="mt-1 font-serif text-[1.25rem] leading-snug font-semibold text-ink">
              {entity?.name}
            </p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
              {entityTypeLabel(entity?.entityType ?? 0)} · verified{" "}
              {formatDate(entity?.verifiedAt)}
            </p>
          </div>
          <VerifiedBadge
            verified
            entityName={entity?.name ?? ""}
            proofURI={entity?.proofURI ?? ""}
            size="sm"
          />
        </div>
        <div className="mt-3">
          <p className="eyebrow text-ink-faint">Every payout goes here</p>
          <div className="mt-1.5">
            <AddressDisplay address={address} variant="block" truncate={false} />
          </div>
        </div>
      </div>

      <nav aria-label="Console sections" className="border-b border-rule">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center border-b-2 px-3.5 text-[0.875rem] whitespace-nowrap transition-colors ${
                    active
                      ? "border-evidence font-medium text-ink"
                      : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "balances" ? (
        <div className="space-y-6">
          <NewRequestForm school={address} />
          <SchoolRequests school={address} />
        </div>
      ) : null}
      {tab === "profile" ? <ProfileEditor /> : null}
      {tab === "posts" ? <PostComposer /> : null}
    </div>
  );
}
