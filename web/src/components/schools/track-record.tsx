"use client";

import { formatAmount } from "@/lib/format";
import { describeTrackRecord, type SchoolStats } from "@/lib/request";

/**
 * A school's track record, computed from vault state.
 *
 * `totalDisbursed` is the headline and the ordering is deliberate: money that ACTUALLY
 * REACHED the institution first, everything else after. It is the single most honest trust
 * signal in the product, because it is derived from chain state and cannot be faked by
 * anyone — not by the school, not by a verifier, not by us. "Asked for" is a much weaker
 * signal and is presented as such.
 */
export function TrackRecord({
  stats,
  variant = "full",
}: {
  stats: SchoolStats;
  variant?: "full" | "compact";
}) {
  const delivered = Number(stats.disbursedRequests);

  if (variant === "compact") {
    return (
      <dl className="grid grid-cols-3 gap-3">
        <Cell
          tone="delivered"
          label="Delivered"
          value={formatAmount(stats.totalDisbursed, { symbol: false })}
          sub={`${delivered} paid out`}
        />
        <Cell
          label="Held now"
          value={formatAmount(stats.totalHeld, { symbol: false })}
          sub="in the vault"
        />
        <Cell
          label="Open"
          value={stats.openRequests.toString()}
          sub="accepting funds"
        />
      </dl>
    );
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="record-heading">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-rule px-4 py-2.5 sm:px-5">
        <h2 id="record-heading" className="eyebrow font-sans! text-ink">
          Track record
        </h2>
        <p className="text-[0.6875rem] leading-4 text-ink-faint">
          Computed from vault state. Nobody can edit these numbers.
        </p>
      </header>

      <div className="border-b border-rule bg-delivered-soft px-4 py-4 sm:px-5">
        <p className="eyebrow text-delivered">Actually delivered to this institution</p>
        <p className="tabular mt-1 font-serif text-[1.75rem] leading-none font-semibold text-delivered">
          {formatAmount(stats.totalDisbursed)}
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-soft">
          {describeTrackRecord(stats)} This is money that reached the institution&apos;s wallet,
          not money that was requested.
        </p>
      </div>

      <dl className="px-4 py-1 sm:px-5">
        <Row label="Total ever requested" value={formatAmount(stats.totalRequested)} muted />
        <Row label="Currently held by the vault" value={formatAmount(stats.totalHeld)} />
        <Row label="Fee requests published" value={stats.totalRequests.toString()} />
        <Row label="Open, accepting contributions" value={stats.openRequests.toString()} />
        <Row label="Fully funded, awaiting payout" value={stats.releasableRequests.toString()} />
        <Row label="Paid out" value={stats.disbursedRequests.toString()} />
        <Row label="Closed unmet" value={stats.expiredRequests.toString()} last />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  muted = false,
  last = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`data-row ${last ? "border-b-0" : ""}`}>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular text-right ${muted ? "text-ink-muted" : "font-medium text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "delivered";
}) {
  return (
    <div
      className={`rounded-sm border px-2.5 py-2 ${
        tone === "delivered"
          ? "border-delivered-rule bg-delivered-soft"
          : "border-rule bg-surface-sunken"
      }`}
    >
      <dt
        className={`eyebrow ${tone === "delivered" ? "text-delivered" : "text-ink-faint"}`}
      >
        {label}
      </dt>
      <dd
        className={`tabular mt-0.5 text-[0.9375rem] leading-tight font-semibold ${
          tone === "delivered" ? "text-delivered" : "text-ink"
        }`}
      >
        {value}
      </dd>
      <dd className="mt-0.5 text-[0.6875rem] text-ink-faint">{sub}</dd>
    </div>
  );
}
