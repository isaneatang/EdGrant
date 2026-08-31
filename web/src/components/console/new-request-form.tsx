"use client";

import { useMemo, useState } from "react";
import { parseEventLogs } from "viem";
import { educationFundingVaultAbi } from "@/lib/abi";
import { contractsFor, MAX_DURATION_SECONDS, MIN_DURATION_SECONDS, TOKEN_SYMBOL } from "@/lib/contracts";
import { formatAmount, formatDate, parseAmount, toDateInput, fromDateInput } from "@/lib/format";
import { checkDeadline, toStudentRef } from "@/lib/request";
import { useChainTime, useDeployment } from "@/hooks/use-edgrant";
import { useNow } from "@/hooks/use-now";
import { useTxRunner } from "@/hooks/use-tx";
import { ConsoleSection, TextArea, TextField } from "@/components/console/fields";
import { Callout } from "@/components/ui/callout";
import { CopyButton } from "@/components/ui/copy-button";
import { LockIcon, SpinnerIcon } from "@/components/ui/icons";

/**
 * Attesting a fee balance.
 *
 * The claim being recorded is narrow and the form says so: not "this student deserves help",
 * which nobody could verify, but "this school says this student owes this amount", made by
 * the party that is owed the money, from its own verified address.
 *
 * The student reference is hashed in the browser. What lands on-chain is a keccak commitment
 * to a school-internal identifier, never the identifier itself and never a name. The hash is
 * shown before signing so nothing about that is hidden.
 */
