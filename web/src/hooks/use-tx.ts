"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import type { Abi, Address, Hash, TransactionReceipt } from "viem";
import { explorerLink } from "@/lib/chains";
import { decodeTxError } from "@/lib/errors";
import { useToast } from "@/providers/toast";

export type TxStage = "idle" | "signing" | "mining" | "done" | "error";

export type TxRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  /** Short imperative label, e.g. "Contribute". Used in toasts. */
  label: string;
  /** What just became true, e.g. "175.00 USDT is now held by the vault for this request." */
  success?: string;
};

/**
 * One transaction, from signature to receipt, with the feedback a person needs at each
 * step and no feedback they do not.
 *
 * Every write in this interface goes through here, so the behaviour is uniform:
 *
 *   signing  — the wallet is open. No toast: the wallet is already the notification.
 *   mining   — a toast with the hash and an explorer link, so the tx is never "lost".
 *   done     — a confirmation naming what changed, then affected reads are invalidated.
 *   error    — a decoded, human sentence. A dismissal in the wallet is not an error.
 *
 * `chainId` is left to wagmi's connected chain deliberately. Pinning it here would let a
 * transaction be signed for a network the user is not looking at.
 */
export function useTxRunner() {
  const { mutateAsync: write } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { push, dismiss } = useToast();

  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hash | undefined>();
  const [error, setError] = useState<string | undefined>();

  const reset = useCallback(() => {
    setStage("idle");
    setHash(undefined);
    setError(undefined);
  }, []);

  /**
   * Returns the mined receipt on success, or null on rejection/revert.
   *
   * The receipt rather than just the hash, because a caller sometimes needs a value the
   * transaction produced — `createRequest` returns a new request id, and the honest way to
   * learn it is to decode `RequestCreated` out of this receipt. Re-reading a counter
   * afterwards would race with anyone else writing to the same contract.
   */
  const run = useCallback(
    async (request: TxRequest): Promise<TransactionReceipt | null> => {
      setError(undefined);
      setStage("signing");

      let pendingToast: number | undefined;
      try {
        const txHash = await write({
          address: request.address,
          abi: request.abi,
          functionName: request.functionName,
          args: request.args as never,
          ...(request.value !== undefined ? { value: request.value } : {}),
        });

        setHash(txHash);
        setStage("mining");

        const link = publicClient ? explorerLink(publicClient.chain?.id, "tx", txHash) : null;
        pendingToast = push({
          tone: "neutral",
          title: `${request.label} submitted`,
          body: "Waiting for the block. BOT Chain blocks are about 0.7 seconds.",
          sticky: true,
          ...(link ? { href: link, hrefLabel: "View transaction" } : {}),
        });

        const receipt = await publicClient?.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });

        if (pendingToast !== undefined) dismiss(pendingToast);

        if (receipt && receipt.status === "reverted") {
          setStage("error");
          const message = "The transaction was mined but reverted. Nothing changed on-chain.";
          setError(message);
          push({
            tone: "fault",
            title: `${request.label} reverted`,
            body: message,
            ...(link ? { href: link, hrefLabel: "Inspect transaction" } : {}),
          });
          return null;
        }

        setStage("done");
        push({
          tone: "delivered",
          title: `${request.label} confirmed`,
          ...(request.success ? { body: request.success } : {}),
          ...(link ? { href: link, hrefLabel: "View transaction" } : {}),
        });

        // Chain state moved. Re-read everything rather than surgically patching a
        // cache: every screen here is one or two view calls, so a full refetch is
        // cheap and cannot leave two panels disagreeing about the same request.
        await queryClient.invalidateQueries();
        return receipt ?? null;
      } catch (caught) {
        if (pendingToast !== undefined) dismiss(pendingToast);
        const decoded = decodeTxError(caught);
        setError(decoded.message);
        setStage(decoded.rejected ? "idle" : "error");
        push({
          tone: decoded.rejected ? "neutral" : "fault",
          title: decoded.rejected ? "Request dismissed" : `${request.label} failed`,
          body: decoded.message,
          sticky: !decoded.rejected,
        });
        return null;
      }
    },
    [write, publicClient, push, dismiss, queryClient],
  );

  return {
    run,
    reset,
    stage,
    hash,
    error,
    isBusy: stage === "signing" || stage === "mining",
  };
}
