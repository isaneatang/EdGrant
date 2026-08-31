import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "./contracts";

/**
 * The shapes the lens and vault return, plus the state machine derived from them.
 *
 * The derivation below is the single place the interface decides what a request "is".
 * It mirrors EducationFundingVault exactly — release() requires
 * `!disbursed && raised >= goal && isVerified(school)`, refund() requires
 * `!disbursed && (!isVerified(school) || (now >= deadline && raised < goal))` — because
 * a screen that offers a button the contract will reject is a screen that wastes a
 * donor's gas and their trust. It is pure, and it is unit-tested.
 */

export type FundingRequest = {
  school: Address;
  studentRef: Hex;
  goal: bigint;
  raised: bigint;
  createdAt: bigint;
  deadline: bigint;
  disbursed: boolean;
};

export type StudentContext = { pseudonym: string; statement: string };

export type RequestView = {
  requestId: bigint;
  request: FundingRequest;
  context: StudentContext;
  remaining: bigint;
  releasable: boolean;
  refundable: boolean;
};

export type SchoolStats = {
  totalRequests: bigint;
  openRequests: bigint;
  disbursedRequests: bigint;
  releasableRequests: bigint;
  expiredRequests: bigint;
  totalRequested: bigint;
  totalHeld: bigint;
  totalDisbursed: bigint;
};

export type SchoolProfileData = {
  displayName: string;
  logoURI: string;
  bannerURI: string;
  description: string;
  website: string;
  location: string;
  updatedAt: bigint;
  exists: boolean;
};

export type SchoolOverview = {
  school: Address;
  verified: boolean;
  entityName: string;
  proofURI: string;
  entityType: number;
  verifiedAt: bigint;
  profile: SchoolProfileData;
  stats: SchoolStats;
};

export type Post = {
  title: string;
  body: string;
  kind: number;
  postedAt: bigint;
  visible: boolean;
};

/** Mirrors IVerifiedEntityRegistry.EntityType. */
export const ENTITY_TYPE_LABELS = [
  "Unspecified",
  "School",
  "University",
  "Company",
  "Non-profit",
  "Government",
  "Other",
] as const;

export function entityTypeLabel(kind: number): string {
  return ENTITY_TYPE_LABELS[kind] ?? "Unspecified";
}

/** Mirrors SchoolProfile.PostKind. */
export const POST_KIND_LABELS = ["Update", "Admissions", "Fee notice"] as const;

export function postKindLabel(kind: number): string {
  return POST_KIND_LABELS[kind] ?? "Update";
}

/** Mirrors VerifiedEntityRegistry.RequestStatus. */
export const APPLICATION_STATUS_LABELS = [
  "None",
  "Pending",
  "Approved",
  "Rejected",
  "Withdrawn",
] as const;

export function applicationStatusLabel(status: number): string {
  return APPLICATION_STATUS_LABELS[status] ?? "Unknown";
}

export type RequestStatus =
  | "open"
  | "fully-funded"
  | "disbursed"
  | "closed-unmet"
  | "verification-withdrawn";

export type RequestState = {
  status: RequestStatus;
  /** Short, neutral label for a status chip. */
  label: string;
  /** One plain sentence a donor can act on without reading documentation. */
  detail: string;
  /** Contract will accept `contribute`. */
  canContribute: boolean;
  /** Contract will accept `release` — permissionless, anyone may call it. */
  canRelease: boolean;
  /** Contract will accept `refund` from anyone who contributed. */
  canRefund: boolean;
  remaining: bigint;
  /** 0..100, clamped. */
  progress: number;
  /** Seconds until the deadline; negative once passed. For display only. */
  secondsToDeadline: number;
};

export type DeriveInput = {
  schoolVerified: boolean;
  /** Browser clock, seconds. Used for display, and as a fallback for `chainRefundable`. */
  nowSeconds: number;
  /**
   * The contract's own `refundable` verdict, from `requestSummary` or the lens.
   *
   * Strongly preferred over comparing a deadline to the browser clock. The chain's
   * `block.timestamp` is the only clock that decides whether a call succeeds, and it can
   * differ from a visitor's clock through timezone bugs, a skewed device, or a local
   * chain whose time has been advanced. Offering a Contribute button the vault will
   * reject wastes a donor's gas and their trust.
   */
  chainRefundable?: boolean;
};

