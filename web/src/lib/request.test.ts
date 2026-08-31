import { describe, expect, it } from "vitest";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import {
  applicationStatusLabel,
  checkDeadline,
  deriveFromView,
  deriveRequestState,
  describeTrackRecord,
  entityTypeLabel,
  newestFirst,
  postKindLabel,
  toStudentRef,
  type FundingRequest,
  type RequestView,
  type SchoolStats,
} from "./request";

const USD = 1_000_000n;
const NOW = 1_790_000_000;
const DAY = 86_400;

const SCHOOL = "0x1111111111111111111111111111111111111111" as Address;

function request(overrides: Partial<FundingRequest> = {}): FundingRequest {
  return {
    school: SCHOOL,
    studentRef: ("0x" + "11".repeat(32)) as Hex,
    goal: 1000n * USD,
    raised: 0n,
    createdAt: BigInt(NOW - DAY),
    deadline: BigInt(NOW + 30 * DAY),
    disbursed: false,
    ...overrides,
  };
}

/**
 * These assertions mirror EducationFundingVault exactly:
 *
 *   release  requires  !disbursed && raised >= goal && isVerified(school)
 *   refund   requires  !disbursed && (!isVerified(school) || (now >= deadline && raised < goal))
 *   contribute requires !disbursed && now < deadline && isVerified(school) && amount <= goal-raised
 *
 * A screen offering a button the contract will reject wastes a donor's gas and their
 * trust, so this derivation is the one place the interface decides what a request "is"
 * and it has to be right.
 */
