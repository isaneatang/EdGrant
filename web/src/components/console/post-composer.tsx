"use client";

import { useState } from "react";
import { schoolProfileAbi } from "@/lib/abi";
import { contractsFor, PROFILE_LIMITS } from "@/lib/contracts";
import { byteLength } from "@/lib/format";
import { postKindLabel } from "@/lib/request";
import { useDeployment, useMyPosts } from "@/hooks/use-edgrant";
import { useTxRunner } from "@/hooks/use-tx";
import { ConsoleSection, SelectField, TextArea, TextField } from "@/components/console/fields";
import { PostList } from "@/components/schools/post-list";
import { SpinnerIcon } from "@/components/ui/icons";

export function PostComposer() {
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const { posts, postIds } = useMyPosts();
  const publishTx = useTxRunner();
  const visibilityTx = useTxRunner();

  const [kind, setKind] = useState("0");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busyPostId, setBusyPostId] = useState<bigint | null>(null);

  const titleError =
    byteLength(title) > PROFILE_LIMITS.title
      ? `Over the contract limit of ${PROFILE_LIMITS.title} bytes.`
      : null;
  const bodyError =
    byteLength(body) > PROFILE_LIMITS.body
      ? `Over the contract limit of ${PROFILE_LIMITS.body} bytes.`
      : null;
  const ready = title.trim().length > 0 && !titleError && !bodyError;

  if (!contracts) return null;

  return (
    <div className="space-y-6">
      <ConsoleSection
        title="Publish an announcement"
        description="Admissions notices, fee schedules, general updates. Optional, and it changes nothing about how money moves."
      >
        <div className="space-y-4">
          <SelectField
            label="Kind"
            hint="Your own categorisation. It is displayed as a label but is not a verified classification of anything."
            value={kind}
            onChange={setKind}
            options={[0, 1, 2].map((v) => ({ value: String(v), label: postKindLabel(v) }))}
            disabled={publishTx.isBusy}
          />
          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            maxBytes={PROFILE_LIMITS.title}
            placeholder="Semester 2 fee balances published"
            required
            error={titleError}
            disabled={publishTx.isBusy}
          />
          <TextArea
            label="Body"
            value={body}
            onChange={setBody}
            maxBytes={PROFILE_LIMITS.body}
            rows={5}
            placeholder="Outstanding balances are now listed as fee requests on this page."
            error={bodyError}
            disabled={publishTx.isBusy}
          />

          <p className="text-[0.75rem] leading-relaxed text-ink-muted">
            Posts are permanent. You can hide one from the public feed later, but this is a public
            chain. Hiding is not deleting, and the text stays in contract state and in
            transaction history forever. Write accordingly.
          </p>

          <button
            type="button"
            disabled={!ready || publishTx.isBusy}
            onClick={async () => {
              const hash = await publishTx.run({
                address: contracts.profiles,
                abi: schoolProfileAbi,
                functionName: "publishPost",
                args: [Number(kind), title.trim(), body],
                label: "Post",
                success: "Published, and visible on your institution page.",
              });
              if (hash) {
                setTitle("");
                setBody("");
              }
            }}
            className="btn btn-primary w-full sm:w-auto"
          >
            {publishTx.isBusy ? <SpinnerIcon size={15} /> : null}
            {publishTx.stage === "signing"
              ? "Confirm in your wallet…"
              : publishTx.stage === "mining"
                ? "Publishing…"
                : "Publish"}
          </button>

          {publishTx.error ? (
            <p role="alert" className="text-[0.8125rem] leading-relaxed text-fault">
              {publishTx.error}
            </p>
          ) : null}
        </div>
      </ConsoleSection>

      <ConsoleSection
        title="Your posts"
        description="Including any you have hidden from the public feed."
      >
        <PostList
          posts={posts}
          postIds={postIds}
          showVisibility
          busyPostId={busyPostId}
          onToggleVisibility={async (postId, next) => {
            setBusyPostId(postId);
            await visibilityTx.run({
              address: contracts.profiles,
              abi: schoolProfileAbi,
              functionName: "setPostVisibility",
              args: [postId, next],
              label: next ? "Show post" : "Hide post",
              success: next
                ? "The post is back in the public feed."
                : "The post is hidden from the public feed. It still exists on-chain.",
            });
            setBusyPostId(null);
          }}
        />
        {visibilityTx.error ? (
          <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-fault">
            {visibilityTx.error}
          </p>
        ) : null}
      </ConsoleSection>
    </div>
  );
}
