"use client";

import { useMemo, useState } from "react";
import { useAccount, useBlock, useChainId, useReadContract, useReadContracts } from "wagmi";
import { encodeAbiParameters, keccak256, type Address } from "viem";
import {
  edGrantLensAbi,
  educationFundingVaultAbi,
  erc20Abi,
  schoolProfileAbi,
  verifiedEntityRegistryAbi,
} from "@/lib/abi";
import { contractsFor } from "@/lib/contracts";
import type {
  FundingRequest,
  Post,
  RequestView,
  SchoolOverview,
  StudentContext,
} from "@/lib/request";

/**
 * Every read in the interface goes through this file, and every one of them is an
 * `eth_call`.
 *
 * That is a hard constraint, not a preference. The public BOT Chain mainnet RPC
 * restricts `eth_getLogs`, so an interface that reconstructs state by scanning events
 * works beautifully on testnet and falls over on mainnet. The contracts maintain
 * enumerable state with paginated getters precisely so this is possible, and
 * EdGrantLens exists so a whole page is one round trip instead of dozens.
 *
 * There is not a single log query in this codebase. Keep it that way.
 */

const POLL_MS = 12_000;

function useAddresses() {
  const chainId = useChainId();
  return useMemo(() => ({ chainId, contracts: contractsFor(chainId) }), [chainId]);
}

/** True when this build knows where the contracts live on the connected chain. */
export function useDeployment() {
  const { chainId, contracts } = useAddresses();
  return { chainId, contracts, ready: contracts !== null };
}

/**
 * The chain's own clock, in seconds.
 *
 * Anywhere a value is compared against `block.timestamp` by a contract, deadline bounds in
 * particular, this is the clock that decides whether the call succeeds, not the browser's.
 * A registrar in a skewed timezone, or a local chain whose time has been advanced, would
 * otherwise be offered a closing date the vault then rejects.
 *
 * Returns 0 until the first block is read, which callers should treat as "not known yet".
 */
export function useChainTime() {
  const query = useBlock({ query: { refetchInterval: 30_000 } });
  return Number(query.data?.timestamp ?? 0n);
}

// ---------------------------------------------------------------------------
// Global feed
// ---------------------------------------------------------------------------

export function useRequestCount() {
  const { contracts } = useAddresses();
  return useReadContract({
    address: contracts?.vault,
    abi: educationFundingVaultAbi,
    functionName: "requestCount",
    query: { enabled: Boolean(contracts), refetchInterval: POLL_MS },
  });
}

const FEED_PAGE = 24;

/**
 * The global feed, newest first.
 *
 * `lens.openRequests(offset, limit)` walks ids upward, so to show newest-first without
 * pulling the entire history we walk a window backwards from the end and extend it when
 * the reader asks for more. Nothing is fetched that is not about to be rendered.
 */