describe("deriveRequestState", () => {
  it("an open request accepts contributions and nothing else", () => {
    const state = deriveRequestState(request({ raised: 400n * USD }), {
      schoolVerified: true,
      nowSeconds: NOW,
    });
    expect(state.status).toBe("open");
    expect(state.canContribute).toBe(true);
    expect(state.canRelease).toBe(false);
    expect(state.canRefund).toBe(false);
    expect(state.remaining).toBe(600n * USD);
    expect(state.progress).toBe(40);
  });

  it("a fully funded request is releasable and no longer contributable", () => {
    const state = deriveRequestState(request({ raised: 1000n * USD }), {
      schoolVerified: true,
      nowSeconds: NOW,
    });
    expect(state.status).toBe("fully-funded");
    expect(state.canRelease).toBe(true);
    expect(state.canContribute).toBe(false);
    expect(state.canRefund).toBe(false);
    expect(state.remaining).toBe(0n);
  });

  it("a disbursed request is terminal: no contribute, no release, no refund", () => {
    const state = deriveRequestState(
      request({ raised: 1000n * USD, disbursed: true }),
      { schoolVerified: true, nowSeconds: NOW },
    );
    expect(state.status).toBe("disbursed");
    expect(state.canContribute).toBe(false);
    expect(state.canRelease).toBe(false);
    expect(state.canRefund).toBe(false);
  });

  it("a deadline passed with the goal unmet becomes refundable", () => {
    const state = deriveRequestState(
      request({ raised: 400n * USD, deadline: BigInt(NOW - 1) }),
      { schoolVerified: true, nowSeconds: NOW },
    );
    expect(state.status).toBe("closed-unmet");
    expect(state.canRefund).toBe(true);
    expect(state.canContribute).toBe(false);
    expect(state.canRelease).toBe(false);
  });

  it("a deadline passed with the goal MET stays releasable, not refundable", () => {
    // The vault's release() has no deadline check, and _refundable requires raised < goal.
    // Getting this wrong would tell contributors to withdraw from a request that is about
    // to pay a school.
    const state = deriveRequestState(
      request({ raised: 1000n * USD, deadline: BigInt(NOW - 1) }),
      { schoolVerified: true, nowSeconds: NOW },
    );
    expect(state.status).toBe("fully-funded");
    expect(state.canRelease).toBe(true);
    expect(state.canRefund).toBe(false);
  });

  it("revocation outranks everything and opens refunds immediately", () => {
    const open = deriveRequestState(request({ raised: 400n * USD }), {
      schoolVerified: false,
      nowSeconds: NOW,
    });
    expect(open.status).toBe("verification-withdrawn");
    expect(open.canRefund).toBe(true);
    expect(open.canContribute).toBe(false);

    // Even fully funded: release() re-checks verification and would revert.
    const funded = deriveRequestState(request({ raised: 1000n * USD }), {
      schoolVerified: false,
      nowSeconds: NOW,
    });
    expect(funded.status).toBe("verification-withdrawn");
    expect(funded.canRelease).toBe(false);
    expect(funded.canRefund).toBe(true);
  });

  it("revocation does not resurrect an already-disbursed request", () => {
    const state = deriveRequestState(
      request({ raised: 1000n * USD, disbursed: true }),
      { schoolVerified: false, nowSeconds: NOW },
    );
    expect(state.status).toBe("disbursed");
    expect(state.canRefund).toBe(false);
  });

  it("prefers the contract's refundable verdict over the browser clock", () => {
    // The scenario this guards: a chain whose time has moved (a local chain advanced for
    // testing, or ordinary skew) while the visitor's clock has not. block.timestamp is the
    // only clock that decides whether a call succeeds.
    const chainSaysClosed = deriveRequestState(
      request({ raised: 400n * USD, deadline: BigInt(NOW + 30 * DAY) }),
      { schoolVerified: true, nowSeconds: NOW, chainRefundable: true },
    );
    expect(chainSaysClosed.status).toBe("closed-unmet");
    expect(chainSaysClosed.canContribute).toBe(false);
    expect(chainSaysClosed.canRefund).toBe(true);

    const chainSaysOpen = deriveRequestState(
      request({ raised: 400n * USD, deadline: BigInt(NOW - 30 * DAY) }),
      { schoolVerified: true, nowSeconds: NOW, chainRefundable: false },
    );
    expect(chainSaysOpen.status).toBe("open");
    expect(chainSaysOpen.canContribute).toBe(true);
  });

  it("treats an overfunded balance as met, and clamps progress", () => {
    // Cannot happen through contribute(), which reverts above the remainder, but a
    // display that produced 120% or a negative remainder would still be a bug.
    const state = deriveRequestState(request({ raised: 1200n * USD }), {
      schoolVerified: true,
      nowSeconds: NOW,
    });
    expect(state.progress).toBe(100);
    expect(state.remaining).toBe(0n);
    expect(state.canRelease).toBe(true);
  });

  it("carries a plain-language detail for every reachable status", () => {
    const cases: { input: Parameters<typeof deriveRequestState>; expect: string }[] = [
      [request({ raised: 1n }), { schoolVerified: true, nowSeconds: NOW }],
      [request({ raised: 1000n * USD }), { schoolVerified: true, nowSeconds: NOW }],
      [request({ disbursed: true, raised: 1000n * USD }), { schoolVerified: true, nowSeconds: NOW }],
      [request({ deadline: BigInt(NOW - 1) }), { schoolVerified: true, nowSeconds: NOW }],
      [request(), { schoolVerified: false, nowSeconds: NOW }],
    ].map((input) => ({ input: input as Parameters<typeof deriveRequestState>, expect: "" }));

    for (const { input } of cases) {
      const state = deriveRequestState(...input);
      expect(state.detail.length, state.status).toBeGreaterThan(30);
      expect(state.label.length, state.status).toBeGreaterThan(0);
    }
  });

  it("derives from a lens RequestView using the chain's own flags", () => {
    const view: RequestView = {
      requestId: 7n,
      request: request({ raised: 400n * USD }),
      context: { pseudonym: "", statement: "" },
      remaining: 600n * USD,
      releasable: false,
      refundable: true,
    };
    const state = deriveFromView(view, true, NOW);
    expect(state.status).toBe("closed-unmet");
    expect(state.canRefund).toBe(true);
  });
});

