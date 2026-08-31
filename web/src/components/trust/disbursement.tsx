import { AddressDisplay } from "@/components/ui/address-display";
import { ArrowRightIcon, LockIcon, SealIcon } from "@/components/ui/icons";
import { formatAmount, formatDate } from "@/lib/format";

/**
 * WHERE THE MONEY GOES. Shown on the contribution screen, above the fold, before the
 * donor signs anything, never buried in terms.
 *
 * The single structural claim of this product is that the money cannot route through
 * the student, so the interface states the destination as an address the donor can read
 * and check, and names the party who is deliberately absent from the path.
 */
export function DisbursementNotice({
  destination,
  entityName,
  verified,
}: {
  destination: string;
  entityName: string;
  verified: boolean;
}) {
  return (
    <section className="evidence-panel overflow-hidden" aria-labelledby="destination-heading">
      <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5 sm:px-5">
        <span className="text-evidence">
          <LockIcon size={15} />
        </span>
        <h2 id="destination-heading" className="eyebrow font-sans! text-ink">
          Where this money goes
        </h2>
      </header>

      <div className="px-4 py-4 sm:px-5">
        {/* The path, stated as a path. Vertical on phones, horizontal from sm up. */}
        <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
          <li className="flex-1 rounded-sm border border-rule bg-surface-sunken px-3 py-2.5">
            <p className="eyebrow text-ink-faint">Step 1</p>
            <p className="mt-0.5 text-sm font-medium text-ink">You</p>
            <p className="text-xs text-ink-muted">Approve, then contribute</p>
          </li>
          <li
            className="flex items-center justify-center px-1 text-ink-faint sm:px-2"
            aria-hidden
          >
            <ArrowRightIcon size={16} className="rotate-90 sm:rotate-0" />
          </li>
          <li className="flex-1 rounded-sm border border-rule bg-surface-sunken px-3 py-2.5">
            <p className="eyebrow text-ink-faint">Step 2</p>
            <p className="mt-0.5 text-sm font-medium text-ink">The vault contract</p>
            <p className="text-xs text-ink-muted">Holds it. Cannot spend it elsewhere.</p>
          </li>
          <li
            className="flex items-center justify-center px-1 text-ink-faint sm:px-2"
            aria-hidden
          >
            <ArrowRightIcon size={16} className="rotate-90 sm:rotate-0" />
          </li>
          <li className="flex-1 rounded-sm border border-evidence-rule bg-evidence-soft px-3 py-2.5">
            <p className="eyebrow text-evidence">Step 3</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-evidence">
              {verified ? <SealIcon size={13} /> : null}
              The school
            </p>
            <p className="text-xs text-evidence/80">Only if the goal is met</p>
          </li>
        </ol>

        <div className="mt-4">
          <p className="eyebrow text-ink-muted">Disbursement destination</p>
          <p className="mt-1 text-sm text-ink">
            {entityName ? <span className="font-medium">{entityName}</span> : "This institution"}
          </p>
          <div className="mt-2">
            <AddressDisplay address={destination} truncate={false} variant="block" />
          </div>
          <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-muted">
            This address was fixed when the request was created and there is no function
            anywhere in the vault that can change it. Not for the school, not for a
            verifier, not for us. The student has no ability to receive, redirect, or spend
            any of it.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * WHAT HAPPENS EITHER WAY. Both outcomes, in plain language, on the same screen as the
 * amount field. A donor should never have to read documentation to know how they get
 * their money back.
 */
export function OutcomeTerms({
  goal,
  deadline,
  destinationName,
}: {
  goal: bigint;
  deadline: bigint;
  destinationName: string;
}) {
  const school = destinationName || "the school's verified wallet";
  return (
    <section className="card overflow-hidden" aria-labelledby="outcomes-heading">
      <header className="border-b border-rule px-4 py-2.5 sm:px-5">
        <h2 id="outcomes-heading" className="eyebrow font-sans! text-ink">
          What happens either way
        </h2>
      </header>
      <dl className="divide-y divide-rule">
        <div className="px-4 py-3.5 sm:px-5">
          <dt className="text-sm font-medium text-ink">
            If {formatAmount(goal)} is reached by {formatDate(deadline)}
          </dt>
          <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
            Anyone can trigger the transfer: you, another contributor, or a stranger. The
            full amount goes to {school}. It does not need us and it does not need the
            school to cooperate. The contract re-checks the verification at that moment, so
            a school whose badge has been revoked cannot be paid.
          </dd>
        </div>
        <div className="px-4 py-3.5 sm:px-5">
          <dt className="text-sm font-medium text-ink">If it is not reached in time</dt>
          <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
            Nothing is sent to anyone. You withdraw your own contribution yourself, from
            your contributions page. There is no pooled refund to wait for, no
            administrator to ask, and no mechanism by which an unclaimed balance
            accumulates anywhere.
          </dd>
        </div>
        <div className="px-4 py-3.5 sm:px-5">
          <dt className="text-sm font-medium text-ink">
            If this school&apos;s verification is revoked
          </dt>
          <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
            Payout becomes impossible immediately and you can withdraw straight away
            without waiting for the deadline. Revocation can only ever return money to the
            people who sent it. It can never redirect it to anyone else.
          </dd>
        </div>
      </dl>
    </section>
  );
}