export function deriveRequestState(
  request: Pick<FundingRequest, "goal" | "raised" | "deadline" | "disbursed">,
  input: DeriveInput,
): RequestState {
  const { schoolVerified, nowSeconds, chainRefundable } = input;
  const { goal, raised, disbursed } = request;
  const deadline = Number(request.deadline);
  const remaining = goal > raised ? goal - raised : 0n;
  const progress =
    goal <= 0n ? 0 : Math.max(0, Math.min(100, Number((raised * 10_000n) / goal) / 100));
  const secondsToDeadline = deadline - nowSeconds;
  const goalMet = raised >= goal;

  // `refundable` from the chain already encodes "revoked, or deadline passed unmet", so
  // recover the deadline verdict from it rather than trusting the local clock.
  const deadlinePassed =
    chainRefundable === undefined
      ? nowSeconds >= deadline
      : schoolVerified
        ? chainRefundable
        : nowSeconds >= deadline;

  const base = { remaining, progress, secondsToDeadline };

  if (disbursed) {
    return {
      ...base,
      status: "disbursed",
      label: "Delivered",
      detail: "The full amount was paid to the school's verified wallet.",
      canContribute: false,
      canRelease: false,
      canRefund: false,
    };
  }

  // Revocation outranks everything else that is still open. The vault refuses to
  // release to an unverified school and lets contributors withdraw immediately,
  // deadline or not — revocation fails in the only safe direction.
  if (!schoolVerified) {
    return {
      ...base,
      status: "verification-withdrawn",
      label: "Verification withdrawn",
      detail:
        "This school's verification has been revoked, so nothing can be paid out. Every contributor can withdraw their own contribution now.",
      canContribute: false,
      canRelease: false,
      canRefund: true,
    };
  }

  if (goalMet) {
    return {
      ...base,
      status: "fully-funded",
      label: "Fully funded",
      detail:
        "The goal is met. Anyone can now trigger the transfer to the school's verified wallet. It does not require the school or us.",
      canContribute: false,
      canRelease: true,
      canRefund: false,
    };
  }

  if (deadlinePassed) {
    return {
      ...base,
      status: "closed-unmet",
      label: "Closed unmet",
      detail:
        "The deadline passed without the goal being met. Each contributor withdraws their own contribution; nothing was sent to the school.",
      canContribute: false,
      canRelease: false,
      canRefund: true,
    };
  }

  return {
    ...base,
    status: "open",
    label: "Open",
    detail:
      "Accepting contributions. If the goal is met the full amount goes to the school's verified wallet; if it is not, you withdraw your own contribution.",
    canContribute: true,
    canRelease: false,
    canRefund: false,
  };
}

/** Convenience for the lens's RequestView, which already carries the chain's verdicts. */
export function deriveFromView(
  view: RequestView,
  schoolVerified: boolean,
  nowSeconds: number,
): RequestState {
  return deriveRequestState(view.request, {
    schoolVerified,
    nowSeconds,
    chainRefundable: view.refundable,
  });
}

/**
 * Hashes a school-internal student identifier into the opaque bytes32 the vault stores.
 *
 * The identifier itself never leaves the browser. Student PII stays off-chain (R5), and
 * even a bare enrolment number is a re-identification vector once it is public and
 * permanent, so what lands on-chain is a commitment to it rather than the thing itself.
 * A school can still recognise its own students by re-hashing its roster, which is what
 * the reference-matching tool in the school console does.
 */
export function toStudentRef(internalReference: string): Hex {
  return keccak256(stringToHex(internalReference.trim()));
}

export type DeadlineCheck =
  | { ok: true; timestamp: number }
  | { ok: false; error: string };

/** Enforces the vault's MIN_DURATION / MAX_DURATION before any gas is spent. */
export function checkDeadline(timestamp: number | null, nowSeconds: number): DeadlineCheck {
  if (timestamp === null) return { ok: false, error: "Choose a closing date." };
  const earliest = nowSeconds + MIN_DURATION_SECONDS;
  const latest = nowSeconds + MAX_DURATION_SECONDS;
  if (timestamp < earliest) {
    return { ok: false, error: "The closing date must be at least one full day away." };
  }
  if (timestamp > latest) {
    return { ok: false, error: "The closing date cannot be more than one year away." };
  }
  return { ok: true, timestamp };
}

/** Sorts newest-first by id, which is how every feed in the interface reads. */
export function newestFirst(views: readonly RequestView[]): RequestView[] {
  return [...views].sort((a, b) => (b.requestId > a.requestId ? 1 : b.requestId < a.requestId ? -1 : 0));
}

/**
 * A school's headline trust signal, in words.
 *
 * `totalDisbursed` is the number a donor should weigh most heavily, because it is
 * money that actually reached the institution rather than money that was asked for,
 * and it is derived from chain state, so nobody can fake it.
 */
export function describeTrackRecord(stats: SchoolStats): string {
  const delivered = Number(stats.disbursedRequests);
  if (delivered === 0) {
    return stats.totalRequests === 0n
      ? "No fee requests published yet."
      : "No request has reached its goal and been paid out yet.";
  }
  return `Delivered across ${delivered} ${delivered === 1 ? "request" : "requests"}.`;
}
