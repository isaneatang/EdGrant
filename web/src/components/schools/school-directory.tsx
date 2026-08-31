"use client";

import { useMemo, useState } from "react";
import { useDirectory, useDeployment } from "@/hooks/use-edgrant";
import { SchoolCard } from "@/components/schools/school-card";
import { LoadingList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/callout";
import { BuildingIcon } from "@/components/ui/icons";
import { formatAmount } from "@/lib/format";

type Sort = "delivered" | "name" | "newest" | "open";

const SORTS: { id: Sort; label: string }[] = [
  { id: "delivered", label: "Most delivered" },
  { id: "open", label: "Most open balances" },
  { id: "newest", label: "Recently verified" },
  { id: "name", label: "Name" },
];

export function SchoolDirectory() {
  const { ready } = useDeployment();
  const { items, total, isLoading, error, hasMore, loadMore } = useDirectory();
  const [sort, setSort] = useState<Sort>("delivered");
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? items.filter(
          (item) =>
            item.entityName.toLowerCase().includes(needle) ||
            item.profile.displayName.toLowerCase().includes(needle) ||
            item.profile.location.toLowerCase().includes(needle) ||
            item.school.toLowerCase().includes(needle),
        )
      : [...items];

    switch (sort) {
      case "name":
        return filtered.sort((a, b) => a.entityName.localeCompare(b.entityName));
      case "newest":
        return filtered.sort((a, b) => Number(b.verifiedAt - a.verifiedAt));
      case "open":
        return filtered.sort((a, b) => Number(b.stats.openRequests - a.stats.openRequests));
      default:
        return filtered.sort((a, b) => Number(b.stats.totalDisbursed - a.stats.totalDisbursed));
    }
  }, [items, sort, filter]);

  const delivered = useMemo(
    () => items.reduce((sum, item) => sum + item.stats.totalDisbursed, 0n),
    [items],
  );

  if (!ready) return null;
  if (error) return <ErrorState message={error.message} />;
  if (isLoading) return <LoadingList count={4} variant="school" />;

  if (items.length === 0) {
    return (
      <EmptyState title="No institutions are verified yet" icon={<BuildingIcon size={28} />}>
        Verification is proof-of-control: an institution publishes its wallet address somewhere
        the public already trusts, and a threshold of verifiers confirms that the published
        address matches. Until one has, there is nothing to list.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-[0.8125rem] text-ink-muted">
          <span className="tabular font-medium text-ink">{total}</span> verified{" "}
          {total === 1 ? "institution" : "institutions"} ·{" "}
          <span className="tabular font-medium text-delivered">{formatAmount(delivered)}</span>{" "}
          delivered in total
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="school-filter" className="sr-only">
            Filter institutions
          </label>
          <input
            id="school-filter"
            type="search"
            placeholder="Filter by name, place, or address"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="field h-9 min-h-9 py-0 text-[0.8125rem] sm:w-64"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="school-sort" className="shrink-0 text-[0.8125rem] text-ink-muted">
              Sort
            </label>
            <select
              id="school-sort"
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
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing matches that filter">
          Clear the filter to see all {total} verified institutions.
        </EmptyState>
      ) : (
        <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((overview) => (
            <SchoolCard key={overview.school} overview={overview} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={loadMore} className="btn btn-secondary">
            Load more institutions
          </button>
        </div>
      ) : null}
    </div>
  );
}
