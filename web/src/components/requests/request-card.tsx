"use client";

import Link from "next/link";
import { StatusChip } from "@/components/ui/chip";
import { FundingMeter } from "@/components/ui/funding-meter";
import { SealIcon, SealBrokenIcon, ChevronRightIcon, ExternalIcon } from "@/components/ui/icons";
import { describeDeadline, formatAmountCompact, shortAddress, shortHash } from "@/lib/format";
import { deriveRequestState, type RequestView } from "@/lib/request";
import { safeHref } from "@/lib/uri";
import type { SchoolIdentity } from "@/hooks/use-edgrant";
import { useNow } from "@/hooks/use-now";

/**
 * A fee request, as it appears in a list.
 *
 * What it leads with is chosen deliberately: the institution's REGISTERED name, a
 * verified registry fact, with the seal beside it. The student's optional pseudonym and
 * statement come last, inside a dashed rule, captioned as the school's own words.
 *
 * What it deliberately lacks: a countdown, a "3 days left!" badge in a warning colour, a
 * gradient thermometer, or any copy urging speed. The closing date is a date.
 */
export function RequestCard({
  view,
  identity,
  showSchool = true,
}: {
  view: RequestView;
  identity?: SchoolIdentity;
  showSchool?: boolean;
}) {
  const now = useNow();
  const schoolVerified = identity?.verified ?? false;
  const state = deriveRequestState(view.request, {
    schoolVerified,
    nowSeconds: now,
    chainRefundable: view.refundable,
  });
  const { request, context } = view;
  const pseudonym = context.pseudonym.trim();
  const statement = context.statement.trim();
  const proofHref = safeHref(identity?.proofURI);
  const href = `/requests/${view.requestId.toString()}`;

  return (
    <article className="card group relative flex flex-col p-4 transition-colors hover:border-rule-strong sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showSchool ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className={`shrink-0 ${schoolVerified ? "text-evidence" : "text-fault"}`}>
                {schoolVerified ? <SealIcon size={14} /> : <SealBrokenIcon size={14} />}
              </span>
              <Link
                href={`/schools/${request.school}`}
                className="relative z-10 truncate text-[0.875rem] font-medium text-ink hover:underline"
                title={identity?.entityName || request.school}
              >
                {identity?.entityName || shortAddress(request.school, 6)}
              </Link>
            </div>
          ) : null}
          <p className="mt-1 font-mono text-[0.6875rem] tracking-wide text-ink-faint">
            #{view.requestId.toString()} · REF {shortHash(request.studentRef, 4)}
          </p>
        </div>
        <StatusChip status={state.status} label={state.label} />
      </div>

      <div className="mt-4">
        <p className="tabular font-serif text-[1.375rem] leading-none font-semibold text-ink">
          {formatAmountCompact(request.goal)}
        </p>
        <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
          outstanding fee balance · {describeDeadline(request.deadline, now)}
        </p>
      </div>

      <div className="mt-4">
        <FundingMeter
          raised={request.raised}
          goal={request.goal}
          progress={state.progress}
          tone={state.status === "disbursed" ? "delivered" : "evidence"}
          compact
        />
      </div>

      {pseudonym || statement ? (
        <div className="mt-4 border-l-2 border-dashed border-rule-strong pl-3">
          <p className="text-[0.625rem] tracking-[0.09em] text-ink-faint uppercase">
            The school&apos;s note · not verified
          </p>
          {pseudonym ? (
            <p className="mt-1 text-[0.8125rem] font-medium text-ink-soft">{pseudonym}</p>
          ) : null}
          {statement ? (
            <p className="mt-0.5 line-clamp-2 font-serif text-[0.875rem] leading-relaxed text-ink-muted">
              {statement}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 border-l-2 border-dashed border-rule pl-3 text-[0.8125rem] leading-relaxed text-ink-faint">
          This student shared nothing publicly. The mechanism works exactly the same either
          way.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-rule pt-4">
        <span className="text-[0.8125rem] text-ink-muted">
          {state.status === "open" ? (
            <>
              <span className="tabular font-medium text-ink">
                {formatAmountCompact(state.remaining)}
              </span>{" "}
              still outstanding
            </>
          ) : state.status === "fully-funded" ? (
            "Ready to send to the school"
          ) : state.status === "disbursed" ? (
            "Paid to the school in full"
          ) : state.status === "closed-unmet" ? (
            "Contributors can withdraw"
          ) : (
            "Withdrawals open"
          )}
        </span>
        <div className="relative z-10 flex items-center gap-3">
          {proofHref ? (
            <a
              href={proofHref}
              target="_blank"
              rel="noreferrer noopener"
              className="link-evidence inline-flex items-center gap-1 text-[0.75rem]"
              title="Re-check this school's proof of control"
            >
              Proof
              <ExternalIcon size={10} />
            </a>
          ) : null}
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink group-hover:underline"
          >
            {state.status === "open" ? "Contribute" : "Details"}
            <ChevronRightIcon size={13} />
          </Link>
        </div>
      </div>

      {/* Whole-card tap target on touch devices, behind the real links above. */}
      <Link
        href={href}
        aria-label={`Open request ${view.requestId.toString()}`}
        className="absolute inset-0 z-0 rounded-md sm:hidden"
        tabIndex={-1}
      />
    </article>
  );
}