describe("checkDeadline", () => {
  it("enforces the vault's MIN_DURATION and MAX_DURATION before any gas is spent", () => {
    expect(checkDeadline(NOW + 2 * DAY, NOW)).toEqual({ ok: true, timestamp: NOW + 2 * DAY });

    const tooSoon = checkDeadline(NOW + 3600, NOW);
    expect(tooSoon.ok).toBe(false);
    if (!tooSoon.ok) expect(tooSoon.error).toMatch(/one full day/);

    const tooFar = checkDeadline(NOW + 400 * DAY, NOW);
    expect(tooFar.ok).toBe(false);
    if (!tooFar.ok) expect(tooFar.error).toMatch(/one year/);

    expect(checkDeadline(null, NOW).ok).toBe(false);
  });

  it("accepts the exact boundaries the contract accepts", () => {
    expect(checkDeadline(NOW + DAY, NOW).ok).toBe(true);
    expect(checkDeadline(NOW + 365 * DAY, NOW).ok).toBe(true);
    expect(checkDeadline(NOW + DAY - 1, NOW).ok).toBe(false);
    expect(checkDeadline(NOW + 365 * DAY + 1, NOW).ok).toBe(false);
  });
});

describe("toStudentRef", () => {
  it("matches SeedDemo's keccak256 of the identifier string", () => {
    // SeedDemo.s.sol uses keccak256("RCC-2026-0417"); a mismatch here would make the
    // school console's reference matcher silently useless.
    expect(toStudentRef("RCC-2026-0417")).toBe(keccak256(stringToHex("RCC-2026-0417")));
  });

  it("is stable under surrounding whitespace and case-sensitive otherwise", () => {
    expect(toStudentRef("  RCC-1  ")).toBe(toStudentRef("RCC-1"));
    expect(toStudentRef("rcc-1")).not.toBe(toStudentRef("RCC-1"));
  });

  it("produces a 32-byte value", () => {
    expect(toStudentRef("anything")).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("enum labels", () => {
  it("mirrors the contract enums and never renders a bare number", () => {
    expect(entityTypeLabel(0)).toBe("Unspecified");
    expect(entityTypeLabel(1)).toBe("School");
    expect(entityTypeLabel(2)).toBe("University");
    expect(entityTypeLabel(99)).toBe("Unspecified");

    expect(postKindLabel(0)).toBe("Update");
    expect(postKindLabel(2)).toBe("Fee notice");
    expect(postKindLabel(7)).toBe("Update");

    expect(applicationStatusLabel(1)).toBe("Pending");
    expect(applicationStatusLabel(2)).toBe("Approved");
    expect(applicationStatusLabel(4)).toBe("Withdrawn");
    expect(applicationStatusLabel(9)).toBe("Unknown");
  });
});

describe("newestFirst", () => {
  it("sorts descending by request id", () => {
    const make = (id: bigint): RequestView => ({
      requestId: id,
      request: request(),
      context: { pseudonym: "", statement: "" },
      remaining: 0n,
      releasable: false,
      refundable: false,
    });
    const sorted = newestFirst([make(1n), make(9n), make(4n)]);
    expect(sorted.map((v) => v.requestId)).toEqual([9n, 4n, 1n]);
  });
});

describe("describeTrackRecord", () => {
  const stats = (overrides: Partial<SchoolStats> = {}): SchoolStats => ({
    totalRequests: 0n,
    openRequests: 0n,
    disbursedRequests: 0n,
    releasableRequests: 0n,
    expiredRequests: 0n,
    totalRequested: 0n,
    totalHeld: 0n,
    totalDisbursed: 0n,
    ...overrides,
  });

  it("distinguishes 'nothing published' from 'nothing delivered'", () => {
    expect(describeTrackRecord(stats())).toMatch(/No fee requests published/);
    expect(describeTrackRecord(stats({ totalRequests: 3n }))).toMatch(/has reached its goal/);
  });

  it("counts requests actually paid out, and gets the plural right", () => {
    expect(describeTrackRecord(stats({ totalRequests: 5n, disbursedRequests: 1n }))).toBe(
      "Delivered across 1 request.",
    );
    expect(describeTrackRecord(stats({ totalRequests: 5n, disbursedRequests: 4n }))).toBe(
      "Delivered across 4 requests.",
    );
  });
});
