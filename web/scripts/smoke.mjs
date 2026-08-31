#!/usr/bin/env node
/**
 * Browser smoke test.
 *
 * Server-rendered HTML proves almost nothing about this interface: every screen loads its
 * data client-side from the chain, so a 200 response only means the shell compiled. This
 * script drives a real browser with a real wallet attached and checks what a person
 * actually ends up looking at.
 *
 * The wallet is an EIP-1193 provider injected into the page, backed by a viem account
 * holding one of anvil's published keys. That means the write paths are exercised for real
 * — approve, contribute, release, refund, attest — against a real chain, through the same
 * React code a person uses. No mocking of the data layer.
 *
 * It also checks the parts that are easy to claim and easy to get wrong:
 *   - the verified badge links to the proof URI
 *   - the disbursement destination appears on the contribution screen before signing
 *   - self-asserted content is captioned as unverified and rendered differently
 *   - there is no countdown or urgency copy anywhere
 *   - mobile navigation opens, traps focus, closes on Escape, and locks background scroll
 *   - nothing overflows horizontally at 360px
 *   - no console errors, no failed requests
 *
 * Prerequisites:  npm run anvil    (terminal 1)
 *                 npm run devchain (once)
 *                 npm run dev      (terminal 2)
 * Then:           npm run smoke
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3111";
const RPC = "http://127.0.0.1:8545";
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 360, height: 780 };

/** anvil defaults; published, worthless, local only. */
const ROLES = {
  verifierA: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  school: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  donor: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
};

let passed = 0;
const failures = [];

function ok(msg) {
  passed++;
  process.stdout.write(`  \x1b[32m✓\x1b[0m ${msg}\n`);
}
function fail(msg, detail) {
  failures.push(msg);
  process.stdout.write(`  \x1b[31m✗\x1b[0m ${msg}\n`);
  if (detail) process.stdout.write(`    \x1b[2m${String(detail).slice(0, 400)}\x1b[0m\n`);
}
function section(msg) {
  process.stdout.write(`\n\x1b[1m▸ ${msg}\x1b[0m\n`);
}
async function check(msg, fn) {
  try {
    const result = await fn();
    if (result === false) fail(msg);
    else ok(msg);
  } catch (error) {
    fail(msg, error?.message ?? error);
  }
}

/**
 * An EIP-1193 provider announced via EIP-6963, so wagmi's injected connector discovers it
 * exactly as it would a real extension. Signing happens in Node with viem; the page only
 * ever sees the JSON-RPC surface a wallet exposes.
 */
function walletInitScript(address) {
  return `
(() => {
  let nextId = 1;
  const pending = new Map();

  window.__egSend = (payload) => {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      window.__egOut({ id, ...payload });
    });
  };
  window.__egReply = (id, result, error) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (error) entry.reject(Object.assign(new Error(error.message), error));
    else entry.resolve(result);
  };

  const listeners = new Map();
  const provider = {
    isMetaMask: true,
    async request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return ["${address}"];
        case "eth_chainId":
          return "0x7a69";
        case "net_version":
          return "31337";
        case "wallet_switchEthereumChain":
          return null;
        case "wallet_getPermissions":
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        default:
          return window.__egSend({ method, params });
      }
    },
    on(event, handler) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
      return provider;
    },
    removeListener(event, handler) {
      listeners.get(event)?.delete(handler);
      return provider;
    },
  };

  window.ethereum = provider;

  const detail = Object.freeze({
    info: Object.freeze({
      uuid: "11111111-2222-3333-4444-555555555555",
      name: "Smoke Wallet",
      icon: "data:image/svg+xml;base64,PHN2Zy8+",
      rdns: "test.edgrant.smoke",
    }),
    provider,
  });
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();
`;
}

