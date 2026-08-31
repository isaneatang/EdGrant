"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { AssertedBlock } from "@/components/trust/asserted-block";
import { EvidencePanel } from "@/components/trust/evidence-panel";
import { DisbursementNotice, OutcomeTerms } from "@/components/trust/disbursement";
import { ContributePanel } from "@/components/requests/contribute-panel";
import { ReleaseAction, RefundAction } from "@/components/requests/request-actions";
import { AddressDisplay } from "@/components/ui/address-display";
import { Callout, EmptyState, ErrorState } from "@/components/ui/callout";
import { StatusChip } from "@/components/ui/chip";
import { FundingMeter } from "@/components/ui/funding-meter";
import { CopyButton } from "@/components/ui/copy-button";
import { ChevronRightIcon, LedgerIcon, UsersIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatAmount,
  formatCoarseInterval,
  formatDate,
  formatDateTime,
  pluralise,
} from "@/lib/format";
import { deriveRequestState, entityTypeLabel } from "@/lib/request";
import {
  useContributorCount,
  useDeployment,
  useEntity,
  useMyContribution,
  useRequestSummary,
} from "@/hooks/use-edgrant";
import { useNow } from "@/hooks/use-now";

/**
 * THE CONTRIBUTION SCREEN. The most important screen in the product.
 *
 * Before a donor signs anything, without reading any documentation, this page must show:
 *
 *   - that the school is verified, and what that verification is actually based on
 *   - the badge, linking straight to the proof URI, so they can re-check it themselves
 *   - the disbursement destination, explicitly, as an address on the page
 *   - what happens if the goal is not met, stated plainly
 *
 * `vault.requestSummary(id)` returns every one of those in a single `eth_call`. It was
 * designed for this screen specifically.
 */
