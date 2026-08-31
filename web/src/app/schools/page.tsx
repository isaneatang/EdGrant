import type { Metadata } from "next";
import { SchoolDirectory } from "@/components/schools/school-directory";

export const metadata: Metadata = {
  title: "Verified institutions",
  description:
    "Institutions whose wallet address has been verified by proof-of-control, with the amount each has actually been paid.",
};

export default function SchoolsPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <header className="max-w-2xl">
        <p className="eyebrow text-evidence">Directory</p>
        <h1 className="mt-2.5 font-serif text-[1.875rem] leading-tight font-semibold text-ink sm:text-[2.375rem]">
          Verified institutions
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
          Every institution here has published its wallet address through a channel the public
          already trusts, and a threshold of verifiers has confirmed that the published address
          matches. The proof link is stored on-chain, so you can re-check any of it yourself.
        </p>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-muted">
          Verification says one narrow thing: this address is controlled by the named
          institution. It is not an endorsement, a quality rating, or a judgement about how any
          school spends money. The number worth weighing is what each has actually been paid.
        </p>
      </header>

      <div className="mt-9">
        <SchoolDirectory />
      </div>
    </div>
  );
}
