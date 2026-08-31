"use client";

import { useState } from "react";
import { schoolProfileAbi } from "@/lib/abi";
import { contractsFor, PROFILE_LIMITS } from "@/lib/contracts";
import { byteLength } from "@/lib/format";
import { classifyUri } from "@/lib/uri";
import { useDeployment, useMyProfile } from "@/hooks/use-edgrant";
import { useTxRunner } from "@/hooks/use-tx";
import { ConsoleSection, TextArea, TextField } from "@/components/console/fields";
import { Callout } from "@/components/ui/callout";
import { SpinnerIcon } from "@/components/ui/icons";
import type { SchoolProfileData } from "@/lib/request";

/**
 * Profile editor.
 *
 * The banner at the top is not decoration. A school editing this screen should understand
 * that nothing they write here is evidence of anything, because the interface will render it
 * with visibly less authority than the badge — and that is deliberate. Telling them so here
 * is more honest than letting them discover it and assume it is a bug.
 */
export function ProfileEditor() {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const { profile } = useMyProfile();
  const tx = useTxRunner();

  const [form, setForm] = useState<Fields>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  // Seeded from chain state exactly once, adjusted during render rather than in an effect.
  // React supports this for derived state and it avoids a wasted render with empty fields.
  // Once seeded it is never re-seeded, so a background refetch cannot discard something the
  // registrar is halfway through typing.
  if (!loaded && profile) {
    const p = profile as SchoolProfileData;
    setForm({
      displayName: p.displayName,
      logoURI: p.logoURI,
      bannerURI: p.bannerURI,
      description: p.description,
      website: p.website,
      location: p.location,
    });
    setLoaded(true);
  }

  const set = (key: keyof Fields) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const tooLong = (value: string, max: number) =>
    byteLength(value) > max ? `Over the contract limit of ${max} bytes.` : null;

  const errors = {
    displayName:
      form.displayName.trim().length === 0 && loaded
        ? null
        : tooLong(form.displayName, PROFILE_LIMITS.short),
    logoURI: uriError(form.logoURI) ?? tooLong(form.logoURI, PROFILE_LIMITS.uri),
    bannerURI: uriError(form.bannerURI) ?? tooLong(form.bannerURI, PROFILE_LIMITS.uri),
    description: tooLong(form.description, PROFILE_LIMITS.description),
    website: uriError(form.website) ?? tooLong(form.website, PROFILE_LIMITS.uri),
    location: tooLong(form.location, PROFILE_LIMITS.short),
  };

  const ready =
    form.displayName.trim().length > 0 && Object.values(errors).every((e) => e === null);

  if (!contracts) return null;

  return (
    <ConsoleSection
      title="Public profile"
      description="Stored entirely on-chain. Everything here is your own words."
    >
      <Callout tone="notice" className="mb-5" title="This content is marketing, not evidence">
        Nobody verifies any of it. Not the name, not the description, not the logo. The
        interface therefore renders it visibly more quietly than your verified badge, inside a
        dashed panel captioned &ldquo;verified by nobody&rdquo;. That is intentional. If profile
        text carried the same authority as the badge, an impersonator&apos;s page would look
        exactly like yours, and the badge would stop meaning anything.
      </Callout>

      <div className="space-y-4">
        <TextField
          label="Display name"
          hint="If this differs from the name you were verified under, the interface will say so next to it. Use a trading name only if you are comfortable with that being pointed out."
          value={form.displayName}
          onChange={set("displayName")}
          maxBytes={PROFILE_LIMITS.short}
          required
          error={errors.displayName}
          disabled={tx.isBusy}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Logo URI"
            hint="http(s) or ipfs://. Loaded by the visitor's browser, never proxied by us."
            value={form.logoURI}
            onChange={set("logoURI")}
            maxBytes={PROFILE_LIMITS.uri}
            error={errors.logoURI}
            disabled={tx.isBusy}
            inputMode="url"
            mono
          />
          <TextField
            label="Banner URI"
            hint="Rendered at a small fixed height and captioned as supplied by you."
            value={form.bannerURI}
            onChange={set("bannerURI")}
            maxBytes={PROFILE_LIMITS.uri}
            error={errors.bannerURI}
            disabled={tx.isBusy}
            inputMode="url"
            mono
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Website"
            value={form.website}
            onChange={set("website")}
            maxBytes={PROFILE_LIMITS.uri}
            error={errors.website}
            disabled={tx.isBusy}
            inputMode="url"
            mono
          />
          <TextField
            label="Location"
            value={form.location}
            onChange={set("location")}
            maxBytes={PROFILE_LIMITS.short}
            error={errors.location}
            disabled={tx.isBusy}
          />
        </div>

        <TextArea
          label="Description"
          hint="Only the profile fields live on-chain; images stay at whatever URI you point at. Gas is cheap on this chain, so text is stored directly rather than behind a JSON pointer that could later go missing."
          value={form.description}
          onChange={set("description")}
          maxBytes={PROFILE_LIMITS.description}
          rows={6}
          error={errors.description}
          disabled={tx.isBusy}
        />

        <button
          type="button"
          disabled={!ready || tx.isBusy}
          onClick={() =>
            tx.run({
              address: contracts.profiles,
              abi: schoolProfileAbi,
              functionName: "setProfile",
              args: [
                form.displayName.trim(),
                form.logoURI.trim(),
                form.bannerURI.trim(),
                form.description,
                form.website.trim(),
                form.location.trim(),
              ],
              label: "Profile update",
              success: "Your profile is live. Every field is now readable on-chain by anyone.",
            })
          }
          className="btn btn-primary w-full sm:w-auto"
        >
          {tx.isBusy ? <SpinnerIcon size={15} /> : null}
          {tx.stage === "signing"
            ? "Confirm in your wallet…"
            : tx.stage === "mining"
              ? "Saving…"
              : profile && (profile as SchoolProfileData).exists
                ? "Save profile"
                : "Publish profile"}
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

type Fields = {
  displayName: string;
  logoURI: string;
  bannerURI: string;
  description: string;
  website: string;
  location: string;
};

const EMPTY: Fields = {
  displayName: "",
  logoURI: "",
  bannerURI: "",
  description: "",
  website: "",
  location: "",
};

function uriError(value: string): string | null {
  if (value.trim().length === 0) return null;
  const classified = classifyUri(value);
  if (classified.kind === "unsafe") {
    return `${classified.reason}. Visitors will see the raw text instead of a link.`;
  }
  return null;
}
