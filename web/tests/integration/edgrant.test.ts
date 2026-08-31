/**
 * Integration test: the interface's data layer against a real chain.
 *
 * Everything here goes through the exact ABIs the browser uses (`src/lib/abi`, generated
 * from Foundry artifacts) and the exact derivation the browser uses
 * (`deriveRequestState`). That is the point: the contracts already have 66 Foundry tests
 * covering their own behaviour, so what needs testing on this side is the seam: that the
 * frontend reads the right things, decodes them into the right shapes, and reaches the same
 * verdict about a request that the contract does.
 *
 * It also proves the harder claim the architecture rests on: every screen is answerable
 * with `eth_call` alone. The test asserts that no `eth_getLogs` request is ever made,
 * because the public BOT Chain mainnet RPC restricts them, and an interface that quietly
 * depended on them would work perfectly on testnet and fall over on mainnet.
 *
 * Requires a local node:  npm run anvil
 * Then:                   npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  encodeAbiParameters,
  keccak256,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import {
  edGrantLensAbi,
  educationFundingVaultAbi,
  schoolProfileAbi,
  verifiedEntityRegistryAbi,
  erc20Abi,
} from "@/lib/abi";
import { deriveRequestState, toStudentRef, type FundingRequest, type RequestView } from "@/lib/request";
import { formatAmount, parseAmount } from "@/lib/format";
import { classifyUri } from "@/lib/uri";

const RPC = "http://127.0.0.1:8545";
const USD = 1_000_000n;
const DAY = 86_400n;

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = resolve(here, "..", "..", "..", "contracts");

// Anvil's published default keys. Worthless by construction; local only.
const KEYS = {
  verifierA: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  verifierB: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  school: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  donorA: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  donorB: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  school2: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
} as const;

type Role = keyof typeof KEYS;
const accounts = Object.fromEntries(
  Object.entries(KEYS).map(([role, key]) => [role, privateKeyToAccount(key as Hex)]),
) as Record<Role, ReturnType<typeof privateKeyToAccount>>;

/** Counts every JSON-RPC method the interface's read path touches. */
const rpcCalls = new Map<string, number>();

const countingTransport = custom({
  async request({ method, params }) {
    rpcCalls.set(method, (rpcCalls.get(method) ?? 0) + 1);
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = (await response.json()) as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result;
  },
});

const publicClient = createPublicClient({ chain: foundry, transport: countingTransport });
const rawClient = createPublicClient({ chain: foundry, transport: http(RPC) });

function signer(role: Role) {
  return createWalletClient({ account: accounts[role], chain: foundry, transport: http(RPC) });
}

type Deployment = {
  registry: Address;
  vault: Address;
  profiles: Address;
  lens: Address;
  token: Address;
};

let d: Deployment;

// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WriteRequest = Record<string, any>;

async function send(role: Role, request: WriteRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = await signer(role).writeContract(request as any);
  const receipt = await rawClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`reverted: ${JSON.stringify(request)}`);
  return receipt;
}

async function chainNow(): Promise<bigint> {
  return (await rawClient.getBlock()).timestamp;
}

async function verify(role: Role, name: string, proofURI: string) {
  const fee = await rawClient.readContract({
    address: d.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "verificationFee",
  });
  const id = await rawClient.readContract({
    address: d.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "requestCount",
  });
  await send(role, {
    address: d.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "requestVerification",
    args: [name, 1, proofURI],
    value: fee,
  });
  await send("verifierA", {
    address: d.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "approveRequest",
    args: [id],
  });
  await send("verifierB", {
    address: d.registry,
    abi: verifiedEntityRegistryAbi,
    functionName: "approveRequest",
    args: [id],
  });
  return id;
}

async function createRequest(role: Role, reference: string, goal: bigint, deadline: bigint) {
  const receipt = await send(role, {
    address: d.vault,
    abi: educationFundingVaultAbi,
    functionName: "createRequest",
    args: [toStudentRef(reference), goal, deadline],
  });
  // The same technique the school console uses: read the new id out of our own receipt
  // rather than re-reading a counter that another writer could have moved.
  const logs = parseEventLogs({
    abi: educationFundingVaultAbi,
    eventName: "RequestCreated",
    logs: receipt.logs,
  });
  const id = logs[0]?.args.requestId;
  if (id === undefined) throw new Error("RequestCreated not found in receipt");
  return id;
}

async function contribute(role: Role, requestId: bigint, amount: bigint) {
  await send(role, {
    address: d.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [d.vault, amount],
  });
  await send(role, {
    address: d.vault,
    abi: educationFundingVaultAbi,
    functionName: "contribute",
    args: [requestId, amount],
  });
}

