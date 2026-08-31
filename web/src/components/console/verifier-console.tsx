"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { formatEther, isAddress, getAddress } from "viem";
import { verifiedEntityRegistryAbi } from "@/lib/abi";
import { contractsFor } from "@/lib/contracts";
import { formatDateTime, shortAddress } from "@/lib/format";
import { applicationStatusLabel, entityTypeLabel } from "@/lib/request";
import { classifyUri } from "@/lib/uri";
import {
  useApplications,
  useDeployment,
  useDirectory,
  useRegistryGovernance,
  type Application,
} from "@/hooks/use-edgrant";
import { useTxRunner } from "@/hooks/use-tx";
import { ConsoleSection, TextArea, TextField } from "@/components/console/fields";
import { AddressDisplay } from "@/components/ui/address-display";
import { Callout, EmptyState, ErrorState } from "@/components/ui/callout";
import { Chip } from "@/components/ui/chip";
import { WalletButton } from "@/components/shell/wallet-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckIcon,
  ExternalIcon,
  SealIcon,
  SealBrokenIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

/**
 * The verifier console.
 *
 * The design job here is to keep a verifier inside the narrow question they are actually
 * authorised to answer: does the proof page state this exact address? Everything the console
 * shows serves that comparison — the claimed name beside the proof host, the applicant address
 * in full and copyable, and the proof as a link that opens in a new tab.
 *
 * What it deliberately does not offer is any field for a subjective note about whether the
 * institution seems legitimate. That is not what verification is, and a UI that invited it
 * would quietly turn proof-of-control into editorial review.
 *
 * Applications are enumerated through `requestCount` + `getRequest`, never by scanning
 * events. A verifier console that cannot list pending work on mainnet is useless exactly
 * when it matters.
 */
