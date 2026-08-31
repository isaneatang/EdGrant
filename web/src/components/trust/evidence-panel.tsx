import { AddressDisplay } from "@/components/ui/address-display";
import { ExternalIcon, SealIcon, SealBrokenIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { entityTypeLabel } from "@/lib/request";
import { classifyUri } from "@/lib/uri";

/**
 * VERIFIED FACTS. Everything in this panel comes from VerifiedEntityRegistry, which is
 * the only place in the system where anything has been checked by anyone.
 *
 * Rendered with authority: solid rule, seal, full contrast, structured like a record.
 * precisely so that the self-asserted panel next to it can be rendered without it.
 * Profile content is marketing. The badge is evidence. They must never look alike, or
 * an impersonator's page looks exactly like a real one.
 */
export function EvidencePanel({
  school,
  verified,
  entityName,
  entityType,
  proofURI,
  verifiedAt,
}: {
  school: string;
  verified: boolean;
  entityName: string;
  entityType: number;
  proofURI: string;
  verifiedAt: bigint;
}) {
  const proof = classifyUri(proofURI);
  const linkable = proof.kind === "http" || proof.kind === "ipfs";

  return (
    <section
      className={`evidence-panel overflow-hidden ${verified ? "" : "border-l-fault border-fault-rule"}`}
      aria-labelledby="evidence-heading"
    >
      <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5 sm:px-5">
        <span className={verified ? "text-evidence" : "text-fault"}>
          {verified ? <SealIcon size={15} /> : <SealBrokenIcon size={15} />}
        </span>
        <h2 id="evidence-heading" className="eyebrow font-sans! text-ink">
          {verified ? "Verified, and re-checkable by you" : "Verification withdrawn"}
        </h2>
      </header>

      <dl className="px-4 py-1 sm:px-5">
        <div className="data-row">
          <dt className="shrink-0 text-ink-muted">Registered name</dt>
          <dd className="text-right font-medium text-ink">{entityName || "-"}</dd>
        </div>
        <div className="data-row">
          <dt className="shrink-0 text-ink-muted">Entity type</dt>
          <dd className="text-right text-ink">{entityTypeLabel(entityType)}</dd>
        </div>
        <div className="data-row">
          <dt className="shrink-0 text-ink-muted">
            {verified ? "Verified on" : "Was verified on"}
          </dt>
          <dd className="tabular text-right text-ink">{formatDate(verifiedAt)}</dd>
        </div>
        <div className="data-row border-b-0">
          <dt className="shrink-0 text-ink-muted">Wallet bound to that name</dt>
          <dd className="min-w-0">
            <AddressDisplay address={school} truncate={false} className="justify-end" />
          </dd>
        </div>
      </dl>

      <div className="border-t border-rule bg-surface-sunken px-4 py-3.5 sm:px-5">
        <p className="eyebrow text-ink-muted">Public proof of control</p>
        {linkable ? (
          <>
            <a
              href={proof.href}
              target="_blank"
              rel="noreferrer noopener"
              className="link-evidence mt-1.5 inline-flex items-baseline gap-1.5 text-sm break-all"
            >
              {proof.display}
              <ExternalIcon size={12} className="shrink-0 translate-y-0.5" />
            </a>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
              Verification is proof-of-control, not a judgement about this institution. It
              means the institution published this exact wallet address at{" "}
              <span className="font-medium text-ink-soft">{proof.host}</span>. Open it and
              confirm the address matches. You do not have to take our word for it.
            </p>
            {/* An explicit affordance, not just a linkified URL. The whole trust model
                rests on a reader being able to check this, so it gets a button. */}
            <a
              href={proof.href}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-evidence btn-sm mt-3"
            >
              <SealIcon size={13} />
              Re-check the proof yourself
              <ExternalIcon size={12} />
            </a>
          </>
        ) : (
          <>
            <p className="mt-1.5 font-mono text-[0.8125rem] break-all text-ink-soft">
              {proofURI || "-"}
            </p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-notice">
              This proof reference is not a link we will open for you
              {proof.kind === "unsafe" ? ` (${proof.reason.toLowerCase()})` : ""}. Treat the
              verification as unconfirmable until you can read the proof yourself.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
