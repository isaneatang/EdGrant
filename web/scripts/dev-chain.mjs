#!/usr/bin/env node
/**
 * Stands up a complete, interactive EdGrant on a local anvil.
 *
 *   npm run anvil      # in one terminal
 *   npm run devchain   # in another
 *
 * What it produces, and why each piece is there:
 *
 *   two verified schools            so the directory has something to compare
 *   a paid-out request              so `totalDisbursed` is non-zero, which is the
 *                                   headline trust signal and the one number a donor
 *                                   should weigh most
 *   a partially funded request      the ordinary case
 *   a request with no student text  proof the mechanism works when a student shares
 *                                   nothing at all
 *   an expired, refundable request  the refund path, reachable without waiting a day
 *   a pending application           so the verifier console has real work in it
 *   one already half-confirmed      so m-of-n can be completed in a single click
 *
 * Everything runs from anvil's default accounts, whose keys are published in Foundry's
 * own documentation. They are worthless by construction, and this script only ever talks
 * to 127.0.0.1. It refuses to run against anything else.
 */
import { spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "..");
const contractsDir = join(repoRoot, "contracts");
const RPC = "http://127.0.0.1:8545";
const USD = 1_000_000n;

// Anvil's default derivation. Publicly known — see Foundry's docs. Local use only.
const KEYS = {
  verifierA: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  verifierB: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  schoolA: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  donor: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  schoolB: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  schoolC: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  donor2: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
};

const accounts = Object.fromEntries(
  Object.entries(KEYS).map(([name, key]) => [name, privateKeyToAccount(key)]),
);

// Explicit timeouts: a dead node should fail loudly in seconds, not hang the script.
const transport = http(RPC, { timeout: 20_000, retryCount: 2 });
const publicClient = createPublicClient({ chain: foundry, transport });

function wallet(name) {
  return createWalletClient({ account: accounts[name], chain: foundry, transport });
}

const log = (...args) => process.stdout.write(`${args.join(" ")}\n`);
const step = (msg) => log(`\n\x1b[1m▸ ${msg}\x1b[0m`);
const ok = (msg) => log(`  \x1b[32m✓\x1b[0m ${msg}`);
const note = (msg) => log(`  \x1b[2m${msg}\x1b[0m`);

// ---------------------------------------------------------------------------

async function main() {
  step("Checking for anvil on 127.0.0.1:8545");
  if (!(await reachable())) {
    throw new Error(
      "No node on 127.0.0.1:8545.\n" +
        "  Start one in another terminal, then re-run this:\n\n" +
        "    npm run anvil\n",
    );
  }
  ok("reachable");

  const chainId = await publicClient.getChainId();
  if (chainId !== 31337) {
    throw new Error(
      `Refusing to seed: 127.0.0.1:8545 reports chain ${chainId}, not anvil's 31337.`,
    );
  }

  step("Building contracts");
  run("forge", ["build"], contractsDir);
  ok("forge build");

  step("Deploying and seeding the base demo (script/SeedDemo.s.sol)");
  const addresses = deploySeed();
  for (const [k, v] of Object.entries(addresses)) note(`${k.padEnd(9)} ${v}`);

  const abis = await loadAbis();
  const ctx = { ...addresses, abis };

  step("Verifying a second institution (2-of-2 confirmations)");
  await verifySchool(ctx, "schoolB", {
    name: "Northgate Technical Institute",
    proofURI: "https://example.net/registrar/edgrant-wallet-notice",
    type: 1,
  });
  ok(`${accounts.schoolB.address} verified`);

  step("Second institution publishes a profile and a fee notice");
  await publishProfileB(ctx);
  ok("profile + 1 post");

  step("Attesting fee balances for the second institution");
  const bIds = await createRequestsB(ctx);
  ok(`requests ${bIds.join(", ")}`);

  step("Funding one balance to completion and releasing it to the school");
  const delivered = await fundAndRelease(ctx);
  ok(`request ${delivered.id} paid ${delivered.amount / USD} USDT directly to the school`);

  step("Adding a second contributor to an open balance");
  await secondDonor(ctx);
  ok("two distinct contributors on one request");

  step("Creating a balance that will expire, then advancing the chain past it");
  const expired = await createExpiring(ctx);
  ok(`request ${expired} is now closed unmet and refundable`);

  step("Leaving verification applications pending for the verifier console");
  const pending = await leavePendingApplications(ctx);
  ok(`application ${pending.fresh} at 0-of-2, application ${pending.half} at 1-of-2`);

  step("Writing addresses for the interface");
  await writeDeployments(addresses);
  ok("web/.env.local  (restart `npm run dev` to pick it up)");

  await report(ctx);
}