async function mint(role: Role, amount: bigint) {
  await send("verifierA", {
    address: d.token,
    abi: [
      {
        type: "function",
        name: "mint",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
      },
    ] as const,
    functionName: "mint",
    args: [accounts[role].address, amount],
  });
}

/** Reads a request the way the interface does, and derives its state the same way. */
async function readState(requestId: bigint) {
  const summary = (await publicClient.readContract({
    address: d.vault,
    abi: educationFundingVaultAbi,
    functionName: "requestSummary",
    args: [requestId],
  })) as unknown as [
    FundingRequest,
    { pseudonym: string; statement: string },
    Address,
    boolean,
    string,
    string,
    bigint,
    boolean,
  ];

  const [request, context, destination, schoolVerified, schoolName, proofURI, remaining, refundable] =
    summary;

  const state = deriveRequestState(request, {
    schoolVerified,
    nowSeconds: Number(await chainNow()),
    chainRefundable: refundable,
  });

  return { request, context, destination, schoolVerified, schoolName, proofURI, remaining, state };
}

// ---------------------------------------------------------------------------

beforeAll(async () => {
  try {
    await rawClient.getChainId();
  } catch {
    throw new Error(
      `No node on ${RPC}. Start one first:\n\n    cd web && npm run anvil\n`,
    );
  }
  const chainId = await rawClient.getChainId();
  expect(chainId, "integration tests must run against anvil, never a public chain").toBe(31337);

  // Fresh deployment per run, so the assertions do not depend on seeded state.
  const output = execFileSync(
    "forge",
    ["script", "script/SeedDemo.s.sol:SeedDemo", "--rpc-url", RPC, "--broadcast", "-vv"],
    {
      cwd: contractsDir,
      encoding: "utf8",
      env: {
        ...process.env,
        VERIFIER_A_PK: KEYS.verifierA,
        VERIFIER_B_PK: KEYS.verifierB,
        SCHOOL_PK: KEYS.school,
        DONOR_PK: KEYS.donorA,
      },
    },
  );

  const grab = (label: string) => {
    const match = output.match(new RegExp(`^\\s*${label}\\s+(0x[0-9a-fA-F]{40})\\s*$`, "m"));
    if (!match?.[1]) throw new Error(`could not read ${label} from SeedDemo output`);
    return match[1] as Address;
  };

  d = {
    registry: grab("registry"),
    vault: grab("vault"),
    profiles: grab("profiles"),
    lens: grab("lens"),
    token: grab("token"),
  };

  rpcCalls.clear();
});

afterAll(() => {
  const methods = [...rpcCalls.entries()].sort((a, b) => b[1] - a[1]);
  console.error(
    `\n  RPC methods used by the interface's read path:\n${methods
      .map(([m, n]) => `    ${m.padEnd(28)} ${n}`)
      .join("\n")}\n`,
  );
});

// ---------------------------------------------------------------------------

describe("the read path uses view calls only", () => {
  it("answers every screen without a single eth_getLogs", async () => {
    // Exercise one read for each screen, then check what was actually asked of the node.
    await publicClient.readContract({
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "requestCount",
    });
    await publicClient.readContract({
      address: d.lens,
      abi: edGrantLensAbi,
      functionName: "openRequests",
      args: [0n, 50n],
    });
    await publicClient.readContract({
      address: d.lens,
      abi: edGrantLensAbi,
      functionName: "directory",
      args: [0n, 50n],
    });
    await publicClient.readContract({
      address: d.lens,
      abi: edGrantLensAbi,
      functionName: "schoolPage",
      args: [accounts.school.address, 10n],
    });
    await publicClient.readContract({
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "requestSummary",
      args: [0n],
    });
    await publicClient.readContract({
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "requestsByContributor",
      args: [accounts.donorA.address],
    });
    await publicClient.readContract({
      address: d.registry,
      abi: verifiedEntityRegistryAbi,
      functionName: "requestCount",
    });

    expect(rpcCalls.get("eth_getLogs") ?? 0).toBe(0);
    expect(rpcCalls.get("eth_newFilter") ?? 0).toBe(0);
    expect(rpcCalls.get("eth_getFilterLogs") ?? 0).toBe(0);
    expect(rpcCalls.get("eth_call") ?? 0).toBeGreaterThan(0);
  });

  it("returns a whole school page in one round trip", async () => {
    rpcCalls.clear();
    const result = (await publicClient.readContract({
      address: d.lens,
      abi: edGrantLensAbi,
      functionName: "schoolPage",
      args: [accounts.school.address, 10n],
    })) as unknown as [
      { entityName: string; verified: boolean; proofURI: string },
      readonly RequestView[],
      readonly { title: string }[],
    ];

    expect(rpcCalls.get("eth_call")).toBe(1);

    const [overview, open, posts] = result;
    expect(overview.verified).toBe(true);
    expect(overview.entityName).toBe("Riverside Community College");
    expect(classifyUri(overview.proofURI).kind).toBe("http");
    expect(open.length).toBeGreaterThan(0);
    expect(posts.length).toBe(2);
  });
});

