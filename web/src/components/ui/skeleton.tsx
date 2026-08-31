export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function RequestCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-5 h-1.5 w-full" />
      <div className="mt-4 flex gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SchoolCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-sm" />
        <div className="flex-1">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      </div>
      <Skeleton className="mt-5 h-px w-full" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    </div>
  );
}

export function LoadingList({
  count = 3,
  variant = "request",
}: {
  count?: number;
  variant?: "request" | "school";
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading from the chain…</span>
      {Array.from({ length: count }, (_, i) =>
        variant === "school" ? <SchoolCardSkeleton key={i} /> : <RequestCardSkeleton key={i} />,
      )}
    </div>
  );
}
