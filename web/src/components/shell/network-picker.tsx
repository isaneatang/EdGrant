"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { supportedChains } from "@/lib/chains";
import { isDeployedOn } from "@/lib/contracts";
import { useToast } from "@/providers/toast";

/**
 * Network selector.
 *
 * Every option is labelled with whether EdGrant is actually deployed there. Silently
 * switching to a chain with no contracts, or worse borrowing another chain's addresses,
 * is the one mistake BOT Chain's own docs warn about — and the vault's registry and
 * token are immutable, so a wrong address is unrecoverable.
 */
export function NetworkPicker({ className = "" }: { className?: string }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const { push } = useToast();

  return (
    <select
      value={chainId}
      disabled={isPending}
      onChange={(event) => {
        const next = Number(event.target.value);
        switchChain(
          { chainId: next as (typeof supportedChains)[number]["id"] },
          {
            onError: (error) => {
              push({
                tone: "fault",
                title: "Could not switch network",
                body: isConnected
                  ? `${error.name}: add this network in your wallet first, then try again.`
                  : "Connect a wallet before switching network.",
              });
            },
          },
        );
      }}
      aria-label="Network"
      className={`field h-10 min-h-10 cursor-pointer py-0 pr-8 text-[0.8125rem] ${className}`}
    >
      {supportedChains.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
          {isDeployedOn(chain.id) ? "" : " — not deployed"}
        </option>
      ))}
    </select>
  );
}
