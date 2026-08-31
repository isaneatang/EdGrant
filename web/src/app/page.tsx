import Link from "next/link";
import { RequestFeed } from "@/components/requests/request-feed";
import { LockIcon, SealIcon, ArrowRightIcon, BuildingIcon } from "@/components/ui/icons";

export const metadata = {
  title: "Fee requests",
  description:
    "Outstanding school fee balances attested on-chain by verified institutions. Contribute, and the contract pays the school directly.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="container-page py-10 sm:py-12" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="sr-only">
          Open fee balances
        </h2>
        <RequestFeed />
      </section>
    </>
  );
}

/**
 * The opening statement.
 *
 * It leads with the structural claim rather than with a story about a student, because
 * the structural claim is the product. No hero photograph, no total-raised counter
 * ticking upward, no "help X students today". Calm, and specific about what the contract
 * can and cannot do.
 */
function Hero() {
  return (
    <section className="border-b border-rule bg-surface">
      <div className="container-page py-12 sm:py-16">
        <div className="max-w-3xl">
          <p className="eyebrow text-evidence">Verified education funding</p>
          <h1 className="mt-3 font-serif text-[2rem] leading-[1.15] font-semibold text-ink sm:text-[2.75rem]">
            The money goes to the school, not to the student.
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">
            A verified institution attests on-chain that a student owes a specific amount in
            fees. Supporters contribute toward that amount. When the goal is met, the contract
            transfers the funds <strong className="font-medium text-ink">directly to the
            school&apos;s verified wallet</strong>. If the deadline passes unmet, every
            contributor withdraws their own contribution.
          </p>
          <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
            At no point can the student receive, redirect, or spend the money. That is the
            whole idea: you cannot misappropriate funds you never have custody of.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/how-it-works" className="btn btn-primary">
              How this works
              <ArrowRightIcon size={15} />
            </Link>
            <Link href="/schools" className="btn btn-secondary">
              <BuildingIcon size={15} />
              Verified institutions
            </Link>
          </div>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          <Pillar
            icon={<LockIcon size={17} />}
            title="No custody, no discretion"
            body="The vault can send funds to exactly one address: the school that created the request. There is no admin override, no pause, and no way to cancel a request or seize contributions."
          />
          <Pillar
            icon={<SealIcon size={17} />}
            title="Verification you can re-check"
            body="A verified institution has published its wallet address somewhere the public already trusts. That proof link is stored on-chain, and every badge here links straight to it."
          />
          <Pillar
            icon={<ArrowRightIcon size={17} />}
            title="Refunds you take yourself"
            body="If a goal is not met, you withdraw your own contribution. No pooled refund to wait for, nobody to petition, and no unclaimed balance accumulating anywhere."
          />
        </ul>
      </div>
    </section>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="card-sunken p-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-evidence-rule bg-surface text-evidence">
        {icon}
      </span>
      <p className="mt-3 text-[0.9375rem] font-medium text-ink">{title}</p>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{body}</p>
    </li>
  );
}
