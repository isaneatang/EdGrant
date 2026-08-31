import { defineChain } from "viem";
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

/**
 * Ordered most-likely-first. Local sits first because nothing is deployed to the
 * public networks yet; once it is, move the intended default to the front or set
 * NEXT_PUBLIC_DEFAULT_CHAIN_ID.
 */
export const supportedChains = [localAnvil, botchainTestnet, botchainMainnet] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

export const chainMeta: Record<number, RawNetwork> = {
  [networks.local.chainId]: networks.local,
  [networks.testnet.chainId]: networks.testnet,
  [networks.mainnet.chainId]: networks.mainnet,
};

const envDefault = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? "");

export const defaultChainId: SupportedChainId = supportedChains.some((c) => c.id === envDefault)
  ? (envDefault as SupportedChainId)
  : localAnvil.id;

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