export function RequestDetail({ requestId }: { requestId: bigint | null }) {
  const { ready } = useDeployment();
  const { summary, isLoading, error, refetch } = useRequestSummary(requestId ?? undefined);
  const { entity } = useEntity(summary?.request.school);
  const { data: contributors } = useContributorCount(requestId ?? undefined);
  const { data: mine } = useMyContribution(requestId ?? undefined);
  const { isConnected } = useAccount();
  const now = useNow();

  const state = useMemo(() => {
    if (!summary) return null;
    return deriveRequestState(summary.request, {
      schoolVerified: summary.schoolVerified,
      nowSeconds: now,
      chainRefundable: summary.refundable,
    });
  }, [summary, now]);

  if (requestId === null) {
    return (
      <div className="container-reading py-16">
        <EmptyState title="That is not a request id" icon={<LedgerIcon size={28} />}>
          Request ids are whole numbers assigned in order by the vault, starting at zero.
        </EmptyState>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Not deployed on this network"
          message="Switch to a network where EdGrant is deployed. This interface never borrows another chain's contract addresses."
        />
      </div>
    );
  }

  if (isLoading) return <DetailSkeleton />;

  if (error || !summary || !state) {
    const unknown = error?.message?.includes("UnknownRequest");
    return (
      <div className="container-reading py-16">
        {unknown ? (
          <EmptyState title={`Request #${requestId.toString()} does not exist`} icon={<LedgerIcon size={28} />}>
            <Link href="/" className="link">
              Browse open fee balances
            </Link>
          </EmptyState>
        ) : (
          <ErrorState onRetry={() => void refetch()} message={error?.message} />
        )}
      </div>
    );
  }

  const { request, context } = summary;
  const pseudonym = context.pseudonym.trim();
  const statement = context.statement.trim();
  const contributorCount = Number(contributors ?? 0n);

  return (
    <div className="container-page py-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-[0.8125rem]">
        <Link href="/" className="text-ink-muted hover:text-ink">
          Fee requests
        </Link>
        <ChevronRightIcon size={12} className="text-ink-faint" />
        <span className="text-ink">#{requestId.toString()}</span>
      </nav>

      {/* ---- Headline: the verified facts, the amount, the state ---- */}
      <header className="border-b border-rule pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-ink-faint">Outstanding fee balance attested by</p>
            <h1 className="mt-1.5 font-serif text-[1.75rem] leading-tight font-semibold text-ink sm:text-[2.125rem]">
              <Link href={`/schools/${request.school}`} className="hover:underline">
                {summary.schoolName || "An institution"}
              </Link>
            </h1>
            <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
              {entity ? entityTypeLabel(entity.entityType) : "Institution"} · request
              #{requestId.toString()} · attested {formatDate(request.createdAt)}
            </p>
          </div>
          <StatusChip status={state.status} label={state.label} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tabular font-serif text-[2.25rem] leading-none font-semibold text-ink">
                {formatAmount(request.raised, { symbol: false })}
              </span>
              <span className="tabular text-[1.0625rem] text-ink-muted">
                of {formatAmount(request.goal)} raised
              </span>
            </div>
            <div className="mt-3 max-w-xl">
              <FundingMeter
                raised={request.raised}
                goal={request.goal}
                progress={state.progress}
                tone={state.status === "disbursed" ? "delivered" : "evidence"}
                showLabels={false}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:text-right">
            <Stat label="Still outstanding" value={formatAmount(state.remaining)} />
            <Stat
              label="Contributors"
              value={`${contributorCount} ${pluralise(contributorCount, "wallet")}`}
              icon={<UsersIcon size={13} />}
            />
            <Stat label="Closes" value={formatDate(request.deadline)} />
          </dl>
        </div>

        <p className="mt-5 max-w-3xl rounded-sm border border-rule bg-surface-sunken px-3.5 py-3 text-[0.875rem] leading-relaxed text-ink-soft">
          {state.detail}
        </p>
      </header>

      {/* ---- Two columns on desktop: evidence left, action right ---- */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem] xl:gap-8">
        <div className="min-w-0 space-y-6">
          <DisbursementNotice
            destination={summary.disbursementDestination}
            entityName={summary.schoolName}
            verified={summary.schoolVerified}
          />

          <EvidencePanel
            school={request.school}
            verified={summary.schoolVerified}
            entityName={summary.schoolName}
            entityType={entity?.entityType ?? 0}
            proofURI={summary.schoolProofURI}
            verifiedAt={entity?.verifiedAt ?? 0n}
          />

          {!summary.schoolVerified ? (
            <Callout tone="fault" title="This school's verification has been revoked">
              The profile and this request stay readable on purpose — you should be able to see
              what was claimed next to the fact that the badge is gone. No payout is possible
              and every contributor can withdraw now. Revocation can only ever return money to
              the people who sent it; it can never redirect it.
            </Callout>
          ) : null}

          {/* Student context: optional, self-asserted, written by the school. */}
          {pseudonym || statement ? (
            <AssertedBlock
              label="About this student"
              caption="Written by the school on the student's behalf. Not verified, and cannot affect where the money goes."
            >
              {pseudonym ? (
                <p className="text-[0.9375rem] font-medium text-ink-soft">{pseudonym}</p>
              ) : null}
              {statement ? (
                <p className="asserted-prose mt-2 whitespace-pre-wrap">{statement}</p>
              ) : null}
            </AssertedBlock>
          ) : (
            <div className="asserted-panel px-4 py-4 sm:px-5">
              <p className="eyebrow text-ink-muted">About this student</p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
                Nothing was shared. The mechanism works fully without it — a student is never
                required to hold a wallet, expose an address, or publish a personal story in
                order to be helped.
              </p>
            </div>
          )}

          <OutcomeTerms
            goal={request.goal}
            deadline={request.deadline}
            destinationName={summary.schoolName}
          />

          <OnChainRecord
            requestId={requestId}
            studentRef={request.studentRef}
            school={request.school}
            createdAt={request.createdAt}
            deadline={request.deadline}
            nowSeconds={now}
            disbursed={request.disbursed}
          />
        </div>

        {/* ---- Action rail. Sticky on desktop, natural flow on mobile. ---- */}
        <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
          {state.canContribute ? (
            <ContributePanel
              requestId={requestId}
              state={state}
              remaining={state.remaining}
              goal={request.goal}
            />
          ) : null}

          {state.canRelease ? (
            <ReleaseAction
              requestId={requestId}
              goal={request.goal}
              destination={summary.disbursementDestination}
              destinationName={summary.schoolName}
            />
          ) : null}

          {state.canRefund ? (
            <RefundAction
              requestId={requestId}
              reason={state.status === "verification-withdrawn" ? "verification-withdrawn" : "closed-unmet"}
            />
          ) : null}

          {state.status === "disbursed" ? (
            <div className="card border-delivered-rule overflow-hidden">
              <header className="border-b border-rule px-4 py-3 sm:px-5">
                <h2 className="eyebrow font-sans! text-delivered">Delivered</h2>
              </header>
              <div className="px-4 py-4 sm:px-5">
                <p className="tabular font-serif text-2xl font-semibold text-ink">
                  {formatAmount(request.goal)}
                </p>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
                  transferred to the school&apos;s verified wallet. This is money that actually
                  arrived at the institution — not money that was merely asked for.
                </p>
                <div className="mt-3">
                  <AddressDisplay
                    address={summary.disbursementDestination}
                    variant="block"
                    truncate={false}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {isConnected && mine !== undefined && mine > 0n ? (
            <div className="card-sunken px-4 py-3.5">
              <p className="eyebrow text-ink-faint">Your position</p>
              <p className="tabular mt-1 text-[0.9375rem] font-medium text-ink">
                {formatAmount(mine)} contributed
              </p>
              <Link href="/portfolio" className="link mt-1.5 inline-block text-[0.8125rem]">
                All your contributions
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile sticky action bar: keeps the primary action reachable one-handed. */}
      {state.canContribute ? (
        <>
          <div className="h-20 lg:hidden" aria-hidden />
          <div className="action-bar lg:hidden">
            <a href="#contribute-amount" className="btn btn-evidence w-full">
              Contribute · {formatAmount(state.remaining)} outstanding
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow text-ink-faint">{label}</dt>
      <dd className="tabular mt-1 flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink lg:justify-end">
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
        {value}
      </dd>
    </div>
  );
}

/**
 * The raw record, for anyone who wants to check the interface against the chain.
 *
 * The student reference is a keccak commitment to a school-internal identifier, not the
 * identifier itself and never a name. That is stated here rather than left as an
 * unexplained hash.
 */
function OnChainRecord({
  requestId,
  studentRef,
  school,
  createdAt,
  deadline,
  nowSeconds,
  disbursed,
}: {
  requestId: bigint;
  studentRef: string;
  school: string;
  createdAt: bigint;
  deadline: bigint;
  nowSeconds: number;
  disbursed: boolean;
}) {
  const remaining = Number(deadline) - nowSeconds;
  return (
    <details className="card group overflow-hidden">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[0.8125rem] font-medium text-ink-soft hover:text-ink sm:px-5">
        The on-chain record
        <ChevronRightIcon size={14} className="transition-transform group-open:rotate-90" />
      </summary>
      <dl className="border-t border-rule px-4 py-1 sm:px-5">
        <div className="data-row">
          <dt className="text-ink-muted">Request id</dt>
          <dd className="tabular font-mono text-ink">{requestId.toString()}</dd>
        </div>
        <div className="data-row">
          <dt className="shrink-0 text-ink-muted">School (immutable)</dt>
          <dd className="min-w-0">
            <AddressDisplay address={school} truncate={false} className="justify-end" />
          </dd>
        </div>
        <div className="data-row">
          <dt className="shrink-0 text-ink-muted">Student reference</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <code className="truncate font-mono text-[0.75rem] text-ink" title={studentRef}>
              {studentRef}
            </code>
            <CopyButton value={studentRef} label="Copy reference" />
          </dd>
        </div>
        <div className="data-row">
          <dt className="text-ink-muted">Attested</dt>
          <dd className="tabular text-ink">{formatDateTime(createdAt)}</dd>
        </div>
        <div className="data-row">
          <dt className="text-ink-muted">Closes</dt>
          <dd className="tabular text-right text-ink">
            {formatDateTime(deadline)}
            {nowSeconds > 0 ? (
              <span className="block text-[0.75rem] text-ink-faint">
                {remaining > 0
                  ? `${formatCoarseInterval(remaining)} from now`
                  : `${formatCoarseInterval(-remaining)} ago`}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="data-row border-b-0">
          <dt className="text-ink-muted">Disbursed</dt>
          <dd className="text-ink">{disbursed ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <p className="border-t border-rule bg-surface-sunken px-4 py-3 text-[0.75rem] leading-relaxed text-ink-muted sm:px-5">
        The student reference is a keccak-256 commitment to an identifier meaningful only
        inside the school&apos;s own records. It is never a name. Student information stays
        off-chain: even a bare enrolment number becomes a re-identification vector once it is
        public and permanent.
      </p>
    </details>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-page py-6 sm:py-10" aria-busy="true">
      <span className="sr-only">Loading this request from the chain…</span>
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 border-b border-rule pb-6">
        <Skeleton className="h-3 w-52" />
        <Skeleton className="mt-3 h-9 w-80 max-w-full" />
        <Skeleton className="mt-3 h-3 w-64" />
        <Skeleton className="mt-7 h-10 w-72 max-w-full" />
        <Skeleton className="mt-4 h-1.5 w-full max-w-xl" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="space-y-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
