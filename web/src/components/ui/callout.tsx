import { InfoIcon } from "./icons";

export function Callout({
  tone = "neutral",
  title,
  icon,
  children,
  className = "",
}: {
  tone?: "neutral" | "evidence" | "delivered" | "notice" | "fault";
  title?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const style =
    tone === "evidence"
      ? "border-evidence-rule bg-evidence-soft text-evidence"
      : tone === "delivered"
        ? "border-delivered-rule bg-delivered-soft text-delivered"
        : tone === "notice"
          ? "border-notice-rule bg-notice-soft text-notice"
          : tone === "fault"
            ? "border-fault-rule bg-fault-soft text-fault"
            : "border-rule bg-surface-sunken text-ink-soft";

  return (
    <div className={`flex gap-3 rounded-md border p-3.5 ${style} ${className}`} role="note">
      <span className="mt-0.5 shrink-0">{icon ?? <InfoIcon size={15} />}</span>
      <div className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed">
        {title ? <p className="mb-1 font-semibold">{title}</p> : null}
        <div className={tone === "neutral" ? "text-ink-soft" : "opacity-90"}>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card-sunken flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div className="mb-4 text-ink-faint">{icon}</div> : null}
      <p className="font-serif text-lg text-ink">{title}</p>
      {children ? (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{children}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Could not read from the chain",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card border-fault-rule p-5">
      <p className="text-sm font-semibold text-fault">{title}</p>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
        {message ??
          "The RPC endpoint did not answer. This interface reads every screen with plain view calls, so retrying usually resolves it."}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-4">
          Retry
        </button>
      ) : null}
    </div>
  );
}