// ---------------------------------------------------------------------------
// anvil
// ---------------------------------------------------------------------------

async function reachable() {
  try {
    await publicClient.getChainId();
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, cwd, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${cmd} ${args.join(" ")} failed with status ${result.status}`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function deploySeed() {
  const output = run(
    "forge",
    [
      "script",
      "script/SeedDemo.s.sol:SeedDemo",
      "--rpc-url",
      RPC,
      "--broadcast",
      "--slow",
      "-vv",
    ],
    contractsDir,
    {
      VERIFIER_A_PK: KEYS.verifierA,
      VERIFIER_B_PK: KEYS.verifierB,
      SCHOOL_PK: KEYS.schoolA,
      DONOR_PK: KEYS.donor,
    },
  );

  const grab = (label) => {
    const match = output.match(new RegExp(`^\\s*${label}\\s+(0x[0-9a-fA-F]{40})\\s*$`, "m"));
    if (!match) {
      process.stderr.write(output);
      throw new Error(`Could not find the ${label} address in the SeedDemo output.`);
    }
    return match[1];
  };

  return {
    registry: grab("registry"),
    vault: grab("vault"),
    profiles: grab("profiles"),
    lens: grab("lens"),
    token: grab("token"),
  };
}

async function loadAbis() {
  const read = async (name) => {
    const mod = await import(join(contractsDir, "out", `${name}.sol`, `${name}.json`), {
      with: { type: "json" },
    });
    return mod.default.abi;
  };
  return {
    registry: await read("VerifiedEntityRegistry"),
    vault: await read("EducationFundingVault"),
    profiles: await read("SchoolProfile"),
    lens: await read("EdGrantLens"),
    token: await read("MockUSDT"),
  };
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function send(signer, request) {
  const hash = await wallet(signer).writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${request.functionName} reverted (tx ${hash})`);
  }
  return receipt;
}

async function applyForVerification(ctx, schoolKey, meta) {
  const fee = await publicClient.readContract({
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "verificationFee",
  });

  const id = await publicClient.readContract({
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "requestCount",
  });

  await send(schoolKey, {
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "requestVerification",
    args: [meta.name, meta.type, meta.proofURI],
    value: fee,
  });

  return id;
}

async function verifySchool(ctx, schoolKey, meta) {
  const id = await applyForVerification(ctx, schoolKey, meta);
  await send("verifierA", {
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "approveRequest",
    args: [id],
  });
  await send("verifierB", {
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "approveRequest",
    args: [id],
  });

  const verified = await publicClient.readContract({
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "isVerified",
    args: [accounts[schoolKey].address],
  });
  if (!verified) throw new Error(`${schoolKey} did not end up verified`);
  return id;
}

async function publishProfileB(ctx) {
  await send("schoolB", {
    address: ctx.profiles,
    abi: ctx.abis.profiles,
    functionName: "setProfile",
    args: [
      "Northgate Technical Institute",
      "",
      "",
      "A technical institute offering two- and three-year diplomas in engineering trades, " +
        "surveying, and applied computing. Everything on this profile was written by the " +
        "institute and is verified by nobody — the badge and its proof link are the only evidence.",
      "https://example.net",
      "Northgate",
    ],
  });

  await send("schoolB", {
    address: ctx.profiles,
    abi: ctx.abis.profiles,
    functionName: "publishPost",
    // PostKind.FeeNotice
    args: [2, "Trimester 3 balances now published", "Outstanding balances are listed below as fee requests."],
  });
}