describe("the contribution screen's single call carries everything a donor needs", () => {
  it("names the school, its proof, and the disbursement destination", async () => {
    const { destination, schoolVerified, schoolName, proofURI, request } = await readState(0n);

    // The four things the screen must show before a donor signs.
    expect(schoolVerified).toBe(true);
    expect(schoolName).toBe("Riverside Community College");
    expect(classifyUri(proofURI).kind).toBe("http");
    expect(destination).toBe(accounts.school.address);

    // And the destination is the school itself, never a platform wallet, never a student.
    expect(destination).toBe(request.school);
    expect(destination).not.toBe(d.vault);
  });
});

describe("the full lifecycle, as the interface sees it", () => {
  it("open -> fully funded -> delivered, with the destination fixed throughout", async () => {
    const goal = 300n * USD;
    const id = await createRequest("school", "IT-LIFECYCLE-1", goal, (await chainNow()) + 30n * DAY);

    let s = await readState(id);
    expect(s.state.status).toBe("open");
    expect(s.state.canContribute).toBe(true);
    expect(s.state.canRelease).toBe(false);
    expect(s.state.canRefund).toBe(false);
    const destinationAtCreation = s.destination;

    // Two contributors, so the accounting is not trivially one-to-one.
    await mint("donorA", 200n * USD);
    await mint("donorB", 100n * USD);
    await contribute("donorA", id, 200n * USD);

    s = await readState(id);
    expect(s.state.status).toBe("open");
    expect(s.state.remaining).toBe(100n * USD);
    expect(s.state.progress).toBeCloseTo(66.66, 1);

    await contribute("donorB", id, 100n * USD);

    s = await readState(id);
    expect(s.state.status).toBe("fully-funded");
    expect(s.state.canRelease).toBe(true);
    expect(s.state.canContribute).toBe(false);
    expect(s.state.canRefund).toBe(false);
    expect(s.state.remaining).toBe(0n);
    expect(s.state.progress).toBe(100);

    // release() is permissionless: a third party who contributed nothing can call it.
    const schoolBefore = await rawClient.readContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.school.address],
    });

    await send("verifierB", {
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "release",
      args: [id],
    });

    const schoolAfter = await rawClient.readContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.school.address],
    });
    expect(schoolAfter - schoolBefore).toBe(goal);

    s = await readState(id);
    expect(s.state.status).toBe("disbursed");
    expect(s.state.canContribute).toBe(false);
    expect(s.state.canRelease).toBe(false);
    expect(s.state.canRefund).toBe(false);
    // The destination never changed at any point in the lifecycle.
    expect(s.destination).toBe(destinationAtCreation);
    expect(s.destination).toBe(accounts.school.address);
  });

  it("a deadline passing unmet opens individual withdrawals", async () => {
    const id = await createRequest("school", "IT-EXPIRE-1", 900n * USD, (await chainNow()) + DAY + 60n);

    await mint("donorA", 250n * USD);
    await contribute("donorA", id, 150n * USD);
    await mint("donorB", 250n * USD);
    await contribute("donorB", id, 100n * USD);

    expect((await readState(id)).state.status).toBe("open");

    await rawClient.request({ method: "evm_increaseTime", params: [Number(2n * DAY)] } as never);
    await rawClient.request({ method: "evm_mine", params: [] } as never);

    const s = await readState(id);
    expect(s.state.status).toBe("closed-unmet");
    expect(s.state.canRefund).toBe(true);
    expect(s.state.canContribute).toBe(false);
    expect(s.state.canRelease).toBe(false);

    // Each contributor takes back exactly their own contribution. Nothing pooled,
    // nothing swept, no administrator involved.
    const before = await rawClient.readContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.donorA.address],
    });
    await send("donorA", {
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "refund",
      args: [id],
    });
    const after = await rawClient.readContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.donorA.address],
    });
    expect(after - before).toBe(150n * USD);

    // donorB's position is untouched by donorA withdrawing.
    const bStill = await rawClient.readContract({
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "contributionOf",
      args: [id, accounts.donorB.address],
    });
    expect(bStill).toBe(100n * USD);
  });

  it("revocation blocks payout and opens withdrawals immediately, even when fully funded", async () => {
    await verify("school2", "Northgate Technical Institute", "https://example.net/registrar/wallet");
    const goal = 120n * USD;
    const id = await createRequest("school2", "IT-REVOKE-1", goal, (await chainNow()) + 40n * DAY);

    await mint("donorA", goal);
    await contribute("donorA", id, goal);

    let s = await readState(id);
    expect(s.state.status).toBe("fully-funded");
    expect(s.state.canRelease).toBe(true);

    // Threshold is 2, so one confirmation changes nothing yet.
    await send("verifierA", {
      address: d.registry,
      abi: verifiedEntityRegistryAbi,
      functionName: "revokeVerification",
      args: [accounts.school2.address, "integration test"],
    });
    s = await readState(id);
    expect(s.state.status, "one of two confirmations must not revoke").toBe("fully-funded");

    await send("verifierB", {
      address: d.registry,
      abi: verifiedEntityRegistryAbi,
      functionName: "revokeVerification",
      args: [accounts.school2.address, "integration test"],
    });

    s = await readState(id);
    expect(s.state.status).toBe("verification-withdrawn");
    expect(s.state.canRelease).toBe(false);
    expect(s.state.canRefund).toBe(true);
    expect(s.schoolVerified).toBe(false);

    // The interface said release is impossible. Confirm the contract agrees.
    await expect(
      rawClient.simulateContract({
        address: d.vault,
        abi: educationFundingVaultAbi,
        functionName: "release",
        args: [id],
        account: accounts.donorA.address,
      }),
    ).rejects.toThrow();

    // Revocation can only ever return money to the people who sent it.
    const before = await rawClient.readContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.donorA.address],
    });
    await send("donorA", {
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "refund",
      args: [id],
    });
    const after = await rawClient.readContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.donorA.address],
    });
    expect(after - before).toBe(goal);

    // A revoked school's profile stays readable, so a donor can see what was claimed
    // alongside the fact that the badge is gone.
    const overview = (await publicClient.readContract({
      address: d.lens,
      abi: edGrantLensAbi,
      functionName: "schoolOverview",
      args: [accounts.school2.address],
    })) as unknown as { verified: boolean; entityName: string };
    expect(overview.verified).toBe(false);
    expect(overview.entityName).toBe("Northgate Technical Institute");
  });
});

