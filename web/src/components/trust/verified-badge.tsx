import { classifyUri } from "@/lib/uri";
import { ExternalIcon, SealIcon, SealBrokenIcon } from "@/components/ui/icons";

/**
 * THE BADGE. The only element in this interface that carries authority.
 *
 * It is not a decoration and it never appears without its proof. Verification here
 * means one narrow, objective thing: the institution published this wallet address
 * somewhere the public already trusts, and that location is recorded on-chain. So the
 * badge links straight to it. A sceptical donor re-checks the claim themselves in one
 * click instead of trusting that a verifier did their job.
 *
 * If the proof URI is not a safe http(s)/ipfs link, that is itself a finding, and the
 * badge says so rather than quietly dropping the link.
 */
export function VerifiedBadge({
  verified,
  entityName,
  proofURI,
  size = "md",
}: {
  verified: boolean;
  entityName: string;
  proofURI: string;
  size?: "sm" | "md";
}) {
  const proof = classifyUri(proofURI);
  const linkable = proof.kind === "http" || proof.kind === "ipfs";

  if (!verified) {
    return (
      <div className="chip chip-fault">
        <SealBrokenIcon size={13} />
        <span>Verification withdrawn</span>
      </div>
    );
  }

  const pad = size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5";

  return (
    <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm border border-evidence-rule bg-evidence-soft font-medium text-evidence ${pad} ${size === "sm" ? "text-xs" : "text-[0.8125rem]"}`}
      >
        <SealIcon size={size === "sm" ? 13 : 15} />
        Verified institution
      </span>
      {linkable ? (
        <a
          href={proof.href}
          target="_blank"
          rel="noreferrer noopener"
          className="link-evidence inline-flex items-center gap-1 text-[0.8125rem]"
          title={`Re-check the proof of control for ${entityName || "this institution"}`}
        >
          Re-check the proof
          <ExternalIcon size={12} />
        </a>
      ) : (
        <span className="chip chip-notice" title={proof.kind === "unsafe" ? proof.reason : undefined}>
          Proof link cannot be opened safely
        </span>
      )}
    </div>
  );
}
