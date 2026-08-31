import { formatAmount, formatPercent } from "@/lib/format";

/**
 * Funding progress as a statement of fact.
 *
 * No gradient, no animated fill, no "almost there!" copy. The bar is 6px, one flat
 * colour, and the numbers beside it do the actual work.
 */
export function FundingMeter({
  raised,
  goal,
  progress,
  tone = "evidence",
  showLabels = true,
  compact = false,
}: {
  raised: bigint;
  goal: bigint;
  progress: number;
  tone?: "evidence" | "delivered";
  showLabels?: boolean;
  compact?: boolean;
}) {
  const pct = formatPercent(raised, goal);
  return (
    <div>
      {showLabels ? (
        <div
          className={`mb-2 flex items-baseline justify-between gap-3 ${compact ? "text-[0.8125rem]" : "text-sm"}`}
        >
          <span className="tabular font-medium text-ink">
            {formatAmount(raised, { symbol: false })}
            <span className="text-ink-muted"> of {formatAmount(goal)}</span>
          </span>
          <span className="tabular shrink-0 text-ink-muted">{pct}</span>
        </div>
      ) : null}
      <div
        className="meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label={`${pct} of the goal raised`}
      >
        <div
          className={tone === "delivered" ? "meter-fill-delivered" : "meter-fill"}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
