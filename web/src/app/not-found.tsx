import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-reading py-20 text-center">
      <p className="eyebrow text-ink-faint">404</p>
      <h1 className="mt-3 font-serif text-[1.75rem] font-semibold text-ink sm:text-[2.25rem]">
        There is nothing at this address
      </h1>
      <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
        Fee requests are addressed by their numeric id, and institutions by their wallet
        address.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Open fee balances
        </Link>
        <Link href="/schools" className="btn btn-secondary">
          Verified institutions
        </Link>
      </div>
    </div>
  );
}
