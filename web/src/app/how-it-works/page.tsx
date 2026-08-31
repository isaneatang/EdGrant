import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  LockIcon,
  SealIcon,
  BuildingIcon,
  UsersIcon,
  LedgerIcon,
  InfoIcon,
} from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "The trust model behind EdGrant: what the contracts guarantee structurally, and the one place the system requires trust in a human.",
};

/**
 * The explainer.
 *
 * Written to be readable by someone deciding whether to send money, and honest about the
 * limits. The section on what this is *not* is not a disclaimer buried at the bottom — it is
 * a peer of the others, because a product whose entire claim is trustworthiness cannot be
 * selective about which facts it presents clearly.
 */
export default function HowItWorksPage() {
  return (
    <div className="container-reading py-10 sm:py-14">
      <header>
        <p className="eyebrow text-evidence">The trust model</p>
        <h1 className="mt-2.5 font-serif text-[2rem] leading-tight font-semibold text-ink sm:text-[2.5rem]">
          How this works, and where it stops
        </h1>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-soft">
          Every year an enormous number of students ask for help paying school fees. Most of
          those requests are genuine. Some are not, and the person being asked has almost no
          reliable way to tell the difference. Even when a request is completely legitimate, the
          money goes to a person rather than to a school, and nobody can confirm weeks later
          that it arrived.
        </p>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
          EdGrant addresses both problems with one structural decision:{" "}
          <strong className="font-medium text-ink">the money never passes through the
          student at all.</strong>
        </p>
      </header>

      <Section
        n="01"
        icon={<BuildingIcon size={18} />}
        title="A verified school attests the debt"
      >
        <p>
          A school states on-chain that a specific student owes a specific amount, from its own
          verified address. The claim recorded is not &ldquo;this student deserves help&rdquo; —
          which nobody can verify — but &ldquo;this school says this student owes this
          amount&rdquo;, made by the party that would be owed the money.
        </p>
        <p>
          That is why it carries weight. A school has no incentive to fabricate a debt owed to
          it by a student who does not exist, and the moment it did, that fabrication would be
          permanently and publicly attached to its verified institutional identity.
        </p>
        <p>
          The student is referenced by an identifier meaningful only inside the school&apos;s own
          records — hashed before it is sent, never a name. A student needs no wallet, no gas,
          and no public story to be helped.
        </p>
      </Section>

      <Section n="02" icon={<UsersIcon size={18} />} title="Supporters contribute">
        <p>
          Contributions are tracked per contributor and partial funding is visible in real time.
          The vault rejects a contribution larger than the outstanding remainder rather than
          silently trimming it, so you are never charged an amount you did not choose.
        </p>
        <p>
          Because school fees are a fiat-denominated debt, balances are denominated in a stable
          unit rather than a volatile one. A goal set in a volatile asset would drift away from
          the balance it is meant to settle before the deadline arrived, and the attestation
          would stop describing anything real.
        </p>
      </Section>

      <Section n="03" icon={<LockIcon size={18} />} title="The contract pays the school">
        <p>
          When the goal is met, the funds go{" "}
          <strong className="font-medium text-ink">directly to the school&apos;s verified
          wallet</strong>. Not to the student. Not to an intermediary. Not to a
          platform-controlled wallet. The destination is fixed when the request is created and
          there is no function anywhere in the vault that can change it.
        </p>
        <p>
          That transfer is a separate, permissionless call — anyone can trigger it. Deliberately
          not automatic: auto-releasing on the goal-completing contribution would charge one
          unlucky donor for everyone else&apos;s disbursement, and would let a recipient that
          reverts on receipt break contributions for everybody.
        </p>
        <p>
          Verification is re-checked at the moment value moves, not only at creation. A school
          whose badge has been revoked cannot be paid.
        </p>
      </Section>

      <Section n="04" icon={<ArrowRightIcon size={18} />} title="If the goal is not met, you take your money back">
        <p>
          Each contributor withdraws their own contribution, individually. There is no pooled
          refund requiring administrative action, no unclaimed balance accumulating anywhere, and
          no deadline after which it stops being yours.
        </p>
        <p>
          The vault has no administrative override, no pause function, and no way for anyone —
          including whoever deployed it — to cancel a request, redirect funds, or seize
          contributions. Once deployed, the rules are what they are.
        </p>
      </Section>

      <Section
        n="05"
        icon={<SealIcon size={18} />}
        title="The one place this needs trust in a human"
        tone="evidence"
      >
        <p>
          Verifying that a wallet address genuinely belongs to a real institution is not
          something code can do. That is not a limitation of this design; it is a hard boundary
          of what smart contracts are capable of. A contract can verify that a signature came
          from a particular key. It cannot verify that the person holding that key is the
          registrar of a real university.
        </p>
        <p>
          So this system does not pretend otherwise. Verification is performed by people, and it
          is the single deliberately centralised component in an otherwise trustless mechanism.
        </p>
        <p>
          But the process is{" "}
          <strong className="font-medium text-ink">proof-of-control, not subjective
          review</strong>. A verifier is not judging whether a name sounds legitimate or an
          applicant seems trustworthy. They are checking one objective fact: has this institution
          published this exact wallet address somewhere the public already trusts — its own
          domain, a press release, its verified account?
        </p>
        <p>
          That proof link is stored on-chain, which means{" "}
          <strong className="font-medium text-ink">you can re-check it yourself</strong>. Every
          verified badge in this interface links straight to it. You do not have to trust that a
          verifier did their job. It is the same logical pattern as DNS domain verification, and
          it is not novel — just applied correctly.
        </p>
        <p>
          No single address can grant or revoke institutional identity. Every privileged action
          requires confirmations from a threshold of distinct verifiers, and the verifier set
          governs itself under the same rule. There is no owner and no admin, because an owner
          able to swap verifiers could install itself as the only one.
        </p>
      </Section>

      <Section
        n="06"
        icon={<InfoIcon size={18} />}
        title="Profile content is marketing. The badge is evidence."
        tone="notice"
      >
        <p>
          A verified school can publish a profile: a display name, a logo, a description,
          announcements. <strong className="font-medium text-ink">None of that is checked by
          anyone.</strong>
        </p>
        <p>
          So this interface renders it differently — quieter ink, dashed rules, a caption saying
          nobody verified it — while verified registry facts get a seal, a solid rule, and a link
          out to the proof. That difference is not styling. If profile text carried the same
          authority as the badge, an impersonator&apos;s page would look identical to a real
          one, and the badge would stop meaning anything at all.
        </p>
        <p>
          If a school&apos;s self-chosen display name differs from the name it was verified
          under, this interface says so next to it rather than smoothing it over.
        </p>
      </Section>

      <Section n="07" icon={<LedgerIcon size={18} />} title="What to weigh before you give">
        <p>
          The most useful number on any institution&apos;s page is what it has{" "}
          <strong className="font-medium text-ink">actually been paid</strong> — money that
          reached the institution, derived from chain state, unfakeable by anyone. It is a much
          stronger signal than the total it has asked for, and a much stronger signal than
          anything a school could write about itself.
        </p>
        <p>
          Then open the proof link. It takes one click and it is the whole basis of the
          verification you are relying on.
        </p>
      </Section>

      <section className="mt-12 rounded-md border border-rule bg-surface-sunken p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-ink">
          What this is honest about not being
        </h2>
        <ul className="mt-4 space-y-3.5 text-[0.9375rem] leading-relaxed text-ink-soft">
          <li>
            <strong className="font-medium text-ink">Not fraud-proof.</strong> It makes the most
            common failure — funds raised in a student&apos;s name never reaching the school —
            structurally impossible. It does not make a corrupt verified institution impossible,
            and it does not prevent a school from attesting an inflated or fictitious balance.
            What it does is bind that behaviour permanently to a publicly-known institutional
            identity. A meaningful deterrent, not an absolute barrier.
          </li>
          <li>
            <strong className="font-medium text-ink">Not fully decentralised.</strong> The
            verification layer requires trust in a human process. Everything downstream of it —
            contribution, accounting, disbursement, refund — is trustless and requires no such
            trust.
          </li>
          <li>
            <strong className="font-medium text-ink">Not a solution to key custody.</strong> A
            school still needs a wallet and still needs to secure it. If a school loses its key,
            there is no recovery path — and adding one would mean adding exactly the
            administrative override this design forbids.
          </li>
          <li>
            <strong className="font-medium text-ink">Not audited, and not a regulated
            platform.</strong> These contracts have had no professional audit. This is a proof of
            concept demonstrating that the mechanism works cleanly, and it makes no claim about
            its treatment under any jurisdiction&apos;s charitable solicitation, money
            transmission, or student privacy law.
          </li>
          <li>
            <strong className="font-medium text-ink">Not private.</strong> Public blockchains
            expose everything permanently. Student information is kept off-chain and references
            are hashed, but what remains visible is that a verified institution has an
            outstanding balance of a certain amount against an identifier, and whether it was
            funded. That is a mitigation, not a solution.
          </li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          Browse open fee balances
          <ArrowRightIcon size={15} />
        </Link>
        <Link href="/schools" className="btn btn-secondary">
          Verified institutions
        </Link>
      </div>
    </div>
  );
}

function Section({
  n,
  icon,
  title,
  tone,
  children,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  tone?: "evidence" | "notice";
  children: React.ReactNode;
}) {
  const accent =
    tone === "evidence"
      ? "border-evidence-rule bg-evidence-soft text-evidence"
      : tone === "notice"
        ? "border-notice-rule bg-notice-soft text-notice"
        : "border-rule bg-surface-sunken text-ink-muted";

  return (
    <section className="mt-11 border-t border-rule pt-7">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border ${accent}`}
        >
          {icon}
        </span>
        <div>
          <p className="tabular font-mono text-[0.6875rem] tracking-wider text-ink-faint">{n}</p>
          <h2 className="font-serif text-[1.25rem] leading-snug font-semibold text-ink sm:text-[1.375rem]">
            {title}
          </h2>
        </div>
      </div>
      <div className="mt-4 space-y-3.5 text-[0.9375rem] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}
