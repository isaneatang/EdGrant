import type { Metadata } from "next";
import { VerifierConsole } from "@/components/console/verifier-console";

export const metadata: Metadata = {
  title: "Verifier console",
  description:
    "Review proof-of-control applications. The queue is public; only the registry's verifier set can confirm.",
  robots: { index: false, follow: false },
};

export default function VerifierPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <header className="max-w-2xl">
        <p className="eyebrow text-evidence">Registry</p>
        <h1 className="mt-2.5 font-serif text-[1.875rem] leading-tight font-semibold text-ink sm:text-[2.375rem]">
          Verifier console
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
          Verification is the one deliberately centralised part of this system, and it is
          narrow on purpose: a check that an institution controls a public identity it already
          has, and has published this wallet address there. It is not a judgement about the
          institution, and nothing here invites one.
        </p>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-muted">
          The queue below is readable by anyone. That is deliberate, because a verification process
          nobody can inspect would be worth about as much as no process at all.
        </p>
      </header>

      <div className="mt-9 max-w-3xl">
        <VerifierConsole />
      </div>
    </div>
  );
}
