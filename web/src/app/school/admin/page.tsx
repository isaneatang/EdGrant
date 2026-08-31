import type { Metadata } from "next";
import { SchoolConsole } from "@/components/console/school-console";

export const metadata: Metadata = {
  title: "School console",
  description:
    "For verified institutions: publish a profile, post announcements, and attest outstanding fee balances.",
  robots: { index: false, follow: false },
};

export default function SchoolAdminPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <header className="max-w-2xl">
        <p className="eyebrow text-evidence">Institution</p>
        <h1 className="mt-2.5 font-serif text-[1.875rem] leading-tight font-semibold text-ink sm:text-[2.375rem]">
          School console
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
          Attest what a student owes, and every contribution toward it settles into this wallet
          directly. You are the party owed the money, which is why the attestation carries weight
          and why it is permanently attached to your verified institutional identity.
        </p>
      </header>

      <div className="mt-9 max-w-3xl">
        <SchoolConsole />
      </div>
    </div>
  );
}