async function createRequestsB(ctx) {
  const day = 86_400n;
  const now = BigInt((await publicClient.getBlock()).timestamp);
  const ids = [];

  const first = await nextRequestId(ctx);
  await send("schoolB", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "createRequest",
    args: [ref("NTI-2026-0031"), 780n * USD, now + 45n * day],
  });
  await send("schoolB", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "setContext",
    args: [first, "K.O.", "Third-year surveying. Balance carried over from last trimester."],
  });
  ids.push(first);

  // Deliberately left with no student context at all.
  const second = await nextRequestId(ctx);
  await send("schoolB", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "createRequest",
    args: [ref("NTI-2026-0104"), 260n * USD, now + 20n * day],
  });
  ids.push(second);

  return ids;
}

/** Fully fund one of school B's balances, then release it. Produces a real track record. */
async function fundAndRelease(ctx) {
  const id = await firstOpenIdOf(ctx, accounts.schoolB.address);
  const request = await publicClient.readContract({
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "getRequest",
    args: [id],
  });
  const amount = request.goal - request.raised;

  await mint(ctx, "donor", amount);
  await send("donor", {
    address: ctx.token,
    abi: ctx.abis.token,
    functionName: "approve",
    args: [ctx.vault, amount],
  });
  await send("donor", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "contribute",
    args: [id, amount],
  });
  // release() is permissionless on purpose, so a second donor calling it is the
  // ordinary case, not a special one.
  await send("donor2", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "release",
    args: [id],
  });

  return { id, amount };
}

async function secondDonor(ctx) {
  const id = await firstOpenIdOf(ctx, accounts.schoolA.address);
  const amount = 60n * USD;
  await mint(ctx, "donor2", amount);
  await send("donor2", {
    address: ctx.token,
    abi: ctx.abis.token,
    functionName: "approve",
    args: [ctx.vault, amount],
  });
  await send("donor2", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "contribute",
    args: [id, amount],
  });
}

/**
 * A balance that closes unmet, so the refund path is reachable immediately.
 *
 * MIN_DURATION is one day, so the only way to see a closed request without waiting is
 * to advance the chain. 36 hours clears this request's deadline and nothing else's —
 * every other seeded request has at least 14 days.
 */
async function createExpiring(ctx) {
  const day = 86_400n;
  const now = BigInt((await publicClient.getBlock()).timestamp);
  const id = await nextRequestId(ctx);

  await send("schoolA", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "createRequest",
    args: [ref("RCC-2026-0902"), 900n * USD, now + day + 60n],
  });
  await send("schoolA", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "setContext",
    args: [id, "S.B.", "Repeat semester. Partial bursary already applied."],
  });

  const amount = 120n * USD;
  await mint(ctx, "donor", amount);
  await send("donor", {
    address: ctx.token,
    abi: ctx.abis.token,
    functionName: "approve",
    args: [ctx.vault, amount],
  });
  await send("donor", {
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "contribute",
    args: [id, amount],
  });

  await publicClient.request({ method: "evm_increaseTime", params: [Number(36n * 3600n)] });
  await publicClient.request({ method: "evm_mine", params: [] });

  return id;
}