export function NewRequestForm({ school }: { school: `0x${string}` }) {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  // The vault compares the deadline against block.timestamp, so the bounds offered here are
  // derived from the chain's clock rather than this browser's.
  const chainNow = useChainTime();
  const browserNow = useNow();
  const now = chainNow || browserNow;
  const tx = useTxRunner();

  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [statement, setStatement] = useState("");

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);
  const deadlineCheck = useMemo(
    () => checkDeadline(fromDateInput(closeDate), now),
    [closeDate, now],
  );

  const studentRef = useMemo(
    () => (reference.trim().length > 0 ? toStudentRef(reference) : null),
    [reference],
  );

  // An hour of slack at each end, so a date sitting exactly on the boundary cannot be
  // rejected by the seconds that pass between choosing it and signing.
  const minDate = now > 0 ? toDateInput(now + MIN_DURATION_SECONDS + 3600) : undefined;
  const maxDate = now > 0 ? toDateInput(now + MAX_DURATION_SECONDS - 3600) : undefined;

  const amountError = amount.trim().length === 0 ? null : parsedAmount.ok ? null : parsedAmount.error;
  const dateError = closeDate.length === 0 ? null : deadlineCheck.ok ? null : deadlineCheck.error;

  const ready =
    reference.trim().length > 0 &&
    parsedAmount.ok &&
    deadlineCheck.ok &&
    studentRef !== null &&
    now > 0 &&
    !tx.isBusy;

  if (!contracts) return null;

  return (
    <ConsoleSection
      title="Attest a fee balance"
      description="Publishes an outstanding amount for contribution. Payout goes to this wallet and nowhere else."
    >
      <Callout tone="evidence" icon={<LockIcon size={15} />} className="mb-5">
        You are recording that this student owes your institution this amount. If the goal is
        met, the vault transfers it to <strong className="font-medium">this address</strong> —
        fixed now, with no function anywhere that can change it later. If it is not met by the
        closing date, each contributor withdraws their own money and you receive nothing. You
        cannot cancel a request once it exists, and neither can we.
      </Callout>

      <div className="space-y-4">
        <TextField
          label="Student reference (internal)"
          hint="Your own identifier — an enrolment or invoice number. It is hashed in your browser before it is sent, so the identifier itself never goes on-chain. Never enter a name."
          value={reference}
          onChange={setReference}
          placeholder="RCC-2026-0417"
          required
          disabled={tx.isBusy}
          mono
        />

        {studentRef ? (
          <div className="card-sunken px-3.5 py-2.5">
            <p className="eyebrow text-ink-faint">What will be stored on-chain</p>
            <div className="mt-1 flex items-center gap-1.5">
              <code className="min-w-0 flex-1 font-mono text-[0.75rem] break-all text-ink">
                {studentRef}
              </code>
              <CopyButton value={studentRef} label="Copy reference hash" />
            </div>
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-ink-muted">
              Keep your own note of which student this is. You can always re-derive this hash
              from the same reference, and the matcher below will find it for you.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={`Amount owed in ${TOKEN_SYMBOL}`}
            hint="Denominated in a stable unit because a fee debt is a fiat-denominated amount."
            value={amount}
            onChange={setAmount}
            placeholder="450.00"
            required
            error={amountError}
            disabled={tx.isBusy}
            inputMode="decimal"
            mono
          />

          <div>
            <label htmlFor="close-date" className="label-text">
              Closing date <span className="ml-1 text-fault">*</span>
            </label>
            <input
              id="close-date"
              type="date"
              value={closeDate}
              min={minDate}
              max={maxDate}
              onChange={(event) => setCloseDate(event.target.value)}
              disabled={tx.isBusy}
              aria-invalid={Boolean(dateError)}
              className={`field ${dateError ? "field-invalid" : ""}`}
            />
            {dateError ? (
              <p role="alert" className="mt-1.5 text-[0.75rem] text-fault">
                {dateError}
              </p>
            ) : (
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-muted">
                Between one day and one year out. Interpreted as 23:59 UTC on that day.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-rule pt-4">
          <p className="text-[0.8125rem] font-medium text-ink">
            Optional public context{" "}
            <span className="font-normal text-ink-muted">— entirely optional</span>
          </p>
          <p className="mt-1 mb-3 text-[0.75rem] leading-relaxed text-ink-muted">
            You write this on the student&apos;s behalf so they never need a wallet, gas, or an
            address on-chain. It is displayed as your words, not verified, and it cannot affect
            where the money goes. Do not include anything that identifies the student. The
            mechanism works fully with both fields empty.
          </p>
          <div className="space-y-4">
            <TextField
              label="Pseudonym"
              value={pseudonym}
              onChange={setPseudonym}
              placeholder="A.M."
              disabled={tx.isBusy}
            />
            <TextArea
              label="Statement"
              value={statement}
              onChange={setStatement}
              rows={3}
              placeholder="Final year. One semester of fees outstanding."
              disabled={tx.isBusy}
            />
          </div>
        </div>

        {parsedAmount.ok && deadlineCheck.ok ? (
          <dl className="card-sunken px-3.5 py-3 text-[0.875rem]">
            <div className="data-row">
              <dt className="text-ink-muted">Amount</dt>
              <dd className="tabular font-medium text-ink">{formatAmount(parsedAmount.value)}</dd>
            </div>
            <div className="data-row">
              <dt className="text-ink-muted">Closes</dt>
              <dd className="tabular text-ink">{formatDate(BigInt(deadlineCheck.timestamp))}</dd>
            </div>
            <div className="data-row border-b-0">
              <dt className="shrink-0 text-ink-muted">Pays out to</dt>
              <dd className="min-w-0 truncate font-mono text-[0.75rem] text-ink" title={school}>
                {school}
              </dd>
            </div>
          </dl>
        ) : null}

        <button
          type="button"
          disabled={!ready}
          onClick={async () => {
            if (!parsedAmount.ok || !deadlineCheck.ok || !studentRef) return;
            const receipt = await tx.run({
              address: contracts.vault,
              abi: educationFundingVaultAbi,
              functionName: "createRequest",
              args: [studentRef, parsedAmount.value, BigInt(deadlineCheck.timestamp)],
              label: "Fee attestation",
              success: `${formatAmount(parsedAmount.value)} is now open for contribution.`,
            });
            if (!receipt) return;

            // `createRequest` returns the new id, which a transaction cannot hand back to
            // the caller — so read it out of the event in our own receipt. This is not a
            // log *scan*: it is the receipt we already hold, so the mainnet eth_getLogs
            // restriction does not apply and there is no race with other writers.
            const newId = requestIdFromReceipt(receipt.logs, contracts.vault);

            if (newId !== null && (pseudonym.trim() || statement.trim())) {
              await tx.run({
                address: contracts.vault,
                abi: educationFundingVaultAbi,
                functionName: "setContext",
                args: [newId, pseudonym.trim(), statement.trim()],
                label: "Student context",
                success: "Attached to the request.",
              });
            }

            setReference("");
            setAmount("");
            setCloseDate("");
            setPseudonym("");
            setStatement("");
          }}
          className="btn btn-primary w-full"
        >
          {tx.isBusy ? <SpinnerIcon size={15} /> : null}
          {tx.stage === "signing"
            ? "Confirm in your wallet…"
            : tx.stage === "mining"
              ? "Publishing…"
              : "Publish this fee balance"}
        </button>

        {pseudonym.trim() || statement.trim() ? (
          <p className="text-[0.75rem] leading-relaxed text-ink-muted">
            This will take two signatures: one to attest the balance, one to attach the context.
            The vault returns the new request id from the first call, so the second cannot be
            folded into it.
          </p>
        ) : null}

        {tx.error ? (
          <p role="alert" className="text-[0.8125rem] leading-relaxed text-fault">
            {tx.error}
          </p>
        ) : null}
      </div>
    </ConsoleSection>
  );
}

/** Pulls the new request id out of the `RequestCreated` event in our own receipt. */
function requestIdFromReceipt(
  logs: readonly { address: string }[],
  vault: `0x${string}`,
): bigint | null {
  try {
    const parsed = parseEventLogs({
      abi: educationFundingVaultAbi,
      eventName: "RequestCreated",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logs: logs as any,
    });
    const mine = parsed.find(
      (entry) => entry.address.toLowerCase() === vault.toLowerCase(),
    );
    return mine ? (mine.args.requestId as bigint) : null;
  } catch {
    return null;
  }
}
