"use client";

import Link from "next/link";
import { SealIcon, SealBrokenIcon, ChevronRightIcon, ExternalIcon } from "@/components/ui/icons";
import { shortAddress, formatDate } from "@/lib/format";
import { entityTypeLabel, type SchoolOverview } from "@/lib/request";
import { safeHref } from "@/lib/uri";
import { RemoteImage, InstitutionMonogram } from "@/components/ui/remote-image";
import { TrackRecord } from "./track-record";

/**
 * A verified institution as it appears in the directory.
 *
 * The verified name from the registry is the heading. The self-asserted display name and
 * logo are shown only as secondary, captioned detail. If a school calls itself something
 * different from the name it was verified under, that discrepancy is a finding and this
 * card surfaces it rather than smoothing it over.
 */
export function SchoolCard({ overview }: { overview: SchoolOverview }) {
  const { profile, stats } = overview;
  const proof = safeHref(overview.proofURI);
  const assertedName = profile.displayName.trim();
  const nameDiffers =
    assertedName.length > 0 &&
    assertedName.toLowerCase() !== overview.entityName.trim().toLowerCase();

  return (
    <article className="card group relative flex flex-col p-4 transition-colors hover:border-rule-strong sm:p-5">
      <div className="flex items-start gap-3">
        <RemoteImage
          src={profile.logoURI}
          className="h-10 w-10 shrink-0 rounded-sm border border-rule object-cover"
          fallback={<InstitutionMonogram name={overview.entityName} />}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <span
              className={`mt-0.5 shrink-0 ${overview.verified ? "text-evidence" : "text-fault"}`}
            >
              {overview.verified ? <SealIcon size={14} /> : <SealBrokenIcon size={14} />}
            </span>
            <h3 className="min-w-0 font-serif text-[1.0625rem] leading-snug font-semibold text-ink">
              <Link href={`/schools/${overview.school}`} className="relative z-10 hover:underline">
                {overview.entityName || shortAddress(overview.school, 6)}
              </Link>
            </h3>
          </div>
          <p className="mt-1 text-[0.75rem] text-ink-muted">
            {entityTypeLabel(overview.entityType)} · verified {formatDate(overview.verifiedAt)}
          </p>
          {proof ? (
            <a
              href={proof}
              target="_blank"
              rel="noreferrer noopener"
              className="link-evidence relative z-10 mt-1 inline-flex items-center gap-1 text-[0.75rem]"
            >
              Re-check the proof
              <ExternalIcon size={10} />
            </a>
          ) : null}
        </div>
      </div>

      {assertedName || profile.location.trim() ? (
        <div className="mt-3.5 border-l-2 border-dashed border-rule-strong pl-3">
          <p className="text-[0.625rem] tracking-[0.09em] text-ink-faint uppercase">
            Self-described · not verified
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
            {assertedName || "-"}
            {profile.location.trim() ? (
              <span className="text-ink-faint"> · {profile.location}</span>
            ) : null}
          </p>
          {nameDiffers ? (
            <p className="mt-1 text-[0.6875rem] leading-snug text-notice">
              Differs from the registered name above.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <TrackRecord stats={stats} variant="compact" />
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-rule pt-3.5">
        <Link
          href={`/schools/${overview.school}`}
          className="relative z-10 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink group-hover:underline"
        >
          Institution page
          <ChevronRightIcon size={13} />
        </Link>
      </div>

      <Link
        href={`/schools/${overview.school}`}
        aria-label={`Open ${overview.entityName || "institution"}`}
        className="absolute inset-0 z-0 rounded-md sm:hidden"
        tabIndex={-1}
      />
    </article>
  );
}
