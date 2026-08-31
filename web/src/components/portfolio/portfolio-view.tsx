"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { educationFundingVaultAbi } from "@/lib/abi";
import { contractsFor } from "@/lib/contracts";
import { formatAmount, formatDate, pluralise, shortHash } from "@/lib/format";
import { deriveRequestState } from "@/lib/request";
import { useDeployment, useMyContributions, type ContributionRow } from "@/hooks/use-edgrant";
import { useNow } from "@/hooks/use-now";
import { useTxRunner } from "@/hooks/use-tx";
import { WalletButton } from "@/components/shell/wallet-button";
import { Callout, EmptyState, ErrorState } from "@/components/ui/callout";
import { StatusChip } from "@/components/ui/chip";
import { FundingMeter } from "@/components/ui/funding-meter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRightIcon, SpinnerIcon, UsersIcon } from "@/components/ui/icons";

/**
 * A contributor's own position, and the only place refunds are actually claimed.
 *
 * This page exists because refunds are pull-based by design: nothing is ever swept, no
 * administrator distributes anything, and no unclaimed balance accumulates anywhere. That
 * property is only honest if a contributor can find what they are owed without help, so
 * withdrawable balances are pulled to the top and totalled.
 *
 * Read from `vault.requestsByContributor(you)`, which is enumerable on-chain state, not a log
 * scan. Same constraint as everywhere else in this interface.
 */
