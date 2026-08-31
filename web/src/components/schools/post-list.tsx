"use client";

import { formatDateTime, pluralise } from "@/lib/format";
import { postKindLabel, type Post } from "@/lib/request";
import { Chip } from "@/components/ui/chip";

/**
 * A school's posts. All of it self-asserted, all of it captioned as such.
 *
 * An "Admissions" or "Fee notice" label is the school's own categorisation of its own
 * announcement — it is not a verified classification, and the panel says so. Posts are
 * rendered in a serif face inside a dashed container specifically so they never read with
 * the authority of the evidence panel.
 */
export function PostList({
  posts,
  postIds,
  showVisibility = false,
  onToggleVisibility,
  busyPostId,
}: {
  posts: readonly Post[];
  postIds?: readonly bigint[];
  showVisibility?: boolean;
  onToggleVisibility?: (postId: bigint, next: boolean) => void;
  busyPostId?: bigint | null;
}) {
  if (posts.length === 0) {
    return (
      <p className="text-[0.875rem] leading-relaxed text-ink-muted">
        Nothing published. A school&apos;s announcements are optional and carry no weight in the
        funding mechanism either way.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.75rem] text-ink-faint">
        {posts.length} {pluralise(posts.length, "post")}. Written and categorised by the school.
      </p>
      <ol className="space-y-4">
        {posts.map((post, index) => {
          const id = postIds?.[index];
          const busy = id !== undefined && busyPostId === id;
          return (
            <li
              key={`${post.postedAt.toString()}-${index}`}
              className={`rounded-md border border-dashed px-3.5 py-3 sm:px-4 ${
                post.visible ? "border-rule-strong bg-surface" : "border-rule bg-surface-sunken"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={post.kind === 2 ? "notice" : "neutral"}>
                    {postKindLabel(post.kind)}
                  </Chip>
                  <span className="tabular text-[0.75rem] text-ink-faint">
                    {formatDateTime(post.postedAt)}
                  </span>
                  {!post.visible ? <Chip>Hidden from the public feed</Chip> : null}
                </div>

                {showVisibility && id !== undefined && onToggleVisibility ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleVisibility(id, !post.visible)}
                    className="btn btn-ghost btn-sm"
                  >
                    {busy ? "…" : post.visible ? "Hide" : "Show"}
                  </button>
                ) : null}
              </div>

              <h3 className="mt-2 font-serif text-[1.0625rem] leading-snug font-semibold text-ink-soft">
                {post.title}
              </h3>
              {post.body.trim() ? (
                <p className="asserted-prose mt-1.5 whitespace-pre-wrap">{post.body}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {showVisibility ? (
        <p className="text-[0.75rem] leading-relaxed text-ink-muted">
          Hiding a post removes it from the public feed. It does not delete it. This is a
          public chain, and the content remains in contract state and in transaction history
          permanently. The contract says so rather than offering a delete button that does not
          delete.
        </p>
      ) : null}
    </div>
  );
}