export function useOpenRequestsFeed() {
  const { contracts } = useAddresses();
  const countQuery = useRequestCount();
  const [windows, setWindows] = useState(1);

  const total = Number(countQuery.data ?? 0n);
  const span = Math.min(total, FEED_PAGE * windows);
  const offset = Math.max(0, total - span);

  const query = useReadContract({
    address: contracts?.lens,
    abi: edGrantLensAbi,
    functionName: "openRequests",
    args: [BigInt(offset), BigInt(span)],
    query: {
      enabled: Boolean(contracts) && countQuery.isSuccess && total > 0,
      refetchInterval: POLL_MS,
    },
  });

  const items = useMemo(() => {
    const page = (query.data ?? []) as readonly RequestView[];
    // Lens returns ascending by id; a feed reads newest first.
    return [...page].reverse();
  }, [query.data]);

  return {
    items,
    total,
    isLoading: countQuery.isLoading || (total > 0 && query.isLoading),
    isFetching: query.isFetching,
    error: countQuery.error ?? query.error,
    hasMore: offset > 0,
    loadMore: () => setWindows((w) => w + 1),
    refetch: () => {
      void countQuery.refetch();
      void query.refetch();
    },
  };
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export function useVerifiedCount() {
  const { contracts } = useAddresses();
  return useReadContract({
    address: contracts?.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "verifiedCount",
    query: { enabled: Boolean(contracts), refetchInterval: POLL_MS },
  });
}

const DIRECTORY_PAGE = 12;

export function useDirectory() {
  const { contracts } = useAddresses();
  const countQuery = useVerifiedCount();
  const [pages, setPages] = useState(1);

  const total = Number(countQuery.data ?? 0n);
  const limit = Math.min(total, DIRECTORY_PAGE * pages);

  const query = useReadContract({
    address: contracts?.lens,
    abi: edGrantLensAbi,
    functionName: "directory",
    args: [0n, BigInt(limit)],
    query: {
      enabled: Boolean(contracts) && countQuery.isSuccess && total > 0,
      refetchInterval: POLL_MS,
    },
  });

  return {
    items: (query.data ?? []) as readonly SchoolOverview[],
    total,
    isLoading: countQuery.isLoading || (total > 0 && query.isLoading),
    error: countQuery.error ?? query.error,
    hasMore: limit < total,
    loadMore: () => setPages((p) => p + 1),
  };
}

// ---------------------------------------------------------------------------
// School page: one call, by design
// ---------------------------------------------------------------------------

export type SchoolPage = {
  overview: SchoolOverview;
  open: readonly RequestView[];
  posts: readonly Post[];
};

export function useSchoolPage(school: Address | undefined, postLimit = 10) {
  const { contracts } = useAddresses();
  const query = useReadContract({
    address: contracts?.lens,
    abi: edGrantLensAbi,
    functionName: "schoolPage",
    args: school ? [school, BigInt(postLimit)] : undefined,
    query: {
      enabled: Boolean(contracts && school),
      refetchInterval: POLL_MS,
    },
  });

  const page = useMemo<SchoolPage | undefined>(() => {
    if (!query.data) return undefined;
    const [overview, open, posts] = query.data as unknown as [
      SchoolOverview,
      readonly RequestView[],
      readonly Post[],
    ];
    return { overview, open, posts };
  }, [query.data]);

  return { page, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

/** All of a school's requests, not just the open ones. Used by the school's own console. */
export function useSchoolRequests(school: Address | undefined, limit = 100) {
  const { contracts } = useAddresses();
  const query = useReadContract({
    address: contracts?.lens,
    abi: edGrantLensAbi,
    functionName: "requestsOf",
    args: school ? [school, 0n, BigInt(limit)] : undefined,
    query: { enabled: Boolean(contracts && school), refetchInterval: POLL_MS },
  });

  const items = useMemo(() => {
    const page = (query.data ?? []) as readonly RequestView[];
    return [...page].reverse();
  }, [query.data]);

  return { items, isLoading: query.isLoading, error: query.error };
}

// ---------------------------------------------------------------------------
// Single request: the contribution screen
// ---------------------------------------------------------------------------

export type RequestSummary = {
  request: FundingRequest;
  context: StudentContext;
  disbursementDestination: Address;
  schoolVerified: boolean;
  schoolName: string;
  schoolProofURI: string;
  remaining: bigint;
  refundable: boolean;
};

/**
 * `requestSummary` was designed for the contribution screen specifically: verification
 * status, the school's registered name, the proof URI, and the disbursement destination,
 * all in one call, so a donor sees where the money goes before they sign.
 */
export function useRequestSummary(requestId: bigint | undefined) {
  const { contracts } = useAddresses();
  const query = useReadContract({
    address: contracts?.vault,
    abi: educationFundingVaultAbi,
    functionName: "requestSummary",
    args: requestId === undefined ? undefined : [requestId],
    query: {
      enabled: Boolean(contracts) && requestId !== undefined,
      refetchInterval: POLL_MS,
      retry: false,
    },
  });

  const summary = useMemo<RequestSummary | undefined>(() => {
    if (!query.data) return undefined;
    const [
      request,
      context,
      disbursementDestination,
      schoolVerified,
      schoolName,
      schoolProofURI,
      remaining,
      refundable,
    ] = query.data as unknown as [
      FundingRequest,
      StudentContext,
      Address,
      boolean,
      string,
      string,
      bigint,
      boolean,
    ];
    return {
      request,
      context,
      disbursementDestination,
      schoolVerified,
      schoolName,
      schoolProofURI,
      remaining,
      refundable,
    };
  }, [query.data]);

  return { summary, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

export function useContributorCount(requestId: bigint | undefined) {
  const { contracts } = useAddresses();
  return useReadContract({
    address: contracts?.vault,
    abi: educationFundingVaultAbi,
    functionName: "contributorCount",
    args: requestId === undefined ? undefined : [requestId],
    query: { enabled: Boolean(contracts) && requestId !== undefined, refetchInterval: POLL_MS },
  });
}

export function useMyContribution(requestId: bigint | undefined) {
  const { contracts } = useAddresses();
  const { address } = useAccount();
  return useReadContract({
    address: contracts?.vault,
    abi: educationFundingVaultAbi,
    functionName: "contributionOf",
    args: requestId !== undefined && address ? [requestId, address] : undefined,
    query: {
      enabled: Boolean(contracts && address) && requestId !== undefined,
      refetchInterval: POLL_MS,
    },
  });
}

// ---------------------------------------------------------------------------
// Token: balance and allowance. Two-step approve + contribute (USDT has no permit).
// ---------------------------------------------------------------------------

export function useTokenState() {
  const { contracts } = useAddresses();
  const { address } = useAccount();

  const query = useReadContracts({
    allowFailure: false,
    contracts:
      contracts && address
        ? [
            {
              address: contracts.token,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            },
            {
              address: contracts.token,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address, contracts.vault],
            },
          ]
        : [],
    query: { enabled: Boolean(contracts && address), refetchInterval: POLL_MS },
  });

  const [balance, allowance] = (query.data ?? [undefined, undefined]) as [
    bigint | undefined,
    bigint | undefined,
  ];

  return {
    balance,
    allowance,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ---------------------------------------------------------------------------
// A contributor's own position: what they gave, and what they can withdraw
// ---------------------------------------------------------------------------

export type ContributionRow = {
  requestId: bigint;
  request: FundingRequest;
  context: StudentContext;
  contributed: bigint;
  schoolVerified: boolean;
  schoolName: string;
  /**
   * The vault's own verdict on whether `refund` would succeed.
   *
   * Carried through rather than recomputed from a deadline and the browser clock. This is
   * the page where someone comes to get their money back, so deciding "is this
   * withdrawable?" from a clock that is not the one the contract uses would be the worst
   * possible place to be wrong.
   */
  refundable: boolean;
};

export function useMyContributions() {
  const { contracts } = useAddresses();
  const { address } = useAccount();

  const idsQuery = useReadContract({
    address: contracts?.vault,
    abi: educationFundingVaultAbi,
    functionName: "requestsByContributor",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contracts && address), refetchInterval: POLL_MS },
  });

  const ids = useMemo(() => ((idsQuery.data ?? []) as readonly bigint[]).slice().reverse(), [
    idsQuery.data,
  ]);

  const detailQuery = useReadContracts({
    allowFailure: false,
    contracts:
      contracts && address && ids.length > 0
        ? ids.flatMap((id) => [
            {
              address: contracts.vault,
              abi: educationFundingVaultAbi,
              functionName: "requestSummary",
              args: [id],
            } as const,
            {
              address: contracts.vault,
              abi: educationFundingVaultAbi,
              functionName: "contributionOf",
              args: [id, address],
            } as const,
          ])
        : [],
    query: { enabled: Boolean(contracts && address) && ids.length > 0, refetchInterval: POLL_MS },
  });

  const rows = useMemo<ContributionRow[]>(() => {
    const data = detailQuery.data as unknown[] | undefined;
    if (!data) return [];
    const out: ContributionRow[] = [];
    ids.forEach((id, index) => {
      const summary = data[index * 2] as
        | [FundingRequest, StudentContext, Address, boolean, string, string, bigint, boolean]
        | undefined;
      const contributed = data[index * 2 + 1] as bigint | undefined;
      if (!summary || contributed === undefined) return;
      out.push({
        requestId: id,
        request: summary[0],
        context: summary[1],
        contributed,
        schoolVerified: summary[3],
        schoolName: summary[4],
        refundable: summary[7],
      });
    });
    return out;
  }, [detailQuery.data, ids]);

  return {
    rows,
    isLoading: idsQuery.isLoading || (ids.length > 0 && detailQuery.isLoading),
    error: idsQuery.error ?? detailQuery.error,
    hasAny: ids.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Registry: identity
// ---------------------------------------------------------------------------

export type Entity = {
  name: string;
  proofURI: string;
  entityType: number;
  verifiedAt: bigint;
  verifiedBy: Address;
  active: boolean;
};

export function useEntity(account: Address | undefined) {
  const { contracts } = useAddresses();
  const query = useReadContract({
    address: contracts?.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "entityOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(contracts && account), refetchInterval: POLL_MS },
  });
  return {
    entity: query.data as Entity | undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useVerificationFee() {
  const { contracts } = useAddresses();
  return useReadContract({
    address: contracts?.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "verificationFee",
    query: { enabled: Boolean(contracts), staleTime: Infinity },
  });
}

export type SchoolIdentity = {
  address: Address;
  verified: boolean;
  entityName: string;
  proofURI: string;
  entityType: number;
  verifiedAt: bigint;
};

/**
 * Registered names for a set of school addresses, in one batch.
 *
 * The lens's request feeds return `request.school` but not the school's registered name,
 * and a feed that shows only a hex address buries the single most useful trust signal a
 * donor has. So the feed resolves identities separately, deduplicated, so a school with
 * eight open requests costs one call, not eight.
 *
 * These are registry facts. They are safe to render with authority. Anything from
 * SchoolProfile is not, and is never mixed in here.
 */
export function useSchoolIdentities(addresses: readonly Address[]) {
  const { contracts } = useAddresses();

  const unique = useMemo(() => {
    const seen = new Set<string>();
    const out: Address[] = [];
    for (const address of addresses) {
      const key = address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(address);
    }
    return out;
  }, [addresses]);

  const query = useReadContracts({
    allowFailure: false,
    contracts:
      contracts && unique.length > 0
        ? unique.map(
            (account) =>
              ({
                address: contracts.registry,
                abi: verifiedEntityRegistryAbi,
                functionName: "entityOf",
                args: [account],
              }) as const,
          )
        : [],
    query: { enabled: Boolean(contracts) && unique.length > 0, refetchInterval: POLL_MS },
  });

  const identities = useMemo(() => {
    const map = new Map<string, SchoolIdentity>();
    const data = query.data as readonly Entity[] | undefined;
    if (!data) return map;
    unique.forEach((account, index) => {
      const entity = data[index];
      if (!entity) return;
      map.set(account.toLowerCase(), {
        address: account,
        verified: entity.active,
        entityName: entity.name,
        proofURI: entity.proofURI,
        entityType: entity.entityType,
        verifiedAt: entity.verifiedAt,
      });
    });
    return map;
  }, [query.data, unique]);

  return { identities, isLoading: query.isLoading, error: query.error };
}

/** Verifier-set state. Threshold and count are what make m-of-n legible. */
export function useRegistryGovernance() {
  const { contracts } = useAddresses();
  const { address } = useAccount();

  const query = useReadContracts({
    allowFailure: false,
    contracts: contracts
      ? [
          { address: contracts.registry, abi: verifiedEntityRegistryAbi, functionName: "threshold" },
          {
            address: contracts.registry,
            abi: verifiedEntityRegistryAbi,
            functionName: "verifierCount",
          },
          { address: contracts.registry, abi: verifiedEntityRegistryAbi, functionName: "verifiers" },
          {
            address: contracts.registry,
            abi: verifiedEntityRegistryAbi,
            functionName: "isVerifier",
            args: [address ?? "0x0000000000000000000000000000000000000000"],
          },
        ]
      : [],
    query: { enabled: Boolean(contracts), refetchInterval: POLL_MS },
  });

  const [threshold, verifierCount, verifiers, iAmVerifier] = (query.data ?? []) as [
    bigint | undefined,
    bigint | undefined,
    readonly Address[] | undefined,
    boolean | undefined,
  ];

  return {
    threshold,
    verifierCount,
    verifiers: verifiers ?? [],
    iAmVerifier: Boolean(iAmVerifier) && Boolean(address),
    isLoading: query.isLoading,
    error: query.error,
  };
}

export type Application = {
  id: bigint;
  applicant: Address;
  name: string;
  proofURI: string;
  entityType: number;
  feePaid: bigint;
  submittedAt: bigint;
  status: number;
  confirmations: bigint;
  required: bigint;
  iConfirmed: boolean;
};

/**
 * Every verification application, newest first, with confirmation progress.
 *
 * Read by enumerating `requestCount` and calling `getRequest` per id, never by scanning
 * `VerificationRequested` events. Same reason as everywhere else: the mainnet RPC
 * restricts log queries, and a verifier console that cannot list pending work is useless
 * exactly when it matters.
 */
export function useApplications(limit = 60) {
  const { contracts } = useAddresses();
  const { address } = useAccount();

  const countQuery = useReadContract({
    address: contracts?.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "requestCount",
    query: { enabled: Boolean(contracts), refetchInterval: POLL_MS },
  });

  const total = Number(countQuery.data ?? 0n);
  const ids = useMemo(() => {
    const start = Math.max(0, total - limit);
    const out: bigint[] = [];
    for (let i = total - 1; i >= start; i--) out.push(BigInt(i));
    return out;
  }, [total, limit]);

  const detailQuery = useReadContracts({
    allowFailure: false,
    contracts:
      contracts && ids.length > 0
        ? ids.flatMap((id) => [
            {
              address: contracts.registry,
              abi: verifiedEntityRegistryAbi,
              functionName: "getRequest",
              args: [id],
            } as const,
            {
              address: contracts.registry,
              abi: verifiedEntityRegistryAbi,
              functionName: "approvalProgress",
              args: [id],
            } as const,
          ])
        : [],
    query: { enabled: Boolean(contracts) && ids.length > 0, refetchInterval: POLL_MS },
  });

  // "Have I already confirmed this?" is a separate read because the op-hash is
  // computed the same way the contract does it: keccak256(abi.encode("APPROVE", id)).
  const confirmedQuery = useReadContracts({
    allowFailure: false,
    contracts:
      contracts && address && ids.length > 0
        ? ids.map(
            (id) =>
              ({
                address: contracts.registry,
                abi: verifiedEntityRegistryAbi,
                functionName: "hasConfirmed",
                args: [approveOpHash(id), address],
              }) as const,
          )
        : [],
    query: { enabled: Boolean(contracts && address) && ids.length > 0, refetchInterval: POLL_MS },
  });

  const applications = useMemo<Application[]>(() => {
    const data = detailQuery.data as unknown[] | undefined;
    if (!data) return [];
    const confirmed = (confirmedQuery.data ?? []) as readonly boolean[];
    const out: Application[] = [];
    ids.forEach((id, index) => {
      const request = data[index * 2] as
        | {
            applicant: Address;
            name: string;
            proofURI: string;
            entityType: number;
            feePaid: bigint;
            submittedAt: bigint;
            status: number;
          }
        | undefined;
      const progress = data[index * 2 + 1] as readonly [bigint, bigint] | undefined;
      if (!request || !progress) return;
      out.push({
        id,
        applicant: request.applicant,
        name: request.name,
        proofURI: request.proofURI,
        entityType: request.entityType,
        feePaid: request.feePaid,
        submittedAt: request.submittedAt,
        status: request.status,
        confirmations: progress[0],
        required: progress[1],
        iConfirmed: confirmed[index] ?? false,
      });
    });
    return out;
  }, [detailQuery.data, confirmedQuery.data, ids]);

  return {
    applications,
    total,
    isLoading: countQuery.isLoading || (ids.length > 0 && detailQuery.isLoading),
    error: countQuery.error ?? detailQuery.error,
  };
}

/**
 * Mirrors `VerifiedEntityRegistry._approveOpHash`: keccak256(abi.encode("APPROVE", id)).
 *
 * Recomputed here rather than read from the contract because the registry exposes no
 * getter for it. `string` and `bytes` share an ABI encoding, so a Solidity string
 * literal and viem's `string` parameter produce identical bytes. The integration test
 * asserts this against a live registry rather than trusting the reasoning.
 */
function approveOpHash(requestId: bigint): `0x${string}` {
  return keccak256(
    encodeAbiParameters([{ type: "string" }, { type: "uint256" }], ["APPROVE", requestId]),
  );
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export function useMyProfile() {
  const { contracts } = useAddresses();
  const { address } = useAccount();
  const query = useReadContract({
    address: contracts?.profiles,
    abi: schoolProfileAbi,
    functionName: "profileOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contracts && address) },
  });
  return { profile: query.data, isLoading: query.isLoading, refetch: query.refetch };
}

/** The school's own management view: includes posts it has hidden from the public feed. */
export function useMyPosts(limit = 30) {
  const { contracts } = useAddresses();
  const { address } = useAccount();
  const query = useReadContract({
    address: contracts?.profiles,
    abi: schoolProfileAbi,
    functionName: "recentPosts",
    args: address ? [address, 0n, BigInt(limit), true] : undefined,
    query: { enabled: Boolean(contracts && address), refetchInterval: POLL_MS },
  });

  const [posts, postIds] = (query.data ?? [[], []]) as [readonly Post[], readonly bigint[]];
  return { posts, postIds, isLoading: query.isLoading, error: query.error };
}