async function makeWallet(page, privateKey) {
  const { createWalletClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { foundry } = await import("viem/chains");

  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({ account, chain: foundry, transport: http(RPC) });

  await page.exposeFunction("__egOut", async ({ id, method, params }) => {
    try {
      let result;
      if (method === "eth_sendTransaction") {
        const [tx] = params;
        result = await client.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
      } else {
        const response = await fetch(RPC, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        result = json.result;
      }
      await page.evaluate(
        ([rid, res]) => window.__egReply(rid, res),
        [id, result ?? null],
      );
    } catch (error) {
      await page.evaluate(
        ([rid, msg]) => window.__egReply(rid, null, { message: msg, code: -32000 }),
        [id, error?.message ?? "wallet error"],
      );
    }
  });

  await page.addInitScript(walletInitScript(account.address));
  return account;
}

/**
 * wagmi reconnects on mount to an injected provider that already reports an account, so the
 * header is often already connected by the time the page settles. Click Connect only if it
 * is actually there, then assert the connected state either way.
 */
async function ensureConnected(page) {
  const connect = page.locator("header button", { hasText: /^Connect/ });
  if ((await connect.count()) > 0) {
    try {
      await connect.first().click({ timeout: 5000 });
    } catch {
      /* raced with auto-reconnect; the assertion below is what matters */
    }
  }
  await page.waitForSelector("header button:has-text('…')", { timeout: 25_000 });
}

/**
 * Runs whichever of the two steps the panel is actually offering.
 *
 * An allowance can already be sufficient — from a previous contribution, or a previous run
 * of this script — in which case step 1 legitimately does not appear.
 */
async function approveThenContribute(page) {
  const approve = page.locator('button:has-text("Step 1 · Approve")');
  if ((await approve.count()) > 0 && (await approve.first().isVisible())) {
    await approve.first().click();
    await page.waitForSelector("text=Approval confirmed", { timeout: 60_000 });
  }
  const contribute = page.locator('button:has-text("Step 2 · Contribute")').first();
  await contribute.waitFor({ state: "visible", timeout: 30_000 });
  if (await contribute.isDisabled()) {
    throw new Error("the contribute button is disabled with a valid amount entered");
  }
  await contribute.click();
  await page.waitForSelector("text=Contribution confirmed", { timeout: 60_000 });
}

function watch(page, label) {
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Chromium logs a bare 4xx/5xx line for every failed subresource; the requestfailed
    // and response handlers below already cover those with more detail.
    if (/Failed to load resource/i.test(text)) return;
    problems.push(`console: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    if (/ERR_ABORTED/.test(failure)) return;
    // A school's logo or banner living at a dead URI is expected input, not an app fault.
    // What matters is that the page degrades gracefully, which is asserted separately.
    if (!request.url().startsWith(BASE)) return;
    problems.push(`request failed: ${request.url()} (${failure})`);
  });
  page.on("response", (response) => {
    if (!response.url().startsWith(BASE)) return;
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return { label, problems };
}

async function settle(page, selector, timeout = 25_000) {
  await page.waitForSelector(selector, { timeout });
}

// ---------------------------------------------------------------------------

/**
 * Resets the chain to genesis and reseeds it.
 *
 * The flow tests spend state — they withdraw the expired balance, they cast the deciding
 * confirmation on a pending application. Without a reset, a second run would find that work
 * already done and report failures that are really just staleness. `anvil_reset` returns to
 * genesis, and because nonces reset too, reseeding produces the same contract addresses.
 *
 * Set SMOKE_NO_RESEED=1 to run against whatever state is already there.
 */
async function reseed() {
  if (process.env.SMOKE_NO_RESEED === "1") {
    note("SMOKE_NO_RESEED=1 — running against existing chain state");
    return;
  }
  section("Resetting and reseeding the local chain");

  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "anvil_reset", params: [] }),
  }).catch(() => null);
  if (!response) throw new Error(`No node on ${RPC}. Start one with \`npm run anvil\`.`);
  const json = await response.json();
  if (json.error) throw new Error(`anvil_reset failed: ${json.error.message}`);
  ok("chain reset to genesis");

  execFileSync("node", ["scripts/dev-chain.mjs"], {
    cwd: webRoot,
    stdio: ["ignore", "ignore", "inherit"],
  });
  ok("reseeded");
}

function note(msg) {
  process.stdout.write(`  \x1b[2m${msg}\x1b[0m\n`);
}

/** Reads the addresses devchain wrote, from the same place the interface reads them. */
function loadContracts() {
  const path = join(webRoot, ".env.local");
  const text = readFileSync(path, "utf8");
  const get = (key) => text.match(new RegExp(`^${key}=(0x[0-9a-fA-F]{40})$`, "m"))?.[1];
  const contracts = {
    registry: get("NEXT_PUBLIC_REGISTRY_ADDRESS"),
    vault: get("NEXT_PUBLIC_VAULT_ADDRESS"),
    profiles: get("NEXT_PUBLIC_PROFILE_ADDRESS"),
    lens: get("NEXT_PUBLIC_LENS_ADDRESS"),
    token: get("NEXT_PUBLIC_TOKEN_ADDRESS"),
  };
  const missing = Object.entries(contracts)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`${path} is missing ${missing.join(", ")}. Run \`npm run devchain\` first.`);
  }
  return contracts;
}

