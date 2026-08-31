"use client";

import { useSwitchChain } from "wagmi";
import { chainName, type SupportedChainId } from "@/lib/chains";
import { useToast } from "@/providers/toast";
import { SpinnerIcon } from "@/components/ui/icons";

export function SwitchNetworkButton({
  chainId,
  className = "",
}: {
  chainId: number;
  className?: string;
}) {
  const { switchChain, isPending } = useSwitchChain();
  const { push } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        switchChain(
          { chainId: chainId as SupportedChainId },
          {
            onError: (error) =>
              push({
                tone: "fault",
                title: `Could not switch to ${chainName(chainId)}`,
                body: `${error.message.split("\n")[0]?.slice(0, 160)} — you may need to add this network to your wallet first.`,
              }),
          },
        )
      }
      className={`btn btn-secondary btn-sm shrink-0 ${className}`}
    >
      {isPending ? <SpinnerIcon size={13} /> : null}
      Switch to {chainName(chainId)}
    </button>
  );
}
