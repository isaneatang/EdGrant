import { defineChain, type Chain } from "viem";
import raw from "@config/chains.json";

/**
 * Network parameters come from packages/config/chains.json, which is the single
 * source of truth shared with the contracts side. Nothing here is hardcoded twice.
 *
 * The one rule this file exists to enforce: NEVER fall back from one network to
 * another. BOT Chain's own docs warn about it, and the vault's registry and token
 * are immutable, so a wrong address is unrecoverable. An unconfigured chain reads
 * as "not deployed here" and the interface says so out loud.
 */

type RawNetwork = {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string | null;
  faucetUrl: string | null;
  testnet: boolean;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  contracts: Record<string, string | null>;
  notes?: string;
};

const networks = {
  local: raw.localAnvil as RawNetwork,
  testnet: raw.botchainTestnet as RawNetwork,
  mainnet: raw.botchainMainnet as RawNetwork,
} as const;

function toViemChain(n: RawNetwork) {
  return defineChain({
    id: n.chainId,
    name: n.name,
    nativeCurrency: n.nativeCurrency,
    rpcUrls: { default: { http: [n.rpcUrl] } },
    ...(n.explorerUrl
      ? { blockExplorers: { default: { name: "Explorer", url: n.explorerUrl } } }
      : {}),
    testnet: n.testnet,
    ...(n.contracts.multicall3
      ? { contracts: { multicall3: { address: n.contracts.multicall3 as `0x${string}` } } }
      : {}),
  });
}

export const botchainMainnet = toViemChain(networks.mainnet);
export const botchainTestnet = toViemChain(networks.testnet);
export const localAnvil = toViemChain(networks.local);

/** Every chain this build knows about, whether or not it is currently offered. */
type KnownChain = typeof botchainTestnet | typeof botchainMainnet | typeof localAnvil;

export type SupportedChainId = KnownChain["id"];

/**
 * The local development chain is present ONLY when a local deployment has been
 * configured, which `npm run devchain` does by writing
 * NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID=31337 into web/.env.local.
 *
 * A deployed build has no such value, so anvil is absent from the network list, from
 * the wallet's switch targets, and from every message that names a network, including
 * error states, which is where a development chain would otherwise leak into public
 * view. A throwaway chain is a developer's tool and has no business appearing in front
 * of a donor.
 */
const localChainEnabled =
  Number(process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID ?? "") === localAnvil.id;

const enabledChains: Chain[] = localChainEnabled
  ? [botchainTestnet, botchainMainnet, localAnvil]
  : [botchainTestnet, botchainMainnet];

const envDefaultId = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? "");
const defaultChain = enabledChains.find((c) => c.id === envDefaultId) ?? enabledChains[0]!;

/**
 * The default chain is FIRST, not merely named.
 *
 * wagmi reads `config.chains[0]` whenever no wallet is connected, which is most
 * visitors most of the time. A list whose first entry is not the intended default
 * silently reads the wrong network for them. The screen renders, the calls succeed,
 * and it simply shows an empty feed from a chain nobody meant to query.
 */
export const supportedChains: readonly [Chain, ...Chain[]] = [
  defaultChain,
  ...enabledChains.filter((c) => c.id !== defaultChain.id),
];

export const chainMeta: Record<number, RawNetwork> = {
  [networks.local.chainId]: networks.local,
  [networks.testnet.chainId]: networks.testnet,
  [networks.mainnet.chainId]: networks.mainnet,
};

export const defaultChainId = defaultChain.id as SupportedChainId;

export function isSupportedChainId(id: number | undefined): id is SupportedChainId {
  return id !== undefined && supportedChains.some((c) => c.id === id);
}

export function chainName(id: number | undefined): string {
  if (id === undefined) return "Unknown network";
  return chainMeta[id]?.name ?? `Chain ${id}`;
}

export function explorerUrl(id: number | undefined): string | null {
  if (id === undefined) return null;
  return chainMeta[id]?.explorerUrl ?? null;
}

export function faucetUrl(id: number | undefined): string | null {
  if (id === undefined) return null;
  return chainMeta[id]?.faucetUrl ?? null;
}

/** Explorer deep link, or null when the chain has no explorer (local anvil). */
export function explorerLink(
  chainId: number | undefined,
  kind: "address" | "tx",
  value: string,
): string | null {
  const base = explorerUrl(chainId);
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${kind}/${value}`;
}
