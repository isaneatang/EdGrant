"use client";

import Link from "next/link";
import { useMemo } from "react";
import { isAddress, getAddress, type Address } from "viem";
import { EvidencePanel } from "@/components/trust/evidence-panel";
import { AssertedBlock } from "@/components/trust/asserted-block";
import { RequestCard } from "@/components/requests/request-card";
import { PostList } from "@/components/schools/post-list";
import { TrackRecord } from "@/components/schools/track-record";
import { AddressDisplay } from "@/components/ui/address-display";
import { Callout, EmptyState, ErrorState } from "@/components/ui/callout";
import { VerifiedChip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BuildingIcon,
  ChevronRightIcon,
  ExternalIcon,
  LedgerIcon,
} from "@/components/ui/icons";
import { formatDate, shortAddress } from "@/lib/format";
import { entityTypeLabel } from "@/lib/request";
import { classifyUri } from "@/lib/uri";
import { RemoteImage, InstitutionMonogram } from "@/components/ui/remote-image";
import { useDeployment, useSchoolPage, useSchoolIdentities } from "@/hooks/use-edgrant";

/**
 * A school's public page. This is where the trust separation is a hard requirement, not a
 * preference, so the page is built in three explicitly labelled bands:
 *
 *   VERIFIED       registry facts — registered name, entity type, proof URI, verified date.
 *                  Rendered with authority, seal, solid rule, link out to the proof.
 *
 *   TRACK RECORD   computed from vault state. Factual, unfakeable, and led by
 *                  `totalDisbursed` — money that actually arrived.
 *
 *   SELF-ASSERTED  everything the school typed: display name, logo, banner, description,
 *                  website, location, every post. Dashed rules, sunken surface, softer ink,
 *                  serif body, and a caption saying nobody checked any of it.
 *
 * If those three looked alike, a fraudster's page would look identical to a real one. That
 * is the whole reason this layout is shaped the way it is.
 */