export function PortfolioView() {
  const { isConnected } = useAccount();
  const { ready } = useDeployment();
  const { rows, isLoading, error, hasAny } = useMyContributions();
  const now = useNow();

  const grouped = useMemo(() => {
    const withdrawable: ContributionRow[] = [];
    const active: ContributionRow[] = [];
    const settled: ContributionRow[] = [];

    for (const row of rows) {
      const state = deriveRequestState(row.request, {
        schoolVerified: row.schoolVerified,
        nowSeconds: now,
        chainRefundable: row.refundable,
      });
      if (state.canRefund && row.contributed > 0n) withdrawable.push(row);
      else if (row.request.disbursed) settled.push(row);
      else active.push(row);
    }
    return { withdrawable, active, settled };
  }, [rows, now]);

  const totals = useMemo(() => {
    let given = 0n;
    let delivered = 0n;
    let held = 0n;
    let claimable = 0n;
    for (const row of rows) {
      given += row.contributed;
      if (row.request.disbursed) delivered += row.contributed;
      else held += row.contributed;
    }
    for (const row of grouped.withdrawable) claimable += row.contributed;
    return { given, delivered, held, claimable };
  }, [rows, grouped.withdrawable]);

  if (!isConnected) {
    return (
      <EmptyState title="Connect a wallet to see your contributions" icon={<UsersIcon size={28} />}>
        Your contribution history is read from the vault by address. Nothing is stored on a
        server, there is no account to create, and EdGrant never asks for a seed phrase.
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
        message="Switch to a network where EdGrant is deployed to read your contributions."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) return <ErrorState message={error.message} />;

  if (!hasAny || rows.length === 0) {
    return (
      <EmptyState title="You have not contributed yet" icon={<UsersIcon size={28} />}>
        Once you contribute to a fee balance it appears here, along with anything you can
        withdraw.
        <div className="mt-5 flex justify-center">
          <Link href="/" className="btn btn-primary">
            Browse open balances
          </Link>
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-9">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Contributed in total" value={formatAmount(totals.given)} />
        <Summary
          label="Reached a school"
          value={formatAmount(totals.delivered)}
          tone="delivered"
        />
        <Summary label="Still held by the vault" value={formatAmount(totals.held)} />
        <Summary
          label="You can withdraw"
          value={formatAmount(totals.claimable)}
          tone={totals.claimable > 0n ? "notice" : undefined}
        />
      </dl>

      {grouped.withdrawable.length > 0 ? (
        <section aria-labelledby="withdrawable-heading">
          <h2
            id="withdrawable-heading"
            className="border-b border-rule pb-3 font-serif text-xl font-semibold text-ink"
          >
            Available to withdraw
          </h2>
          <Callout tone="notice" className="mt-4">
            Nothing here was sent to a school. Each withdrawal returns exactly what you put in,
            and only you can trigger it. There is no administrator who could do it for you, and
            no deadline after which it stops being yours.
          </Callout>
          <ul className="mt-4 space-y-4">
            {grouped.withdrawable.map((row) => (
              <PositionRow key={row.requestId.toString()} row={row} nowSeconds={now} claimable />
            ))}
          </ul>
        </section>
      ) : null}

      {grouped.active.length > 0 ? (
        <section aria-labelledby="active-heading">
          <h2
            id="active-heading"
            className="border-b border-rule pb-3 font-serif text-xl font-semibold text-ink"
          >
            In progress
          </h2>
          <ul className="mt-4 space-y-4">
            {grouped.active.map((row) => (
              <PositionRow key={row.requestId.toString()} row={row} nowSeconds={now} />
            ))}
          </ul>
        </section>
      ) : null}

      {grouped.settled.length > 0 ? (
        <section aria-labelledby="settled-heading">
          <h2
            id="settled-heading"
            className="border-b border-rule pb-3 font-serif text-xl font-semibold text-ink"
          >
            Delivered to a school
          </h2>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
            These balances were fully funded and paid directly to the institution&apos;s verified
            wallet. This is the part of your giving that provably arrived.
          </p>
          <ul className="mt-4 space-y-4">
            {grouped.settled.map((row) => (
              <PositionRow key={row.requestId.toString()} row={row} nowSeconds={now} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "delivered" | "notice";
}) {
  const style =
    tone === "delivered"
      ? "border-delivered-rule bg-delivered-soft"
      : tone === "notice"
        ? "border-notice-rule bg-notice-soft"
        : "border-rule bg-surface";
  const ink =
    tone === "delivered" ? "text-delivered" : tone === "notice" ? "text-notice" : "text-ink";
  return (
    <div className={`rounded-md border px-3.5 py-3 ${style}`}>
      <dt className={`eyebrow ${tone ? ink : "text-ink-faint"}`}>{label}</dt>
      <dd className={`tabular mt-1 font-serif text-[1.25rem] leading-none font-semibold ${ink}`}>
        {value}
      </dd>
    </div>
  );
}

function PositionRow({
  row,
  nowSeconds,
  claimable = false,
}: {
  row: ContributionRow;
  nowSeconds: number;
  claimable?: boolean;
}) {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const tx = useTxRunner();
  const state = deriveRequestState(row.request, {
    schoolVerified: row.schoolVerified,
    nowSeconds,
  });

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/schools/${row.request.school}`}
            className="text-[0.875rem] font-medium text-ink hover:underline"
          >
            {row.schoolName || "Institution"}
          </Link>
          <p className="mt-0.5 font-mono text-[0.6875rem] tracking-wide text-ink-faint">
            #{row.requestId.toString()} · REF {shortHash(row.request.studentRef, 4)}
          </p>
        </div>
        <StatusChip status={state.status} label={state.label} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <FundingMeter
            raised={row.request.raised}
            goal={row.request.goal}
            progress={state.progress}
            tone={state.status === "disbursed" ? "delivered" : "evidence"}
            compact
          />
          <p className="mt-2 text-[0.75rem] text-ink-muted">
            {state.status === "disbursed"
              ? "Paid to the school in full"
              : `Closes ${formatDate(row.request.deadline)}`}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="eyebrow text-ink-faint">Your contribution</p>
          <p className="tabular mt-0.5 font-serif text-lg font-semibold text-ink">
            {formatAmount(row.contributed)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3.5">
        <Link
          href={`/requests/${row.requestId.toString()}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-muted hover:text-ink"
        >
          Request detail
          <ChevronRightIcon size={13} />
        </Link>

        {claimable && contracts ? (
          <button
            type="button"
            disabled={tx.isBusy}
            onClick={() =>
              tx.run({
                address: contracts.vault,
                abi: educationFundingVaultAbi,
                functionName: "refund",
                args: [row.requestId],
                label: "Withdrawal",
                success: `${formatAmount(row.contributed)} was returned to your wallet.`,
              })
            }
            className="btn btn-primary btn-sm"
          >
            {tx.isBusy ? <SpinnerIcon size={13} /> : null}
            {tx.stage === "signing"
              ? "Confirm in your wallet…"
              : tx.stage === "mining"
                ? "Withdrawing…"
                : `Withdraw ${formatAmount(row.contributed)}`}
          </button>
        ) : null}
      </div>

      {claimable && state.status === "verification-withdrawn" ? (
        <p className="mt-3 text-[0.75rem] leading-relaxed text-fault">
          This school&apos;s verification was revoked, so the vault can never pay it. Withdrawals
          opened immediately rather than waiting for the deadline.
        </p>
      ) : null}

      {tx.error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-fault">
          {tx.error}
        </p>
      ) : null}
    </li>
  );
}

export function PortfolioHeading({ count }: { count?: number }) {
  return (
    <header className="max-w-2xl">
      <p className="eyebrow text-evidence">Your position</p>
      <h1 className="mt-2.5 font-serif text-[1.875rem] leading-tight font-semibold text-ink sm:text-[2.375rem]">
        Your contributions
      </h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
        Everything this wallet has contributed, what reached a school, and anything you can
        withdraw. Refunds are individual and pull-based: you take back exactly what you put in,
        whenever you want, and nobody can do it for you or instead of you.
      </p>
      {count !== undefined ? (
        <p className="mt-2 text-[0.8125rem] text-ink-muted">
          {count} {pluralise(count, "balance")} supported.
        </p>
      ) : null}
    </header>
  );
}
