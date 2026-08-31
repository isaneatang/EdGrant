import { isAddress, getAddress } from "viem";
import raw from "@config/chains.json";
import { localAnvil, botchainTestnet, botchainMainnet } from "./chains";

/**
 * Where the deployed addresses come from, in priority order:
 *
 *   1. NEXT_PUBLIC_*_ADDRESS in web/.env.local, scoped to NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID.
 *      `npm run devchain` writes these for the local anvil deployment, and a developer can
 *      point at a one-off deployment the same way.
 *   2. packages/config/chains.json, the reviewed, committed record of real deployments.
 *
 * Two mechanisms, no third. An earlier version also read a generated JSON file, which was
 * gitignored and therefore broke a fresh clone at build time; .env.local is gitignored
 * already and needs no import.
 *
 * If a chain resolves to nothing, `contractsFor` returns null and every screen says
 * "not deployed on this network" rather than silently reading zero state or, worse,
 * borrowing another chain's addresses.
 */

export type ContractSet = {
  registry: `0x${string}`;
  vault: `0x${string}`;
  profiles: `0x${string}`;
  lens: `0x${string}`;
  token: `0x${string}`;
};

type Slot = keyof ContractSet;

const JSON_KEYS: Record<Slot, string> = {
  registry: "verifiedEntityRegistry",
  vault: "educationFundingVault",
  profiles: "schoolProfile",
  lens: "edGrantLens",
  token: "usdt",
};

const ENV_ADDRESSES: Partial<Record<Slot, string | undefined>> = {
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS,
  profiles: process.env.NEXT_PUBLIC_PROFILE_ADDRESS,
  lens: process.env.NEXT_PUBLIC_LENS_ADDRESS,
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
};

/** Env overrides apply only to the chain they were declared for. */
const ENV_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID ?? "");

const JSON_BY_CHAIN: Record<number, Record<string, string | null>> = {
  [localAnvil.id]: raw.localAnvil.contracts,
  [botchainTestnet.id]: raw.botchainTestnet.contracts,
  [botchainMainnet.id]: raw.botchainMainnet.contracts,
};

function normalise(value: string | null | undefined): `0x${string}` | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) return null;
  const checksummed = getAddress(trimmed);
  if (checksummed === "0x0000000000000000000000000000000000000000") return null;
  return checksummed;
}

function resolveSlot(chainId: number, slot: Slot): `0x${string}` | null {
  if (chainId === ENV_CHAIN_ID) {
    const fromEnv = normalise(ENV_ADDRESSES[slot]);
    if (fromEnv) return fromEnv;
  }
  return normalise(JSON_BY_CHAIN[chainId]?.[JSON_KEYS[slot]]);
}

const cache = new Map<number, ContractSet | null>();

/** Returns the full contract set for a chain, or null when the app is not deployed there. */
export function contractsFor(chainId: number | undefined): ContractSet | null {
  if (chainId === undefined) return null;
  if (cache.has(chainId)) return cache.get(chainId) ?? null;

  const slots: Slot[] = ["registry", "vault", "profiles", "lens", "token"];
  const resolved: Partial<ContractSet> = {};
  for (const slot of slots) {
    const address = resolveSlot(chainId, slot);
    // All-or-nothing on purpose. A half-configured chain is the failure mode most
    // likely to point a contribution at the wrong place.
    if (!address) {
      cache.set(chainId, null);
      return null;
    }
    resolved[slot] = address;
  }

  const set = resolved as ContractSet;
  cache.set(chainId, set);
  return set;
}

export function isDeployedOn(chainId: number | undefined): boolean {
  return contractsFor(chainId) !== null;
}

/** Chains this build actually has addresses for. */
export function deployedChainIds(): number[] {
  return [localAnvil.id, botchainTestnet.id, botchainMainnet.id].filter(isDeployedOn);
}

/** USDT on BOT Chain is 6 decimals. Verified live on both networks. */
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "USDT";

/** Mirrors EducationFundingVault.MIN_DURATION / MAX_DURATION. */
export const MIN_DURATION_SECONDS = 24 * 60 * 60;
export const MAX_DURATION_SECONDS = 365 * 24 * 60 * 60;

/** Mirrors SchoolProfile's on-chain length bounds so the form can fail before gas is spent. */
export const PROFILE_LIMITS = {
  short: 128,
  uri: 512,
  description: 4096,
  title: 256,
  body: 8192,
} as const;