export function SchoolProfilePage({ addressParam }: { addressParam: string }) {
  const school = useMemo<Address | null>(() => {
    if (!isAddress(addressParam)) return null;
    return getAddress(addressParam);
  }, [addressParam]);

  const { ready } = useDeployment();
  const { page, isLoading, error, refetch } = useSchoolPage(school ?? undefined, 12);
  const identities = useSchoolIdentities(school ? [school] : []);
  const identity = school ? identities.identities.get(school.toLowerCase()) : undefined;

  if (!school) {
    return (
      <div className="container-reading py-16">
        <EmptyState title="That is not a wallet address" icon={<BuildingIcon size={28} />}>
          Institution pages are addressed by the school&apos;s wallet address.{" "}
          <Link href="/schools" className="link">
            Browse the directory
          </Link>
          .
        </EmptyState>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Not deployed on this network"
          message="Switch to a network where EdGrant is deployed. This interface never borrows another chain's contract addresses."
        />
      </div>
    );
  }

  if (isLoading) return <ProfileSkeleton />;
  if (error || !page) {
    return (
      <div className="container-page py-16">
        <ErrorState onRetry={() => void refetch()} message={error?.message} />
      </div>
    );
  }

  const { overview, open, posts } = page;
  const { profile, stats } = overview;
  const website = classifyUri(profile.website);
  const assertedName = profile.displayName.trim();
  const nameDiffers =
    assertedName.length > 0 &&
    assertedName.toLowerCase() !== overview.entityName.trim().toLowerCase();
  const neverVerified = overview.verifiedAt === 0n && !overview.verified;

  return (
    <div>
      {/* Banner. Self-asserted imagery, so it is capped in height, muted, and captioned. */}
      {profile.bannerURI.trim() ? (
        <div className="relative border-b border-rule bg-surface-sunken">
          <RemoteImage
            src={profile.bannerURI}
            className="h-28 w-full object-cover opacity-90 sm:h-40"
            fallback={<div className="h-28 w-full bg-surface-sunken sm:h-40" />}
          />
          <p className="absolute right-2 bottom-1.5 rounded-xs bg-canvas/80 px-1.5 py-0.5 text-[0.625rem] tracking-wide text-ink-muted uppercase backdrop-blur-sm">
            Image supplied by the school
          </p>
        </div>
      ) : null}

      <div className="container-page py-6 sm:py-9">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-[0.8125rem]">
          <Link href="/schools" className="text-ink-muted hover:text-ink">
            Institutions
          </Link>
          <ChevronRightIcon size={12} className="text-ink-faint" />
          <span className="font-mono text-[0.75rem] text-ink">{shortAddress(school, 6)}</span>
        </nav>

        {/* ---- Headline: the REGISTERED name. Not the display name. ---- */}
        <header className="border-b border-rule pb-6">
          <div className="flex items-start gap-4">
            <RemoteImage
              src={profile.logoURI}
              className="h-14 w-14 shrink-0 rounded-sm border border-rule object-cover sm:h-16 sm:w-16"
              fallback={
                <InstitutionMonogram
                  name={overview.entityName}
                  className="h-14 w-14 text-base sm:h-16 sm:w-16"
                />
              }
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow text-ink-faint">Registered name</p>
                <VerifiedChip verified={overview.verified} />
              </div>
              <h1 className="mt-1.5 font-serif text-[1.75rem] leading-tight font-semibold text-ink sm:text-[2.25rem]">
                {overview.entityName || shortAddress(school, 8)}
              </h1>
              <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
                {entityTypeLabel(overview.entityType)}
                {overview.verifiedAt > 0n ? ` · verified ${formatDate(overview.verifiedAt)}` : ""}
              </p>
            </div>
          </div>
        </header>

        {neverVerified ? (
          <Callout tone="notice" className="mt-6" title="This address has never been verified">
            There is no registry entry for it, so nothing on this page has been checked by
            anyone. Any profile text or posts below were written by whoever controls this
            address.
          </Callout>
        ) : !overview.verified ? (
          <Callout tone="fault" className="mt-6" title="Verification has been revoked">
            The profile and past requests stay readable deliberately — you should be able to see
            what was claimed next to the fact that the badge is gone. No payout is possible
            while verification is withdrawn, and contributors to any open request can withdraw
            immediately.
          </Callout>
        ) : null}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <div className="min-w-0 space-y-6">
            {/* BAND 1 — VERIFIED */}
            <EvidencePanel
              school={school}
              verified={overview.verified}
              entityName={overview.entityName}
              entityType={overview.entityType}
              proofURI={overview.proofURI}
              verifiedAt={overview.verifiedAt}
            />

            {/* BAND 3 — SELF-ASSERTED */}
            {profile.exists ? (
              <AssertedBlock
                label="What the school says about itself"
                caption={`Self-asserted, last edited ${formatDate(profile.updatedAt)}. Verified by nobody.`}
              >
                {nameDiffers ? (
                  <p className="mb-3 rounded-sm border border-notice-rule bg-notice-soft px-3 py-2 text-[0.8125rem] leading-relaxed text-notice">
                    This school calls itself{" "}
                    <strong className="font-medium">“{assertedName}”</strong>, which is not the
                    name it was verified under. That may be a trading name — or it may not be.
                    Only the registered name above was checked.
                  </p>
                ) : null}

                <dl className="space-y-2.5">
                  {assertedName ? (
                    <Field label="Display name">{assertedName}</Field>
                  ) : null}
                  {profile.location.trim() ? (
                    <Field label="Location">{profile.location}</Field>
                  ) : null}
                  {profile.website.trim() ? (
                    <Field label="Website">
                      {website.kind === "http" ? (
                        <a
                          href={website.href}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="link inline-flex items-baseline gap-1 break-all"
                        >
                          {website.display}
                          <ExternalIcon size={11} className="shrink-0 translate-y-0.5" />
                        </a>
                      ) : (
                        <span className="text-ink-muted">
                          {profile.website}{" "}
                          <span className="text-notice">(not a link we will open)</span>
                        </span>
                      )}
                    </Field>
                  ) : null}
                </dl>

                {profile.description.trim() ? (
                  <p className="asserted-prose mt-4 whitespace-pre-wrap">{profile.description}</p>
                ) : null}
              </AssertedBlock>
            ) : (
              <div className="asserted-panel px-4 py-4 sm:px-5">
                <p className="eyebrow text-ink-muted">What the school says about itself</p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
                  This institution has not published a profile. Nothing in the funding mechanism
                  depends on one — the badge and the track record are what matter.
                </p>
              </div>
            )}

            <AssertedBlock
              label="Announcements from the school"
              caption="Written and categorised by the school. Not verified, and irrelevant to how the money moves."
            >
              <PostList posts={posts} />
            </AssertedBlock>
          </div>

          {/* BAND 2 — TRACK RECORD */}
          <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
            <TrackRecord stats={stats} />
            <div className="card-sunken px-4 py-3.5">
              <p className="eyebrow text-ink-faint">Disbursement wallet</p>
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-muted">
                Every request this school creates pays out here, and the destination is fixed at
                creation with no setter anywhere in the vault.
              </p>
              <div className="mt-2">
                <AddressDisplay address={school} variant="block" truncate={false} />
              </div>
            </div>
          </div>
        </div>

        {/* Open balances */}
        <section className="mt-12" aria-labelledby="open-heading">
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-3">
            <h2 id="open-heading" className="font-serif text-xl font-semibold text-ink">
              Open fee balances
            </h2>
            <p className="text-[0.8125rem] text-ink-muted">
              {open.length} accepting contributions
            </p>
          </div>

          {open.length === 0 ? (
            <div className="mt-5">
              <EmptyState title="Nothing open right now" icon={<LedgerIcon size={26} />}>
                {stats.totalRequests > 0n
                  ? "Every balance this school has published is either paid out, fully funded and awaiting payout, or closed."
                  : "This school has not published any fee balances yet."}
              </EmptyState>
            </div>
          ) : (
            <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...open].reverse().map((view) => (
                <RequestCard
                  key={view.requestId.toString()}
                  view={view}
                  identity={identity}
                  showSchool={false}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.875rem]">
      <dt className="w-28 shrink-0 text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink-soft">{children}</dd>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="container-page py-8" aria-busy="true">
      <span className="sr-only">Loading this institution from the chain…</span>
      <Skeleton className="h-4 w-44" />
      <div className="mt-6 flex gap-4 border-b border-rule pb-6">
        <Skeleton className="h-16 w-16 rounded-sm" />
        <div className="flex-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2.5 h-8 w-72 max-w-full" />
          <Skeleton className="mt-2.5 h-3 w-48" />
        </div>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