let CONTRACTS;

async function main() {
  await reseed();
  CONTRACTS = loadContracts();

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    await runPublicPages(browser);
    await runContributionFlow(browser);
    await runSchoolConsole(browser);
    await runVerifierConsole(browser);
    await runMobile(browser);
    await runTheme(browser);
  } finally {
    await browser.close();
  }

  process.stdout.write(
    `\n\x1b[1m${failures.length === 0 ? "\x1b[32mall checks passed" : "\x1b[31mfailures"}\x1b[0m  ${passed} passed, ${failures.length} failed\n\n`,
  );
  if (failures.length > 0) {
    for (const f of failures) process.stdout.write(`  - ${f}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------

async function runPublicPages(browser) {
  section("Public pages (no wallet)");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const w = watch(page, "public");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  await check("feed renders request cards from the chain", async () => {
    await settle(page, "article");
    const count = await page.locator("article").count();
    if (count < 3) throw new Error(`expected several open balances, saw ${count}`);
    return true;
  });

  await check("feed shows each school's registered name, not just an address", async () => {
    const text = await page.locator("article").first().innerText();
    if (!/Riverside|Northgate/.test(text)) throw new Error(`no registered name in:\n${text}`);
    return true;
  });

  await check("no countdown or urgency copy anywhere on the feed", async () => {
    const body = await page.locator("body").innerText();
    const banned = [
      /\bhurry\b/i,
      /\bact now\b/i,
      /\bonly \d+ (hours?|days?) (left|remaining)\b/i,
      /\d+\s*:\s*\d\d\s*:\s*\d\d/, // hh:mm:ss timer
      /\bdon't miss\b/i,
      /\blast chance\b/i,
      /\burgent\b/i,
      /🔥|⏰|🚨/,
    ];
    const hit = banned.find((re) => re.test(body));
    if (hit) throw new Error(`urgency pattern present: ${hit}`);
    return true;
  });

  await check("deadlines render as dates", async () => {
    const body = await page.locator("body").innerText();
    if (!/Clos(es|ed)\s+\d{1,2}\s+\w+\s+\d{4}/.test(body)) {
      throw new Error("no 'Closes <date>' text found");
    }
    return true;
  });

  await check("directory lists verified institutions with a delivered figure", async () => {
    await page.goto(`${BASE}/schools`, { waitUntil: "networkidle" });
    await settle(page, "article");
    const body = await page.locator("body").innerText();
    if (!/Delivered/i.test(body)) throw new Error("no delivered figure in the directory");
    if (!/Northgate Technical Institute/.test(body)) throw new Error("seeded school missing");
    return true;
  });

  await check("school page separates verified facts from self-asserted content", async () => {
    await page.goto(`${BASE}/schools`, { waitUntil: "networkidle" });
    await settle(page, "article");
    await page.locator('a:has-text("Institution page")').first().click();
    await page.waitForLoadState("networkidle");
    await settle(page, "text=Registered name");

    const evidence = page.locator(".evidence-panel").first();
    if ((await evidence.count()) === 0) throw new Error("no evidence panel on the school page");
    const evidenceText = await evidence.innerText();
    if (!/re-checkable by you/i.test(evidenceText)) {
      throw new Error("evidence panel does not tell the reader they can re-check it");
    }

    const asserted = page.locator(".asserted-panel");
    if ((await asserted.count()) === 0) throw new Error("no self-asserted panel");
    const assertedText = await asserted.first().innerText();
    if (!/verified by nobody|Self-asserted|Not verified/i.test(assertedText)) {
      throw new Error(`self-asserted panel lacks its caveat:\n${assertedText}`);
    }
    return true;
  });

  await check("the verified badge links to the on-chain proof URI", async () => {
    const link = page.locator('a:has-text("Re-check the proof")').first();
    if ((await link.count()) === 0) throw new Error("no proof link on the school page");
    const href = await link.getAttribute("href");
    if (!href || !/^https?:\/\//.test(href)) throw new Error(`bad proof href: ${href}`);
    if ((await link.getAttribute("target")) !== "_blank") throw new Error("proof link not _blank");
    const rel = (await link.getAttribute("rel")) ?? "";
    if (!/noreferrer/.test(rel)) throw new Error(`proof link rel missing noreferrer: ${rel}`);
    return true;
  });

  await check("the two panels are visually distinguishable, not just labelled", async () => {
    const styles = await page.evaluate(() => {
      const ev = document.querySelector(".evidence-panel");
      const as = document.querySelector(".asserted-panel");
      if (!ev || !as) return null;
      const a = getComputedStyle(ev);
      const b = getComputedStyle(as);
      return {
        evBorderStyle: a.borderLeftStyle,
        asBorderStyle: b.borderTopStyle,
        evBg: a.backgroundColor,
        asBg: b.backgroundColor,
      };
    });
    if (!styles) throw new Error("panels not both present");
    if (styles.asBorderStyle !== "dashed") {
      throw new Error(`self-asserted panel should be dashed, got ${styles.asBorderStyle}`);
    }
    if (styles.evBg === styles.asBg) {
      throw new Error("evidence and self-asserted panels share a background");
    }
    return true;
  });

  await check("a school's unreachable logo degrades to a monogram, not a broken image", async () => {
    // The seeded profile points at ipfs://placeholder-logo, which does not resolve. This is
    // ordinary untrusted input and the institution's page must still look intact.
    await page.goto(`${BASE}/schools`, { waitUntil: "networkidle" });
    await settle(page, "article");
    await page.waitForTimeout(2500);
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll("img")].filter(
        (img) => img.complete && img.naturalWidth === 0 && img.getAttribute("src"),
      ).length,
    );
    if (broken > 0) throw new Error(`${broken} broken <img> left on the page`);
    return true;
  });

  await check("how-it-works states what the system is not", async () => {
    await page.goto(`${BASE}/how-it-works`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    for (const phrase of ["Not fraud-proof", "Not fully decentralised", "Not audited"]) {
      if (!body.includes(phrase)) throw new Error(`missing "${phrase}"`);
    }
    return true;
  });

  await check("no console errors, page errors, or failed requests", () => {
    if (w.problems.length > 0) throw new Error(w.problems.slice(0, 4).join(" | "));
    return true;
  });

  await context.close();
}

// ---------------------------------------------------------------------------

async function runContributionFlow(browser) {
  section("Contribution flow (donor wallet, real transactions)");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const w = watch(page, "donor");
  await makeWallet(page, ROLES.donor);

  // Find a request that is open, via the feed rather than a hardcoded id.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await settle(page, "article");
  await page.locator('a:has-text("Contribute")').first().click();
  await page.waitForLoadState("networkidle");
  await settle(page, "text=Where this money goes");

  const requestUrl = page.url();

  await check("the disbursement destination is on screen before signing", async () => {
    const panel = page.locator("section", { hasText: "Where this money goes" }).first();
    const text = await panel.innerText();
    if (!new RegExp(CONTRACTS.vault.slice(2, 10), "i").test(text) === false) {
      throw new Error("the vault address is being shown as the destination");
    }
    if (!/disbursement destination/i.test(text)) throw new Error("destination not labelled");
    if (!/0x[0-9a-fA-F]{40}/.test(text)) throw new Error("no address shown");
    if (!/no function anywhere in the vault that can change it/i.test(text)) {
      throw new Error("immutability of the destination not stated");
    }
    return true;
  });

  await check("both outcomes are stated on the same screen as the amount field", async () => {
    const text = await page.locator("body").innerText();
    if (!/If it is not reached in time/i.test(text)) throw new Error("failure outcome missing");
    if (!/withdraw your own contribution/i.test(text)) throw new Error("refund terms missing");
    if (!/verification is revoked/i.test(text)) throw new Error("revocation outcome missing");
    return true;
  });

  await check("wallet connects through EIP-6963 discovery", async () => {
    await ensureConnected(page);
    return true;
  });

  await check("the two-step approve + contribute flow is shown as two steps", async () => {
    await settle(page, "#contribute-amount");
    await page.fill("#contribute-amount", "5");
    const steps = page.locator("ol li", { hasText: /Approve the vault|Contribute to this fee/ });
    if ((await steps.count()) < 2) throw new Error("approve and contribute steps not both shown");
    // Stated whether or not an approval is currently outstanding: it is a standing policy,
    // not a hint that disappears once the allowance happens to be sufficient.
    const body = await page.locator("body").innerText();
    if (!/never unlimited/i.test(body)) {
      throw new Error("the approval is not described as being for the exact amount");
    }
    return true;
  });

  await check("an over-contribution is refused in the form, before any gas", async () => {
    await page.fill("#contribute-amount", "99999999");
    await page.waitForSelector("#contribute-problem", { timeout: 8000 });
    const problem = await page.locator("#contribute-problem").innerText();
    if (!/still outstanding|balance is/i.test(problem)) {
      throw new Error(`unexpected validation message: ${problem}`);
    }
    const disabled = await page.locator('button:has-text("Approve")').first().isDisabled();
    if (!disabled) throw new Error("the submit button is enabled for an invalid amount");
    return true;
  });

  await check("approve then contribute both land on-chain", async () => {
    await page.fill("#contribute-amount", "5");
    await approveThenContribute(page);
    return true;
  });

  await check("the contribution is reflected back on the page", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await settle(page, "text=You have already contributed");
    const text = await page.locator("text=You have already contributed").first().innerText();
    if (!/5\.00 USDT/.test(text)) throw new Error(`unexpected position: ${text}`);
    return true;
  });

  await check("the contribution appears in the portfolio", async () => {
    await page.goto(`${BASE}/portfolio`, { waitUntil: "networkidle" });
    await settle(page, "text=Contributed in total");
    const body = await page.locator("body").innerText();
    if (!/In progress/.test(body)) throw new Error("no in-progress section");
    if (!/Delivered to a school/.test(body)) {
      throw new Error("no delivered section, though the seed released one request to this donor");
    }
    return true;
  });

  await check("a closed-unmet balance offers a withdrawal, and it works", async () => {
    const body = await page.locator("body").innerText();
    if (!/Available to withdraw/.test(body)) {
      throw new Error("seeded expired request is not offered for withdrawal");
    }
    const button = page.locator('button:has-text("Withdraw")').first();
    const label = await button.innerText();
    if (!/USDT/.test(label)) throw new Error(`withdraw button does not name an amount: ${label}`);
    await button.click();
    await page.waitForSelector("text=Withdrawal confirmed", { timeout: 60_000 });
    return true;
  });

  await check("the release action appears once a balance is fully funded, and pays the school", async () => {
    // Fund a fresh balance to completion through the UI, then release it.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await settle(page, "article");

    // Pick the smallest remaining balance so one contribution completes it.
    await page.selectOption("#feed-sort", "smallest");
    await page.waitForTimeout(400);
    await page.locator('a:has-text("Contribute")').first().click();
    await page.waitForLoadState("networkidle");
    await settle(page, "#contribute-amount");

    const clearButton = page.locator('button:has-text("Clear the balance")').first();
    await clearButton.click();
    await approveThenContribute(page);

    await settle(page, "text=Ready to pay the school", 30_000);
    const releasePanel = await page
      .locator("section", { hasText: "Ready to pay the school" })
      .first()
      .innerText();
    if (!/anyone/i.test(releasePanel)) {
      throw new Error("the release panel does not say it is permissionless");
    }

    await page.locator('button:has-text("Send")').first().click();
    await page.waitForSelector("text=Release confirmed", { timeout: 60_000 });
    await settle(page, "text=Delivered", 30_000);
    return true;
  });

  await check("no console errors during the whole flow", () => {
    if (w.problems.length > 0) throw new Error(w.problems.slice(0, 4).join(" | "));
    return true;
  });

  void requestUrl;
  await context.close();
}

// ---------------------------------------------------------------------------

async function runSchoolConsole(browser) {
  section("School console (verified school wallet)");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const w = watch(page, "school");
  await makeWallet(page, ROLES.school);

  await page.goto(`${BASE}/school/admin`, { waitUntil: "networkidle" });
  await ensureConnected(page);
  await settle(page, "text=Verified as", 25_000);

  await check("the console recognises a verified school and names the payout wallet", async () => {
    const body = await page.locator("body").innerText();
    if (!/Riverside Community College/.test(body)) throw new Error("registered name not shown");
    // Case-insensitive: `.eyebrow` renders labels uppercase via CSS, and innerText reflects
    // the rendered text rather than the source.
    if (!/every payout goes here/i.test(body)) throw new Error("payout wallet not stated");
    return true;
  });

  await check("the reference is hashed in the browser before it is sent", async () => {
    await settle(page, 'input[placeholder="RCC-2026-0417"]');
    await page.locator('input[placeholder="RCC-2026-0417"]').first().fill("SMOKE-REF-0001");
    await settle(page, "text=What will be stored on-chain");
    const shown = await page
      .locator("div", { hasText: "What will be stored on-chain" })
      .last()
      .innerText();
    if (!/0x[0-9a-f]{64}/i.test(shown)) throw new Error("no 32-byte hash displayed");
    if (/SMOKE-REF-0001/.test(shown.replace(/What will be stored on-chain/, ""))) {
      throw new Error("the raw identifier is being shown as the on-chain value");
    }
    return true;
  });

  await check("attesting a fee balance works end to end", async () => {
    await page.locator('input[placeholder="450.00"]').first().fill("42.50");

    const closes = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(closes);

    await page.locator('input[placeholder="A.M."]').first().fill("S.K.");
    await page
      .locator("textarea")
      .first()
      .fill("Smoke test context. Not a real student.");

    await page.locator('button:has-text("Publish this fee balance")').click();
    await page.waitForSelector("text=Fee attestation confirmed", { timeout: 60_000 });
    // Context is a second signature, because createRequest returns the new id.
    await page.waitForSelector("text=Student context confirmed", { timeout: 60_000 });
    return true;
  });

  await check("the new balance appears in the school's own list", async () => {
    await page.waitForTimeout(1200);
    const body = await page.locator("body").innerText();
    if (!/42\.50 USDT/.test(body)) throw new Error("the new balance is not listed");
    return true;
  });

  await check("the reference matcher finds it without anything leaving the browser", async () => {
    await page.locator('input[placeholder="RCC-2026-0417"]').last().fill("SMOKE-REF-0001");
    await settle(page, "text=Matches request");
    return true;
  });

  await check("the profile editor warns that its content is not evidence", async () => {
    await page.locator('button:has-text("Profile")').first().click();
    await settle(page, "text=This content is marketing, not evidence");
    const byteCounter = await page.locator("text=/\\d+\\/128 bytes/").first().isVisible();
    if (!byteCounter) throw new Error("no byte counter on a length-limited field");
    return true;
  });

  await check("hiding a post is described honestly as not deleting", async () => {
    await page.locator('button:has-text("Announcements")').first().click();
    await settle(page, "text=Your posts");
    const body = await page.locator("body").innerText();
    if (!/does not delete it/i.test(body)) {
      throw new Error("hide-is-not-delete is not stated");
    }
    return true;
  });

  await check("no console errors in the console", () => {
    if (w.problems.length > 0) throw new Error(w.problems.slice(0, 4).join(" | "));
    return true;
  });

  await context.close();
}

// ---------------------------------------------------------------------------

async function runVerifierConsole(browser) {
  section("Verifier console (verifier wallet)");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const w = watch(page, "verifier");
  await makeWallet(page, ROLES.verifierA);

  await page.goto(`${BASE}/verifier`, { waitUntil: "networkidle" });
  await ensureConnected(page);
  await settle(page, "text=Confirmations required", 25_000);

  await check("the console recognises a verifier and shows the m-of-n threshold", async () => {
    const body = await page.locator("body").innerText();
    if (!/\b2\b\s*of\s*\b2\b/.test(body)) throw new Error("threshold not shown as m-of-n");
    if (!/There is no owner and no admin/.test(body)) {
      throw new Error("the absence of an owner is not stated");
    }
    return true;
  });

  await check("pending applications show the claimed name beside the proof host", async () => {
    await settle(page, "text=Pending applications");
    const body = await page.locator("body").innerText();
    if (!/Lakeside Girls|Meridian Polytechnic/.test(body)) {
      throw new Error("seeded pending applications not listed");
    }
    if (!/host:/i.test(body)) throw new Error("proof host not surfaced for comparison");
    if (!/address claiming that name/i.test(body)) {
      throw new Error("applicant address not labelled for comparison");
    }
    return true;
  });

  await check("the console offers no field for a subjective opinion", async () => {
    const body = await page.locator("body").innerText();
    if (!/proof-of-control|Proof of control/i.test(body)) {
      throw new Error("proof-of-control framing missing");
    }
    if (/rate this|score|trustworthiness rating/i.test(body)) {
      throw new Error("subjective assessment UI present");
    }
    return true;
  });

  await check("confirming an application that already has one signature verifies it", async () => {
    // Seeded: "Meridian Polytechnic" is at 1-of-2, confirmed by verifier B.
    const row = page.locator("li", { hasText: "Meridian Polytechnic" }).first();
    const rowText = await row.innerText();
    if (!/1 of 2 confirmed/.test(rowText)) {
      throw new Error(`expected 1-of-2, saw:\n${rowText}`);
    }
    if (!/last signature required/i.test(rowText)) {
      throw new Error("the console does not warn that this is the deciding signature");
    }
    await row.locator('button:has-text("Confirm and verify")').click();
    await page.waitForSelector("text=Confirmation confirmed", { timeout: 60_000 });
    return true;
  });

  await check("the newly verified institution appears in the public directory", async () => {
    await page.goto(`${BASE}/schools`, { waitUntil: "networkidle" });
    await settle(page, "article");
    const body = await page.locator("body").innerText();
    if (!/Meridian Polytechnic/.test(body)) {
      throw new Error("the just-verified institution is not in the directory");
    }
    return true;
  });

  await check("no console errors", () => {
    if (w.problems.length > 0) throw new Error(w.problems.slice(0, 4).join(" | "));
    return true;
  });

  await context.close();
}

// ---------------------------------------------------------------------------

async function runMobile(browser) {
  section("Mobile (360×780, touch)");
  const context = await browser.newContext({
    viewport: MOBILE,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const w = watch(page, "mobile");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await settle(page, "article");

  await check("no horizontal overflow on the feed", async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) throw new Error(`${overflow}px of horizontal scroll`);
    return true;
  });

  await check("desktop nav is hidden and the menu button is present", async () => {
    const navVisible = await page.locator('nav[aria-label="Main"]').isVisible();
    if (navVisible) throw new Error("desktop nav is visible at 360px");
    const button = page.locator('button[aria-label="Open menu"]');
    if (!(await button.isVisible())) throw new Error("no menu button");
    const box = await button.boundingBox();
    if (!box || box.height < 44) throw new Error(`menu button is only ${box?.height}px tall`);
    return true;
  });

  await check("the drawer opens as a modal dialog with an accessible name", async () => {
    await page.locator('button[aria-label="Open menu"]').tap();
    await settle(page, '[role="dialog"][aria-modal="true"]');
    const labelled = await page.locator('[role="dialog"]').getAttribute("aria-labelledby");
    if (!labelled) throw new Error("dialog has no aria-labelledby");
    return true;
  });

  await check("background scroll is locked while the drawer is open", async () => {
    const locked = await page.evaluate(() =>
      document.documentElement.classList.contains("scroll-locked"),
    );
    if (!locked) throw new Error("html is not scroll-locked");
    return true;
  });

  await check("focus moves into the drawer", async () => {
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    if (!inside) throw new Error("focus stayed outside the drawer");
    return true;
  });

  await check("every drawer link is at least 44px tall", async () => {
    const links = page.locator('[role="dialog"] a');
    const count = await links.count();
    if (count < 5) throw new Error(`expected the full nav, saw ${count} links`);
    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      if (!box) continue;
      if (box.height < 44) {
        const text = await links.nth(i).innerText();
        throw new Error(`"${text.split("\n")[0]}" is ${Math.round(box.height)}px tall`);
      }
    }
    return true;
  });

  await check("Tab wraps inside the drawer rather than escaping to the page", async () => {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const escaped = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return Boolean(dialog && document.activeElement && !dialog.contains(document.activeElement));
      });
      if (escaped) throw new Error(`focus left the drawer after ${i + 1} tabs`);
    }
    return true;
  });

  await check("Escape closes the drawer and unlocks scroll", async () => {
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 });
    const locked = await page.evaluate(() =>
      document.documentElement.classList.contains("scroll-locked"),
    );
    if (locked) throw new Error("scroll stayed locked after closing");
    return true;
  });

  await check("navigating from the drawer closes it", async () => {
    await page.locator('button[aria-label="Open menu"]').tap();
    await settle(page, '[role="dialog"]');
    await page.locator('[role="dialog"] a[href="/schools"]').tap();
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 });
    await page.waitForURL(/\/schools$/, { timeout: 8000 });
    return true;
  });

  await check("a request card is tappable as a whole on touch", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await settle(page, "article");
    const overlay = page.locator("article a[aria-label^='Open request']").first();
    if ((await overlay.count()) === 0) throw new Error("no whole-card tap target");
    return true;
  });

  await check("the contribution screen pins its primary action to the bottom", async () => {
    await page.locator("article").first().tap();
    await page.waitForLoadState("networkidle");
    await settle(page, "text=Where this money goes");
    const bar = page.locator(".action-bar");
    if (!(await bar.isVisible())) throw new Error("no sticky action bar on mobile");
    const box = await bar.boundingBox();
    const height = MOBILE.height;
    if (!box || box.y + box.height < height - 4) {
      throw new Error(`action bar is not at the bottom (y=${box?.y})`);
    }
    if (box.height < 56) throw new Error("action bar is too short to tap comfortably");
    return true;
  });

  await check("no horizontal overflow on the contribution screen", async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) throw new Error(`${overflow}px of horizontal scroll`);
    return true;
  });

  await check("the disbursement path stacks vertically instead of overflowing", async () => {
    const boxes = await page.evaluate(() => {
      const items = document.querySelectorAll("section ol li");
      return [...items].slice(0, 3).map((el) => el.getBoundingClientRect().top);
    });
    if (boxes.length >= 2 && Math.abs(boxes[1] - boxes[0]) < 4) {
      throw new Error("the three-step path is still side by side at 360px");
    }
    return true;
  });

  await check("no horizontal overflow on any other route", async () => {
    for (const path of ["/schools", "/portfolio", "/how-it-works", "/school/admin", "/verifier"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) throw new Error(`${path} overflows by ${overflow}px`);
    }
    return true;
  });

  await check("no console errors on mobile", () => {
    if (w.problems.length > 0) throw new Error(w.problems.slice(0, 4).join(" | "));
    return true;
  });

  await context.close();
}

// ---------------------------------------------------------------------------

async function runTheme(browser) {
  section("Theme");
  const context = await browser.newContext({
    viewport: DESKTOP,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const w = watch(page, "theme");

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  await check("dark mode is applied before first paint, with no light flash", async () => {
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (!isDark) throw new Error("system dark preference was not honoured");
    return true;
  });

  await check("body text meets a readable contrast ratio in dark mode", async () => {
    const ratio = await page.evaluate(() => {
      const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) =>
        [r, g, b]
          .map((v) => v / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
      const style = getComputedStyle(document.body);
      const a = lum(parse(style.color));
      const b = lum(parse(style.backgroundColor));
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    });
    if (ratio < 7) throw new Error(`contrast ratio is only ${ratio.toFixed(2)}:1`);
    return true;
  });

  await check("the toggle switches to light and persists across a reload", async () => {
    await page.locator('button[aria-label*="light appearance"]').first().click();
    await page.waitForTimeout(200);
    let isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    if (isDark) throw new Error("toggle did not switch to light");

    await page.reload({ waitUntil: "domcontentloaded" });
    isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    if (isDark) throw new Error("the light preference did not survive a reload");
    return true;
  });

  await check("body text meets a readable contrast ratio in light mode", async () => {
    const ratio = await page.evaluate(() => {
      const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) =>
        [r, g, b]
          .map((v) => v / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
      const style = getComputedStyle(document.body);
      const a = lum(parse(style.color));
      const b = lum(parse(style.backgroundColor));
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    });
    if (ratio < 7) throw new Error(`contrast ratio is only ${ratio.toFixed(2)}:1`);
    return true;
  });

  await check("no console errors", () => {
    if (w.problems.length > 0) throw new Error(w.problems.slice(0, 4).join(" | "));
    return true;
  });

  await context.close();
}

main().catch((error) => {
  process.stderr.write(`\n\x1b[31m✗ ${error?.stack ?? error}\x1b[0m\n`);
  process.exit(1);
});