async function leavePendingApplications(ctx) {
  const fresh = await applyForVerification(ctx, "schoolC", {
    name: "Lakeside Girls' Secondary",
    proofURI: "https://example.org/about/payments/edgrant",
    type: 1,
  });

  // A second application already carrying one confirmation, so whoever connects as the
  // other verifier can complete the m-of-n in a single click.
  const half = await applyForVerification(ctx, "donor2", {
    name: "Meridian Polytechnic",
    proofURI: "https://example.io/news/wallet-address",
    type: 2,
  });
  await send("verifierB", {
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "approveRequest",
    args: [half],
  });

  return { fresh, half };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function ref(internal) {
  return keccak256(stringToHex(internal));
}

async function mint(ctx, who, amount) {
  await send("verifierA", {
    address: ctx.token,
    abi: ctx.abis.token,
    functionName: "mint",
    args: [accounts[who].address, amount],
  });
}

async function nextRequestId(ctx) {
  return publicClient.readContract({
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "requestCount",
  });
}

async function firstOpenIdOf(ctx, school) {
  const ids = await publicClient.readContract({
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "requestsBySchool",
    args: [school],
  });
  for (const id of ids) {
    const request = await publicClient.readContract({
      address: ctx.vault,
      abi: ctx.abis.vault,
      functionName: "getRequest",
      args: [id],
    });
    if (!request.disbursed && request.raised < request.goal) return id;
  }
  throw new Error(`No open request found for ${school}`);
}

/**
 * Writes the local addresses to web/.env.local.
 *
 * Not to a generated file under src/: that would have to be imported by src/lib/contracts.ts
 * and gitignored at the same time, which breaks a fresh clone at build time. .env.local is
 * already gitignored, is already the highest-priority source contracts.ts consults, and needs
 * no import.
 *
 * Next reads .env.local at server start, so restart `npm run dev` after this.
 */
async function writeDeployments(addresses) {
  const target = join(webRoot, ".env.local");
  await mkdir(dirname(target), { recursive: true });
  const body = [
    "# Written by `npm run devchain`. Local anvil only — regenerated on every run.",
    "# Real deployments belong in packages/config/chains.json, which is reviewed.",
    `# Generated ${new Date().toISOString()}`,
    "",
    "NEXT_PUBLIC_DEFAULT_CHAIN_ID=31337",
    "NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID=31337",
    `NEXT_PUBLIC_REGISTRY_ADDRESS=${addresses.registry}`,
    `NEXT_PUBLIC_VAULT_ADDRESS=${addresses.vault}`,
    `NEXT_PUBLIC_PROFILE_ADDRESS=${addresses.profiles}`,
    `NEXT_PUBLIC_LENS_ADDRESS=${addresses.lens}`,
    `NEXT_PUBLIC_TOKEN_ADDRESS=${addresses.token}`,
    "",
  ].join("\n");
  await writeFile(target, body, "utf8");
  return target;
}

async function report(ctx) {
  const total = await publicClient.readContract({
    address: ctx.vault,
    abi: ctx.abis.vault,
    functionName: "requestCount",
  });
  const verified = await publicClient.readContract({
    address: ctx.registry,
    abi: ctx.abis.registry,
    functionName: "verifiedCount",
  });
  const statsB = await publicClient.readContract({
    address: ctx.lens,
    abi: ctx.abis.lens,
    functionName: "schoolStats",
    args: [accounts.schoolB.address],
  });

  log(`\n\x1b[1m─── seeded state ───\x1b[0m`);
  log(`  verified institutions   ${verified}`);
  log(`  fee requests            ${total}`);
  log(
    `  Northgate delivered     ${statsB.totalDisbursed / USD} USDT across ${statsB.disbursedRequests} request(s)`,
  );

  log(`\n\x1b[1m─── import these into your wallet (anvil defaults, publicly known) ───\x1b[0m`);
  const roles = [
    ["Verifier A", "verifierA", "approve/reject applications, revoke verification"],
    ["Verifier B", "verifierB", "the second signature in 2-of-2"],
    ["School — Riverside", "schoolA", "school console: profile, posts, fee requests"],
    ["School — Northgate", "schoolB", "second verified school"],
    ["Donor", "donor", "holds USDT; contribute and withdraw"],
    ["Donor 2", "donor2", "also a pending applicant, for the verifier console"],
  ];
  for (const [label, key, why] of roles) {
    log(`  ${label.padEnd(20)} ${accounts[key].address}`);
    log(`  ${" ".repeat(20)} \x1b[2m${KEYS[key]}\x1b[0m`);
    log(`  ${" ".repeat(20)} \x1b[2m${why}\x1b[0m`);
  }

  log(`\n\x1b[1m─── next ───\x1b[0m`);
  log(`  1. Add a network in your wallet:  RPC ${RPC}   chain id 31337`);
  log(`  2. Import a key above (MetaMask: Account -> Import -> Private Key)`);
  log(`  3. npm run dev   then open http://localhost:3000`);
  log(
    `\n  \x1b[2mNote: the chain clock was advanced 36h to expire one request. That is why a\n  request shows as closed while its date still looks near — the interface reads the\n  contract's own verdict, not your browser clock.\x1b[0m\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`\n\x1b[31m✗ ${error.message}\x1b[0m\n`);
  process.exit(1);
});
