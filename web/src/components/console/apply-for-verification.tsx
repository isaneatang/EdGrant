"use client";

import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { verifiedEntityRegistryAbi } from "@/lib/abi";
import { contractsFor } from "@/lib/contracts";
import { byteLength, formatDateTime } from "@/lib/format";
import { applicationStatusLabel, entityTypeLabel } from "@/lib/request";
import { classifyUri } from "@/lib/uri";
import {
  useApplications,
  useDeployment,
  useVerificationFee,
} from "@/hooks/use-edgrant";
import { useTxRunner } from "@/hooks/use-tx";
import { ConsoleSection, SelectField, TextField } from "@/components/console/fields";
import { Callout } from "@/components/ui/callout";
import { Chip } from "@/components/ui/chip";
import { SealIcon, SpinnerIcon } from "@/components/ui/icons";

/**
 * Applying to be verified.
 *
 * The form's job is to make clear that verification is proof-of-control and nothing else.
 * A verifier does not assess whether the institution seems reputable; they open the proof URI
 * and check whether this exact wallet address is published there. So the proof field is the
 * primary field, it is validated for reachability as a link, and the copy tells the applicant
 * exactly what to publish before they apply.
 *
 * What this screen deliberately does NOT show: how many verifiers exist, how many
 * confirmations a decision needs, or how far along one is. An applicant does not need it, and
 * publishing the exact threshold tells anyone attempting impersonation precisely how many
 * keys they would have to compromise. Applicants are told a verifier will be in contact.
 */