describe("the interface never offers a button the vault will reject", () => {
  it("over-contribution is refused, and the error names the true remainder", async () => {
    const goal = 50n * USD;
    const id = await createRequest("school", "IT-OVERFUND-1", goal, (await chainNow()) + 10n * DAY);

    await mint("donorA", 100n * USD);
    await send("donorA", {
      address: d.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [d.vault, 100n * USD],
    });

    // The form caps input at `remaining` for exactly this reason: the vault reverts rather
    // than trimming, so a donor is never charged an amount they did not choose.
    const attempted = parseAmount("60");
    expect(attempted.ok).toBe(true);
    if (!attempted.ok) return;
    expect(attempted.value > goal).toBe(true);

    await expect(
      rawClient.simulateContract({
        address: d.vault,
        abi: educationFundingVaultAbi,
        functionName: "contribute",
        args: [id, attempted.value],
        account: accounts.donorA.address,
      }),
    ).rejects.toThrow(/ExceedsRemaining/);

    // The permitted amount goes through, and the display of it is exact.
    await send("donorA", {
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "contribute",
      args: [id, goal],
    });
    const s = await readState(id);
    expect(formatAmount(s.request.raised)).toBe("50.00 USDT");
  });

  it("an unverified caller cannot attest a fee balance", async () => {
    await expect(
      rawClient.simulateContract({
        address: d.vault,
        abi: educationFundingVaultAbi,
        functionName: "createRequest",
        args: [toStudentRef("IT-NOT-A-SCHOOL"), 100n * USD, (await chainNow()) + 10n * DAY],
        account: accounts.donorB.address,
      }),
    ).rejects.toThrow(/SchoolNotVerified/);
  });

  it("an unverified caller cannot publish a profile", async () => {
    await expect(
      rawClient.simulateContract({
        address: d.profiles,
        abi: schoolProfileAbi,
        functionName: "setProfile",
        args: ["Impostor College", "", "", "", "", ""],
        account: accounts.donorB.address,
      }),
    ).rejects.toThrow(/NotVerified/);
  });
});