export function VerifierConsole() {
  const { address, isConnected } = useAccount();
  const { ready } = useDeployment();
  const { iAmVerifier, threshold, verifierCount, verifiers, isLoading } = useRegistryGovernance();
  const { applications, isLoading: appsLoading, error } = useApplications();
  const [showAll, setShowAll] = useState(false);

  const pending = useMemo(() => applications.filter((a) => a.status === 1), [applications]);
  const decided = useMemo(() => applications.filter((a) => a.status !== 1), [applications]);

  if (!isConnected || !address) {
    return (
      <EmptyState title="Connect a verifier wallet" icon={<SealIcon size={28} />}>
        The registry decides who is a verifier. There is no separate login, and no way for this
        interface to grant the role — it only reflects what the contract already says.
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

  if (isLoading || appsLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) return <ErrorState message={error.message} />;

  return (
    <div className="space-y-6">
      <div
        className={`card px-4 py-4 sm:px-5 ${iAmVerifier ? "border-evidence-rule" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-ink-faint">Connected as</p>
            <div className="mt-1.5">
              <AddressDisplay address={address} variant="block" truncate={false} />
            </div>
          </div>
          <Chip tone={iAmVerifier ? "evidence" : "neutral"} icon={<SealIcon size={12} />}>
            {iAmVerifier ? "Verifier" : "Not a verifier"}
          </Chip>
        </div>

        <dl className="mt-4 text-[0.875rem]">
          <div className="data-row">
            <dt className="text-ink-muted">Confirmations required</dt>
            <dd className="tabular font-medium text-ink">
              {threshold?.toString() ?? "—"} of {verifierCount?.toString() ?? "—"}
            </dd>
          </div>
          <div className="data-row border-b-0">
            <dt className="text-ink-muted">Verifier set</dt>
            <dd className="flex flex-wrap justify-end gap-1.5">
              {verifiers.map((v) => (
                <code
                  key={v}
                  title={v}
                  className={`rounded-xs border px-1.5 py-0.5 font-mono text-[0.6875rem] ${
                    v.toLowerCase() === address.toLowerCase()
                      ? "border-evidence-rule bg-evidence-soft text-evidence"
                      : "border-rule bg-surface-sunken text-ink-muted"
                  }`}
                >
                  {shortAddress(v, 4)}
                </code>
              ))}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-muted">
          There is no owner and no admin. Every privileged action — approving, rejecting,
          revoking, and changing the verifier set itself — needs the same threshold of distinct
          verifiers. An owner able to swap verifiers could install itself as the only one, which
          would be a backdoor around the exact property this registry exists to provide.
        </p>
      </div>

      {!iAmVerifier ? (
        <Callout tone="notice" title="This wallet cannot confirm anything">
          You can read every application below — the queue is public, which is part of the point
          — but the registry will reject any confirmation from a non-verifier.
        </Callout>
      ) : (
        <Callout tone="evidence" icon={<SealIcon size={15} />} title="The only question you are answering">
          Does the proof page state this exact wallet address, on a channel the public already
          associates with that institution? Not whether the school seems reputable, not whether
          the request seems reasonable. Proof-of-control, and nothing wider.
        </Callout>
      )}

      <ConsoleSection
        title={`Pending applications (${pending.length})`}
        description="Awaiting confirmations. Newest first."
      >
        {pending.length === 0 ? (
          <p className="text-[0.875rem] text-ink-muted">Nothing is waiting for review.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((app) => (
              <ApplicationRow key={app.id.toString()} app={app} canAct={iAmVerifier} />
            ))}
          </ul>
        )}
      </ConsoleSection>

      {iAmVerifier ? <RevokePanel /> : null}

      <ConsoleSection
        title={`Decided applications (${decided.length})`}
        action={
          decided.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="btn btn-ghost btn-sm"
            >
              {showAll ? "Hide" : "Show"}
            </button>
          ) : undefined
        }
      >
        {decided.length === 0 ? (
          <p className="text-[0.875rem] text-ink-muted">No decisions yet.</p>
        ) : showAll ? (
          <ul className="space-y-2">
            {decided.map((app) => (
              <li
                key={app.id.toString()}
                className="flex flex-wrap items-center gap-2 border-b border-rule pb-2 text-[0.8125rem] last:border-b-0 last:pb-0"
              >
                <span className="font-mono text-[0.75rem] text-ink-faint">
                  #{app.id.toString()}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{app.name}</span>
                <code className="font-mono text-[0.6875rem] text-ink-muted">
                  {shortAddress(app.applicant, 4)}
                </code>
                <Chip
                  tone={app.status === 2 ? "delivered" : app.status === 3 ? "fault" : "neutral"}
                >
                  {applicationStatusLabel(app.status)}
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.875rem] text-ink-muted">
            {decided.length} decided. The full record stays public permanently.
          </p>
        )}
      </ConsoleSection>
    </div>
  );
}

function ApplicationRow({ app, canAct }: { app: Application; canAct: boolean }) {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const approveTx = useTxRunner();
  const rejectTx = useTxRunner();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const proof = classifyUri(app.proofURI);
  const linkable = proof.kind === "http" || proof.kind === "ipfs";
  const remaining = app.required > app.confirmations ? app.required - app.confirmations : 0n;
  const lastSignature = canAct && !app.iConfirmed && remaining === 1n;

  if (!contracts) return null;

  return (
    <li className="rounded-md border border-rule bg-surface p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.6875rem] tracking-wide text-ink-faint">
            APPLICATION #{app.id.toString()}
          </p>
          <p className="mt-1 font-serif text-[1.125rem] leading-snug font-semibold text-ink">
            {app.name}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-ink-muted">
            claims to be a {entityTypeLabel(app.entityType).toLowerCase()} · submitted{" "}
            {formatDateTime(app.submittedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Chip tone={app.confirmations > 0n ? "evidence" : "neutral"}>
            {app.confirmations.toString()} of {app.required.toString()} confirmed
          </Chip>
          {app.iConfirmed ? (
            <Chip tone="delivered" icon={<CheckIcon size={11} />}>
              You confirmed
            </Chip>
          ) : null}
        </div>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="eyebrow text-ink-faint">Address claiming that name</p>
          <div className="mt-1.5">
            <AddressDisplay address={app.applicant} variant="block" truncate={false} />
          </div>
        </div>
        <div>
          <p className="eyebrow text-ink-faint">Proof of control</p>
          {linkable ? (
            <>
              <a
                href={proof.href}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className="link-evidence mt-1.5 inline-flex items-baseline gap-1 text-[0.8125rem] break-all"
              >
                {proof.display}
                <ExternalIcon size={11} className="shrink-0 translate-y-0.5" />
              </a>
              <p className="mt-1 text-[0.6875rem] text-ink-muted">
                Host: <span className="font-medium text-ink-soft">{proof.host}</span>. Does this
                host plausibly belong to “{app.name}”, and does the page state the address on the
                left?
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-notice">
              Not an openable link{proof.kind === "unsafe" ? ` — ${proof.reason.toLowerCase()}` : ""}.
              A proof a donor cannot open is not a proof. Reject it.
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-[0.75rem] text-ink-muted">
        Fee paid: {formatEther(app.feePaid)} native.{" "}
        {app.confirmations === 0n
          ? "Nobody has confirmed yet, so the applicant can still withdraw and reclaim it."
          : "Already confirmed by someone, so the fee is consumed either way."}
      </p>

      {canAct ? (
        <div className="mt-3.5 border-t border-rule pt-3.5">
          {lastSignature ? (
            <p className="mb-2.5 text-[0.75rem] leading-relaxed text-evidence">
              Yours is the last signature required. Confirming will verify this address
              immediately, and it will be able to attest fee balances from that moment.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={approveTx.isBusy || app.iConfirmed}
              onClick={() =>
                approveTx.run({
                  address: contracts.registry,
                  abi: verifiedEntityRegistryAbi,
                  functionName: "approveRequest",
                  args: [app.id],
                  label: "Confirmation",
                  success: lastSignature
                    ? `${app.name} is now verified and can attest fee balances.`
                    : `Recorded. ${(remaining - 1n).toString()} more confirmation(s) needed.`,
                })
              }
              className="btn btn-evidence btn-sm"
            >
              {approveTx.isBusy ? <SpinnerIcon size={13} /> : <SealIcon size={13} />}
              {app.iConfirmed
                ? "Already confirmed by you"
                : lastSignature
                  ? "Confirm and verify"
                  : "Confirm the proof"}
            </button>

            <button
              type="button"
              onClick={() => setRejecting((v) => !v)}
              className="btn btn-secondary btn-sm"
            >
              {rejecting ? "Cancel" : "Reject"}
            </button>
          </div>

          {rejecting ? (
            <div className="mt-3 space-y-2.5">
              <TextArea
                label="Reason (recorded on-chain)"
                hint="Stated publicly and permanently. Describe what failed the proof check, not an opinion about the institution."
                value={reason}
                onChange={setReason}
                rows={2}
                disabled={rejectTx.isBusy}
                placeholder="Proof page does not state this address."
              />
              <button
                type="button"
                disabled={rejectTx.isBusy || reason.trim().length === 0}
                onClick={async () => {
                  const receipt = await rejectTx.run({
                    address: contracts.registry,
                    abi: verifiedEntityRegistryAbi,
                    functionName: "rejectRequest",
                    args: [app.id, reason.trim()],
                    label: "Rejection",
                    success: "Recorded. The fee is consumed.",
                  });
                  if (receipt) setRejecting(false);
                }}
                className="btn btn-primary btn-sm"
              >
                {rejectTx.isBusy ? <SpinnerIcon size={13} /> : null}
                Confirm rejection
              </button>
            </div>
          ) : null}

          {approveTx.error ? (
            <p role="alert" className="mt-2.5 text-[0.8125rem] leading-relaxed text-fault">
              {approveTx.error}
            </p>
          ) : null}
          {rejectTx.error ? (
            <p role="alert" className="mt-2.5 text-[0.8125rem] leading-relaxed text-fault">
              {rejectTx.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Revocation.
 *
 * First-class rather than an afterthought: a verification system with no revocation path is
 * one bad approval away from being permanently wrong. The panel states what revocation can
 * and cannot do, because the containment is the reason it is safe to have at all.
 */
function RevokePanel() {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const { items } = useDirectory();
  const tx = useTxRunner();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");

  const normalised = useMemo(() => {
    const value = target.trim();
    return isAddress(value) ? getAddress(value) : null;
  }, [target]);

  const known = useMemo(
    () => items.find((item) => item.school.toLowerCase() === normalised?.toLowerCase()),
    [items, normalised],
  );

  const addressError =
    target.trim().length === 0 ? null : normalised ? null : "Not a valid address.";

  if (!contracts) return null;

  return (
    <ConsoleSection
      title="Revoke a verification"
      description="Requires the same threshold of confirmations as granting one."
    >
      <Callout tone="notice" className="mb-4" title="What revocation can and cannot do">
        It can stop a school being paid, and it opens immediate withdrawals for everyone who
        contributed to that school&apos;s open requests. It cannot redirect a single unit of
        value to anyone else — `request.school` is set once at creation and no setter exists
        anywhere in the vault. Revocation only ever fails in the safe direction: money returns
        to the people who sent it.
      </Callout>

      <div className="space-y-4">
        <TextField
          label="Address to revoke"
          value={target}
          onChange={setTarget}
          placeholder="0x…"
          error={addressError}
          disabled={tx.isBusy}
          mono
        />

        {normalised ? (
          known ? (
            <div className="rounded-sm border border-evidence-rule bg-evidence-soft px-3 py-2.5 text-[0.8125rem] text-evidence">
              <p className="font-medium">{known.entityName}</p>
              <p className="mt-0.5 opacity-90">
                Verified {entityTypeLabel(known.entityType)}. Currently holds{" "}
                {known.stats.totalHeld.toString() === "0" ? "no" : "some"} contributions across{" "}
                {known.stats.openRequests.toString()} open request(s).
              </p>
            </div>
          ) : (
            <p className="rounded-sm border border-rule bg-surface-sunken px-3 py-2.5 text-[0.8125rem] text-ink-muted">
              That address is not in the current verified directory. Revocation will revert if it
              is not an active verified entity.
            </p>
          )
        ) : null}

        <TextArea
          label="Reason (recorded on-chain)"
          hint="Permanent and public. This is the record a donor will read when they ask what happened."
          value={reason}
          onChange={setReason}
          rows={2}
          disabled={tx.isBusy}
          placeholder="Proof page removed; institution disputes control of this address."
        />

        <button
          type="button"
          disabled={tx.isBusy || !normalised || reason.trim().length === 0}
          onClick={() =>
            tx.run({
              address: contracts.registry,
              abi: verifiedEntityRegistryAbi,
              functionName: "revokeVerification",
              args: [normalised!, reason.trim()],
              label: "Revocation",
              success:
                "Recorded. Once the threshold is reached the badge is withdrawn and contributors to that school's open requests can withdraw immediately.",
            })
          }
          className="btn btn-secondary btn-sm border-fault-rule text-fault"
        >
          {tx.isBusy ? <SpinnerIcon size={13} /> : <SealBrokenIcon size={13} />}
          Confirm revocation
        </button>

        {tx.error ? (
          <p role="alert" className="text-[0.8125rem] leading-relaxed text-fault">
            {tx.error}
          </p>
        ) : null}
      </div>
    </ConsoleSection>
  );
}