export function ApplyForVerification({ applicant }: { applicant: `0x${string}` }) {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const { data: fee } = useVerificationFee();
  const { applications } = useApplications();
  const tx = useTxRunner();

  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("1");
  const [proofURI, setProofURI] = useState("");

  const mine = useMemo(
    () => applications.filter((app) => app.applicant.toLowerCase() === applicant.toLowerCase()),
    [applications, applicant],
  );
  const pending = mine.find((app) => app.status === 1);

  const proof = classifyUri(proofURI);
  const nameError =
    name.trim().length === 0 ? null : byteLength(name) > 256 ? "That name is very long." : null;
  const proofError =
    proofURI.trim().length === 0
      ? null
      : proof.kind === "unsafe"
        ? `${proof.reason}. A donor has to be able to open this.`
        : null;

  const ready =
    name.trim().length > 0 &&
    proofURI.trim().length > 0 &&
    !nameError &&
    !proofError &&
    fee !== undefined;

  if (!contracts) return null;

  return (
    <div className="space-y-6">
      <Callout tone="evidence" icon={<SealIcon size={15} />} title="Before you apply">
        Publish a post on your official website or social media account stating that your
        institution has adopted EdGrant, and include{" "}
        <strong className="font-medium">the wallet address shown below</strong> in that post.
        Then link to it here.
        <br />
        <br />
        A verifier will open that link and confirm the address matches. They do not assess
        whether your institution is reputable. The only question is whether this wallet really
        belongs to you, which is what lets a donor check your badge without trusting us.
      </Callout>

      {pending ? (
        <ConsoleSection
          title="Your application is pending"
          description="It is visible to verifiers now."
        >
          <dl className="text-[0.875rem]">
            <div className="data-row">
              <dt className="text-ink-muted">Application</dt>
              <dd className="tabular font-mono text-ink">#{pending.id.toString()}</dd>
            </div>
            <div className="data-row">
              <dt className="text-ink-muted">Claimed name</dt>
              <dd className="text-right text-ink">{pending.name}</dd>
            </div>
            <div className="data-row border-b-0">
              <dt className="text-ink-muted">Submitted</dt>
              <dd className="tabular text-ink">{formatDateTime(pending.submittedAt)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
            {pending.confirmations === 0n
              ? "A verifier will be in contact once they have reviewed your proof link. Review has not started yet, so you can still withdraw this application and reclaim the fee."
              : "Review has started, so this application can no longer be withdrawn and the fee is now spent. A verifier will be in contact."}
          </p>

          {pending.confirmations === 0n ? (
            <button
              type="button"
              disabled={tx.isBusy}
              onClick={() =>
                tx.run({
                  address: contracts.registry,
                  abi: verifiedEntityRegistryAbi,
                  functionName: "withdrawRequest",
                  args: [pending.id],
                  label: "Withdrawal",
                  success: "The application was withdrawn and the fee returned.",
                })
              }
              className="btn btn-secondary btn-sm mt-4"
            >
              {tx.isBusy ? <SpinnerIcon size={13} /> : null}
              Withdraw the application and reclaim the fee
            </button>
          ) : null}
        </ConsoleSection>
      ) : null}

      {mine.some((app) => app.status === 3) ? (
        <Callout tone="fault" title="A previous application was rejected">
          The fee for a rejected application is consumed. Before re-applying, make sure the proof
          page states this exact wallet address in a form anyone can read.
        </Callout>
      ) : null}

      {!pending ? (
        <ConsoleSection
          title="Apply for verification"
          description="One wallet, one institution, one publicly re-checkable proof."
        >
          <div className="space-y-4">
            <TextField
              label="Publicly known name"
              hint="Exactly as it appears in your proof. A donor comparing the two should see no discrepancy."
              value={name}
              onChange={setName}
              placeholder="Riverside Community College"
              required
              error={nameError}
              disabled={tx.isBusy}
            />

            <SelectField
              label="Entity type"
              value={entityType}
              onChange={setEntityType}
              options={[1, 2, 3, 4, 5, 6].map((v) => ({
                value: String(v),
                label: entityTypeLabel(v),
              }))}
              disabled={tx.isBusy}
            />

            <TextField
              label="Public proof of control"
              hint="A page you control that states this wallet address: your own domain, a press release, your verified social account. This link is stored on-chain and every badge links to it."
              value={proofURI}
              onChange={setProofURI}
              placeholder="https://your-institution.edu/notices/edgrant-wallet"
              required
              error={proofError}
              disabled={tx.isBusy}
              inputMode="url"
              mono
            />

            <div className="card-sunken px-3.5 py-3">
              <p className="eyebrow text-ink-faint">The address that must appear on that page</p>
              <code className="mt-1 block font-mono text-[0.8125rem] break-all text-ink">
                {applicant}
              </code>
            </div>

            <dl className="text-[0.875rem]">
              <div className="data-row border-b-0">
                <dt className="text-ink-muted">Application fee</dt>
                <dd className="tabular text-ink">
                  {fee === undefined ? "-" : `${formatEther(fee)} native`}
                </dd>
              </div>

            </dl>

            <p className="text-[0.75rem] leading-relaxed text-ink-muted">
              The fee makes impersonation cost something. You can withdraw your application and
              reclaim it any time before review starts. Once review has started the fee is
              spent, whatever the outcome.
            </p>

            <button
              type="button"
              disabled={!ready || tx.isBusy}
              onClick={() =>
                tx.run({
                  address: contracts.registry,
                  abi: verifiedEntityRegistryAbi,
                  functionName: "requestVerification",
                  args: [name.trim(), Number(entityType), proofURI.trim()],
                  value: fee,
                  label: "Application",
                  success: "Application submitted. A verifier will be in contact.",
                })
              }
              className="btn btn-primary w-full"
            >
              {tx.isBusy ? <SpinnerIcon size={15} /> : null}
              {tx.stage === "signing"
                ? "Confirm in your wallet…"
                : tx.stage === "mining"
                  ? "Submitting…"
                  : "Submit application"}
            </button>

            {tx.error ? (
              <p role="alert" className="text-[0.8125rem] leading-relaxed text-fault">
                {tx.error}
              </p>
            ) : null}
          </div>
        </ConsoleSection>
      ) : null}

      {mine.length > 0 ? (
        <ConsoleSection title="Your application history">
          <ul className="space-y-2">
            {mine.map((app) => (
              <li
                key={app.id.toString()}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2 text-[0.8125rem] last:border-b-0 last:pb-0"
              >
                <span className="font-mono text-[0.75rem] text-ink-muted">
                  #{app.id.toString()}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{app.name}</span>
                <Chip
                  tone={
                    app.status === 2
                      ? "delivered"
                      : app.status === 3
                        ? "fault"
                        : app.status === 1
                          ? "evidence"
                          : "neutral"
                  }
                >
                  {applicationStatusLabel(app.status)}
                </Chip>
              </li>
            ))}
          </ul>
        </ConsoleSection>
      ) : null}
    </div>
  );
}