describe("the verifier console's derived state matches the registry", () => {
  it("recomputes the approve op-hash the same way the contract does", async () => {
    // The registry exposes no getter for its internal op-hash, so the console recomputes
    // keccak256(abi.encode("APPROVE", id)) to answer "have I already confirmed this?".
    // `string` and `bytes` share an ABI encoding, so a Solidity string literal and viem's
    // `string` parameter must produce identical bytes, asserted here rather than assumed.
    const id = await (async () => {
      const fee = await rawClient.readContract({
        address: d.registry,
        abi: verifiedEntityRegistryAbi,
        functionName: "verificationFee",
      });
      const next = await rawClient.readContract({
        address: d.registry,
        abi: verifiedEntityRegistryAbi,
        functionName: "requestCount",
      });
      await send("donorB", {
        address: d.registry,
        abi: verifiedEntityRegistryAbi,
        functionName: "requestVerification",
        args: ["Lakeside Girls' Secondary", 1, "https://example.org/payments/edgrant"],
        value: fee,
      });
      return next;
    })();

    const opHash = keccak256(
      encodeAbiParameters([{ type: "string" }, { type: "uint256" }], ["APPROVE", id]),
    );

    expect(
      await publicClient.readContract({
        address: d.registry,
        abi: verifiedEntityRegistryAbi,
        functionName: "hasConfirmed",
        args: [opHash, accounts.verifierA.address],
      }),
    ).toBe(false);

    await send("verifierA", {
      address: d.registry,
      abi: verifiedEntityRegistryAbi,
      functionName: "approveRequest",
      args: [id],
    });

    // If the encoding were wrong this would still read false, and the console would invite
    // a verifier to sign the same confirmation twice.
    expect(
      await publicClient.readContract({
        address: d.registry,
        abi: verifiedEntityRegistryAbi,
        functionName: "hasConfirmed",
        args: [opHash, accounts.verifierA.address],
      }),
    ).toBe(true);

    const [confirmations, required] = (await publicClient.readContract({
      address: d.registry,
      abi: verifiedEntityRegistryAbi,
      functionName: "approvalProgress",
      args: [id],
    })) as unknown as [bigint, bigint];
    expect(confirmations).toBe(1n);
    expect(required).toBe(2n);
  });
});

describe("the school console's reference matcher", () => {
  it("finds a request from the school's own internal identifier, and only that one", async () => {
    const reference = "RCC-MATCHER-9271";
    const id = await createRequest("school", reference, 75n * USD, (await chainNow()) + 12n * DAY);

    const ids = (await publicClient.readContract({
      address: d.vault,
      abi: educationFundingVaultAbi,
      functionName: "requestsBySchool",
      args: [accounts.school.address],
    })) as readonly bigint[];

    const target = toStudentRef(reference);
    const matches: bigint[] = [];
    for (const candidate of ids) {
      const request = (await publicClient.readContract({
        address: d.vault,
        abi: educationFundingVaultAbi,
        functionName: "getRequest",
        args: [candidate],
      })) as unknown as FundingRequest;
      if (request.studentRef.toLowerCase() === target.toLowerCase()) matches.push(candidate);
    }

    expect(matches).toEqual([id]);
    // And the identifier itself is nowhere on-chain, only the commitment to it.
    expect(target).not.toContain("RCC");
  });
});

describe("the feed excludes what a donor must not be invited to fund", () => {
  it("omits disbursed, fully funded, expired, and revoked-school requests", async () => {
    const feed = (await publicClient.readContract({
      address: d.lens,
      abi: edGrantLensAbi,
      functionName: "openRequests",
      args: [0n, 200n],
    })) as unknown as readonly RequestView[];

    for (const view of feed) {
      expect(view.request.disbursed).toBe(false);
      expect(view.request.raised < view.request.goal).toBe(true);
      expect(view.refundable).toBe(false);

      const verified = await publicClient.readContract({
        address: d.registry,
        abi: verifiedEntityRegistryAbi,
        functionName: "isVerified",
        args: [view.request.school],
      });
      expect(verified).toBe(true);

      // And the derivation agrees that each one is contributable.
      const state = deriveRequestState(view.request, {
        schoolVerified: true,
        nowSeconds: Number(await chainNow()),
        chainRefundable: view.refundable,
      });
      expect(state.canContribute).toBe(true);
    }

    // The revoked school from an earlier test must not appear.
    expect(
      feed.some((v) => v.request.school.toLowerCase() === accounts.school2.address.toLowerCase()),
    ).toBe(false);
  });
});
