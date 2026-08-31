"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { educationFundingVaultAbi } from "@/lib/abi";
import { contractsFor } from "@/lib/contracts";
import { formatAmount, formatDate, shortHash } from "@/lib/format";
import { deriveRequestState, toStudentRef, type RequestView } from "@/lib/request";
import { useDeployment, useSchoolRequests } from "@/hooks/use-edgrant";
import { useNow } from "@/hooks/use-now";
import { useTxRunner } from "@/hooks/use-tx";
import { ConsoleSection, TextArea, TextField } from "@/components/console/fields";
import { StatusChip } from "@/components/ui/chip";
import { FundingMeter } from "@/components/ui/funding-meter";
import { EmptyState } from "@/components/ui/callout";
import {
  ChevronRightIcon,
  LedgerIcon,
  SpinnerIcon,
  CheckIcon,
} from "@/components/ui/icons";

/**
 * The school's own view of every balance it has attested.
 *
 * Includes a reference matcher, which solves a real problem the privacy design creates:
 * on-chain the student reference is a keccak commitment, so a registrar cannot read a
 * request and recall which student it belongs to. They can, however, re-hash a candidate
 * reference from their own records, so the matcher does exactly that, locally, and
 * highlights the request it belongs to. No identifier is ever sent anywhere.
 */
export function SchoolRequests({ school }: { school: `0x${string}` }) {
  const { items, isLoading } = useSchoolRequests(school);
  const now = useNow();
  const [lookup, setLookup] = useState("");

  const lookupHash = useMemo(
    () => (lookup.trim().length > 0 ? toStudentRef(lookup) : null),
    [lookup],
  );

  const matched = useMemo(() => {
    if (!lookupHash) return null;
    return items.find((item) => item.request.studentRef.toLowerCase() === lookupHash.toLowerCase());
  }, [items, lookupHash]);

  return (
    <div className="space-y-6">
      <ConsoleSection
        title="Match a student reference"
        description="Find which request belongs to a student, without anything leaving your browser."
      >
        <TextField
          label="Internal reference"
          hint="Hashed locally and compared against your requests. Nothing is sent to any server or to the chain."
          value={lookup}
          onChange={setLookup}
          placeholder="RCC-2026-0417"
          mono
        />
        {lookupHash ? (
          <div className="mt-3">
            {matched ? (
              <div className="flex flex-wrap items-center gap-2 rounded-sm border border-delivered-rule bg-delivered-soft px-3 py-2.5 text-[0.8125rem] text-delivered">
                <CheckIcon size={14} />
                <span>
                  Matches request{" "}
                  <Link
                    href={`/requests/${matched.requestId.toString()}`}
                    className="font-medium underline"
                  >
                    #{matched.requestId.toString()}
                  </Link>{" "}
                  · {formatAmount(matched.request.goal)}
                </span>
              </div>
            ) : (
              <p className="rounded-sm border border-rule bg-surface-sunken px-3 py-2.5 text-[0.8125rem] text-ink-muted">
                No request of yours uses that reference. Hash:{" "}
                <code className="font-mono text-[0.75rem]">{shortHash(lookupHash, 10)}</code>
              </p>
            )}
          </div>
        ) : null}
      </ConsoleSection>

      <ConsoleSection
        title="Your fee balances"
        description="Every balance you have attested, newest first."
      >
        {isLoading ? (
          <p className="text-[0.875rem] text-ink-muted">Reading from the vault…</p>
        ) : items.length === 0 ? (
          <EmptyState title="No fee balances yet" icon={<LedgerIcon size={26} />}>
            Attest one above and it appears in the public feed immediately.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {items.map((view) => (
              <SchoolRequestRow
                key={view.requestId.toString()}
                view={view}
                nowSeconds={now}
                highlighted={matched?.requestId === view.requestId}
              />
            ))}
          </ul>
        )}
      </ConsoleSection>
    </div>
  );
}

function SchoolRequestRow({
  view,
  nowSeconds,
  highlighted,
}: {
  view: RequestView;
  nowSeconds: number;
  highlighted: boolean;
}) {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const tx = useTxRunner();
  const [editing, setEditing] = useState(false);
  const [pseudonym, setPseudonym] = useState(view.context.pseudonym);
  const [statement, setStatement] = useState(view.context.statement);

  // The lens computes `refundable` on-chain, so the school's own view of a request's state
  // matches what a donor sees rather than depending on this browser's clock.
  const state = deriveRequestState(view.request, {
    schoolVerified: true,
    nowSeconds,
    chainRefundable: view.refundable,
  });

  const closed = view.request.disbursed;

  return (
    <li
      className={`rounded-md border p-3.5 sm:p-4 ${
        highlighted ? "border-delivered-rule bg-delivered-soft" : "border-rule bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular font-serif text-[1.125rem] font-semibold text-ink">
            {formatAmount(view.request.goal)}
          </p>
          <p className="mt-0.5 font-mono text-[0.6875rem] tracking-wide text-ink-faint">
            #{view.requestId.toString()} · REF {shortHash(view.request.studentRef, 6)}
          </p>
        </div>
        <StatusChip status={state.status} label={state.label} />
      </div>

      <div className="mt-3">
        <FundingMeter
          raised={view.request.raised}
          goal={view.request.goal}
          progress={state.progress}
          tone={state.status === "disbursed" ? "delivered" : "evidence"}
          compact
        />
      </div>

      <p className="mt-2 text-[0.75rem] text-ink-muted">
        {state.status === "disbursed"
          ? "Paid to your wallet in full."
          : state.status === "fully-funded"
            ? "Fully funded. Anyone can trigger the payout, including you, from the request page."
            : state.status === "closed-unmet"
              ? "Closed unmet. Contributors are withdrawing their own contributions."
              : `Closes ${formatDate(view.request.deadline)}`}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule pt-3">
        <Link
          href={`/requests/${view.requestId.toString()}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-muted hover:text-ink"
        >
          Public page
          <ChevronRightIcon size={12} />
        </Link>

        {!closed ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="btn btn-ghost btn-sm ml-auto"
          >
            {editing ? "Cancel" : view.context.pseudonym || view.context.statement ? "Edit context" : "Add context"}
          </button>
        ) : null}
      </div>

      {editing && contracts ? (
        <div className="mt-3 space-y-3 border-t border-rule pt-3">
          <p className="text-[0.75rem] leading-relaxed text-ink-muted">
            Optional and editable while the request is open. It is displayed as your words, not
            verified, and it cannot change where the money goes. Nothing here should identify the
            student.
          </p>
          <TextField
            label="Pseudonym"
            value={pseudonym}
            onChange={setPseudonym}
            disabled={tx.isBusy}
          />
          <TextArea
            label="Statement"
            value={statement}
            onChange={setStatement}
            rows={3}
            disabled={tx.isBusy}
          />
          <button
            type="button"
            disabled={tx.isBusy}
            onClick={async () => {
              const receipt = await tx.run({
                address: contracts.vault,
                abi: educationFundingVaultAbi,
                functionName: "setContext",
                args: [view.requestId, pseudonym.trim(), statement.trim()],
                label: "Student context",
                success: "Updated on the public request page.",
              });
              if (receipt) setEditing(false);
            }}
            className="btn btn-primary btn-sm"
          >
            {tx.isBusy ? <SpinnerIcon size={13} /> : null}
            Save context
          </button>
          {tx.error ? (
            <p role="alert" className="text-[0.8125rem] leading-relaxed text-fault">
              {tx.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
