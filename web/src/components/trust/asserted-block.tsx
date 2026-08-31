/**
 * SELF-ASSERTED CONTENT. Everything a school types about itself, including display name,
 * logo, description, website, location and every post, is checked by nobody.
 *
 * This wrapper exists so that content can never be rendered without its caveat. It is
 * deliberately quieter than the evidence panel: dashed rule, sunken surface, softer
 * ink, serif body set like a quotation. The visual difference is the trust model, not
 * a style preference. An interface that gave this the same authority as the badge would
 * hand impersonators exactly the credibility this project exists to deny them.
 */
export function AssertedBlock({
  label = "Written by the school",
  caption = "Self-asserted. Not verified by anyone. Only the badge and its proof link are evidence.",
  children,
  className = "",
}: {
  label?: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`asserted-panel overflow-hidden ${className}`}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-dashed border-rule-strong px-4 py-2.5 sm:px-5">
        <h2 className="eyebrow font-sans! text-ink-muted">{label}</h2>
        <p className="text-[0.6875rem] leading-4 text-ink-faint">{caption}</p>
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Inline variant for a single field inside an otherwise verified layout. */
export function AssertedInline({
  children,
  title = "Self-asserted by the school. Not verified.",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="border-b border-dashed border-rule-strong text-ink-soft decoration-dotted"
    >
      {children}
    </span>
  );
}
