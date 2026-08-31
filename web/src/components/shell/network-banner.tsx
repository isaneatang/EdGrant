"use client";

import { useAccount, useChainId } from "wagmi";
import { chainName, faucetUrl, isSupportedChainId, supportedChains } from "@/lib/chains";
import { isDeployedOn, deployedChainIds } from "@/lib/contracts";
import { ExternalIcon, InfoIcon } from "@/components/ui/icons";
import { SwitchNetworkButton } from "./switch-network-button";

/**
 * A single honest line about the network, shown only when something is actually wrong.
 *
 * Three distinct problems, three distinct messages — because "something went wrong" is
 * useless and a screen full of empty state with no explanation is worse.
 */
export function NetworkBanner() {
  const chainId = useChainId();
  const { isConnected, chain } = useAccount();

  // Wallet is on a chain this build does not know at all.
  if (isConnected && !isSupportedChainId(chain?.id)) {
    const target = deployedChainIds()[0] ?? supportedChains[0].id;
    return (
      <Bar tone="fault">
        <span>
          Your wallet is on{" "}
          <strong className="font-medium">{chain?.name ?? `chain ${chain?.id}`}</strong>, which
          EdGrant does not support. Nothing here will read or write correctly.
        </span>
        <SwitchNetworkButton chainId={target} />
      </Bar>
    );
  }

  // Known chain, but no contract addresses recorded for it.
  if (!isDeployedOn(chainId)) {
    const elsewhere = deployedChainIds();
    return (
      <Bar tone="notice">
        <span>
          EdGrant is not deployed on <strong className="font-medium">{chainName(chainId)}</strong>.
          Addresses are recorded in <code className="font-mono text-xs">packages/config/chains.json</code>{" "}
          per chain — this interface never borrows another network&apos;s addresses.
        </span>
        {elsewhere.length > 0 ? (
          <SwitchNetworkButton chainId={elsewhere[0]!} />
        ) : (
          <a
            href="https://faucet.botchain.ai/basic"
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-secondary btn-sm shrink-0"
          >
            Faucet
            <ExternalIcon size={12} />
          </a>
        )}
      </Bar>
    );
  }

  // Deployed and connected, but the wallet is pointed somewhere else than the app reads.
  if (isConnected && chain && chain.id !== chainId) {
    return (
      <Bar tone="notice">
        <span>
          This page is reading <strong className="font-medium">{chainName(chainId)}</strong> while
          your wallet is on <strong className="font-medium">{chain.name}</strong>. Transactions
          will fail until they match.
        </span>
        <SwitchNetworkButton chainId={chainId} />
      </Bar>
    );
  }

  // Testnet notice. Worth stating plainly: the contracts are unaudited.
  const faucet = faucetUrl(chainId);
  const isTestnet = supportedChains.find((c) => c.id === chainId)?.testnet ?? false;
  if (isTestnet) {
    return (
      <Bar tone="neutral">
        <span>
          Test network. The contracts are unaudited and the balances here are not real money.
        </span>
        {faucet ? (
          <a
            href={faucet}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost btn-sm shrink-0"
          >
            Get test tokens
            <ExternalIcon size={12} />
          </a>
        ) : null}
      </Bar>
    );
  }

  return null;
}

function Bar({
  tone,
  children,
}: {
  tone: "neutral" | "notice" | "fault";
  children: React.ReactNode;
}) {
  const style =
    tone === "fault"
      ? "border-fault-rule bg-fault-soft text-fault"
      : tone === "notice"
        ? "border-notice-rule bg-notice-soft text-notice"
        : "border-rule bg-surface-sunken text-ink-muted";

  return (
    <div className={`border-b ${style}`} role="status">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-[0.8125rem] leading-relaxed">
        <InfoIcon size={14} className="shrink-0" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
