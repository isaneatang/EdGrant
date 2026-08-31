import type { RequestStatus } from "@/lib/request";
import { SealIcon, SealBrokenIcon, CheckIcon, LockIcon, InfoIcon } from "./icons";

const STATUS_STYLE: Record<RequestStatus, { chip: string; icon: React.ReactNode }> = {
  open: { chip: "chip", icon: <InfoIcon size={12} /> },
  "fully-funded": { chip: "chip chip-evidence", icon: <CheckIcon size={12} /> },
  disbursed: { chip: "chip chip-delivered", icon: <LockIcon size={12} /> },
  "closed-unmet": { chip: "chip", icon: <InfoIcon size={12} /> },
  "verification-withdrawn": { chip: "chip chip-fault", icon: <SealBrokenIcon size={12} /> },
};

export function StatusChip({ status, label }: { status: RequestStatus; label: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={style.chip}>
      {style.icon}
      {label}
    </span>
  );
}

export function Chip({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: "neutral" | "evidence" | "delivered" | "notice" | "fault";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "evidence"
      ? "chip-evidence"
      : tone === "delivered"
        ? "chip-delivered"
        : tone === "notice"
          ? "chip-notice"
          : tone === "fault"
            ? "chip-fault"
            : "";
  return (
    <span className={`chip ${toneClass} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

/** Compact seal used in lists where the full evidence panel will not fit. */
export function VerifiedChip({ verified }: { verified: boolean }) {
  return verified ? (
    <Chip tone="evidence" icon={<SealIcon size={12} />}>
      Verified
    </Chip>
  ) : (
    <Chip tone="fault" icon={<SealBrokenIcon size={12} />}>
      Not verified
    </Chip>
  );
}
