"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import { useOpenRequestsFeed, useSchoolIdentities, useDeployment } from "@/hooks/use-edgrant";
import { RequestCard } from "@/components/requests/request-card";
import { LoadingList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/callout";
import { LedgerIcon, SpinnerIcon } from "@/components/ui/icons";
import { formatAmount } from "@/lib/format";

type Sort = "newest" | "closing" | "smallest" | "nearest-goal";

const SORTS: { id: Sort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "closing", label: "Closing soonest" },
  { id: "smallest", label: "Smallest balance" },
  { id: "nearest-goal", label: "Closest to goal" },
];

/**
 * The global feed of fee balances currently accepting contributions.
 *
 * Sorting is offered because different people help differently — some want the smallest
 * balance they can clear outright, some want to finish something already nearly funded.
 * "Closing soonest" is available but is not the default and is not styled as a warning:
 * ordering by date is useful, dressing it up as scarcity is not.
 */
export function RequestFeed() {
  const { ready } = useDeployment();
  const { items, isLoading, isFetching, error, hasMore, loadMore, refetch } =
    useOpenRequestsFeed();
  const [sort, setSort] = useState<Sort>("newest");

  const schools = useMemo(
    () => items.map((item) => item.request.school as Address),
    [items],
  );
  const { identities } = useSchoolIdentities(schools);

  const sorted = useMemo(() => {
    const copy = [...items];
    switch (sort) {
      case "closing":
        return copy.sort((a, b) => Number(a.request.deadline - b.request.deadline));
      case "smallest":
        return copy.sort((a, b) => Number(a.remaining - b.remaining));
      case "nearest-goal":
        return copy.sort((a, b) => {
          const pa = a.request.goal === 0n ? 0 : Number((a.request.raised * 10000n) / a.request.goal);
          const pb = b.request.goal === 0n ? 0 : Number((b.request.raised * 10000n) / b.request.goal);
          return pb - pa;
        });
      default:
        return copy;
    }
  }, [items, sort]);

  const outstanding = useMemo(
    () => items.reduce((sum, item) => sum + item.remaining, 0n),
    [items],
  );

  if (!ready) return null;
  if (error) return <ErrorState onRetry={refetch} message={error.message} />;
  if (isLoading) return <LoadingList count={4} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No fee balances are open right now"
        icon={<LedgerIcon size={28} />}
      >
        Only currently-verified institutions can attest a fee balance, so this list is empty
        until one does. Anything that was fully funded has already been paid out, and
        anything that closed unmet has been returned to its contributors.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-rule pb-4">
        <p className="text-[0.8125rem] text-ink-muted">
          <span className="tabular font-medium text-ink">{items.length}</span> open{" "}
          {items.length === 1 ? "balance" : "balances"} ·{" "}
          <span className="tabular font-medium text-ink">{formatAmount(outstanding)}</span> still
          outstanding
          {isFetching ? (
            <span className="ml-2 inline-flex items-center gap-1 text-ink-faint">
              <SpinnerIcon size={11} />
              refreshing
            </span>
          ) : null}
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="feed-sort" className="text-[0.8125rem] text-ink-muted">
            Sort
          </label>
          <select
            id="feed-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="field h-9 min-h-9 w-auto cursor-pointer py-0 pr-8 text-[0.8125rem]"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((view) => (
          <RequestCard
            key={view.requestId.toString()}
            view={view}
            identity={identities.get(view.request.school.toLowerCase())}
          />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={loadMore} className="btn btn-secondary">
            Load earlier requests
          </button>
        </div>
      ) : null}
    </div>
  );
}
