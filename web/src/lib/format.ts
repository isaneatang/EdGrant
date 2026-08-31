import { TOKEN_DECIMALS, TOKEN_SYMBOL } from "./contracts";

/**
 * Presentation helpers.
 *
 * Two rules govern everything here.
 *
 * 1. DETERMINISM. Dates are formatted with a fixed locale and a fixed time zone
 *    (UTC) so the server-rendered shell and the client agree exactly. Chain data is
 *    global and immutable; rendering it differently per visitor invites hydration
 *    drift and, worse, two people reading different deadlines off the same request.
 *
 * 2. NO URGENCY. Deadlines render as a plain date. Time remaining, where shown at
 *    all, is coarse and unstyled. Never a live countdown, never colour-coded into
 *    alarm. Urgency is the primary tool of crowdfunding fraud; a product whose whole
 *    claim is structural trustworthiness must not borrow its visual language.
 */

const UNIT = 10n ** BigInt(TOKEN_DECIMALS);

const wholeFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

/** `1234500000n` -> `"1,234.50"`. Never lossy: the integer path is exact. */
export function formatUnits6(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / UNIT;
  const frac = abs % UNIT;
  // Build the decimal string by hand, then let Intl group the integer part. Going
  // through Number() would lose precision above 2^53 units.
  const fracStr = frac.toString().padStart(TOKEN_DECIMALS, "0").slice(0, 2);
  const grouped = wholeFormatter.format(whole);
  return `${negative ? "-" : ""}${grouped}.${fracStr}`;
}

/** `1234500000n` -> `"1,234.50 USDT"`. */
export function formatAmount(value: bigint, opts?: { symbol?: boolean }): string {
  const text = formatUnits6(value);
  return opts?.symbol === false ? text : `${text} ${TOKEN_SYMBOL}`;
}

/** Compact form for dense lists: `"1,235"` with no decimals when they are zero. */
export function formatAmountCompact(value: bigint): string {
  if (value % UNIT === 0n) return `${wholeFormatter.format(value / UNIT)} ${TOKEN_SYMBOL}`;
  return formatAmount(value);
}

export type ParseResult =
  | { ok: true; value: bigint }
  | { ok: false; error: string };

/**
 * Parses a user-typed amount into token units.
 *
 * Rejects rather than rounds. A donor must never be charged an amount they did not
 * type, which is the same reason the vault reverts on over-contribution instead of
 * silently trimming.
 */
export function parseAmount(input: string): ParseResult {
  const raw = input.trim().replace(/,/g, "");
  if (raw === "") return { ok: false, error: "Enter an amount." };
  if (!/^\d*(\.\d*)?$/.test(raw)) return { ok: false, error: "Digits and one decimal point only." };

  const [wholeRaw = "", fracRaw = ""] = raw.split(".");
  if (wholeRaw === "" && fracRaw === "") return { ok: false, error: "Enter an amount." };
  if (fracRaw.length > TOKEN_DECIMALS) {
    return { ok: false, error: `${TOKEN_SYMBOL} has ${TOKEN_DECIMALS} decimal places.` };
  }

  const whole = wholeRaw === "" ? 0n : BigInt(wholeRaw);
  const frac = fracRaw === "" ? 0n : BigInt(fracRaw.padEnd(TOKEN_DECIMALS, "0"));
  const value = whole * UNIT + frac;
  if (value === 0n) return { ok: false, error: "Enter an amount greater than zero." };
  return { ok: true, value };
}

/** Round-trips with `parseAmount`: full precision, no grouping, for input fields. */
export function toAmountInput(value: bigint): string {
  const whole = value / UNIT;
  const frac = value % UNIT;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(TOKEN_DECIMALS, "0").replace(/0+$/, "")}`;
}

/**
 * Progress as a percentage.
 *
 * A non-zero contribution never renders as "0%". Someone who has given something must not
 * be told the request has received nothing, so anything above zero that rounds down to
 * nothing shows as "<1%", and anything short of the goal that rounds up to 100 shows as
 * ">99%". Rounding must never contradict the actual state.
 */
export function formatPercent(raised: bigint, goal: bigint): string {
  if (goal <= 0n) return "0%";
  if (raised <= 0n) return "0%";
  if (raised >= goal) return "100%";

  const bps = (raised * 10_000n) / goal;
  const pct = Number(bps) / 100;
  if (pct < 1) return "<1%";
  if (pct > 99) return ">99%";
  return `${Math.round(pct)}%`;
}

/** Clamped to 0..100 for bar widths. */
export function percentValue(raised: bigint, goal: bigint): number {
  if (goal <= 0n) return 0;
  const bps = Number((raised * 10_000n) / goal);
  return Math.max(0, Math.min(100, bps / 100));
}

export function shortAddress(address: string | undefined, chars = 4): string {
  if (!address) return "";
  if (address.length <= 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

/** bytes32 -> a short, unambiguous label. Never expanded into anything human-readable. */
export function shortHash(hash: string | undefined, chars = 6): string {
  if (!hash) return "";
  return `${hash.slice(0, 2 + chars)}…${hash.slice(-4)}`;
}

/** Seconds since epoch (uint64 from the chain) -> `"30 September 2026"`. */
export function formatDate(seconds: bigint | number | undefined): string {
  if (seconds === undefined) return "-";
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return dateFormatter.format(new Date(ms));
}

export function formatDateTime(seconds: bigint | number | undefined): string {
  if (seconds === undefined) return "-";
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return `${dateTimeFormatter.format(new Date(ms))} UTC`;
}

/**
 * Coarse, past-tense-safe interval. Deliberately vague and deliberately not live:
 * "about 3 weeks", never "2d 14h 09m".
 */
export function formatCoarseInterval(seconds: number): string {
  const s = Math.abs(Math.round(seconds));
  if (s < 60) return "under a minute";
  if (s < 3600) return `${Math.round(s / 60)} minutes`;
  if (s < 86_400) {
    const hours = Math.round(s / 3600);
    return hours === 1 ? "about an hour" : `about ${hours} hours`;
  }
  const days = Math.round(s / 86_400);
  if (days === 1) return "about a day";
  if (days < 14) return `about ${days} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days < 365) return `about ${Math.round(days / 30)} months`;
  return `over a year`;
}

/** `"Closes 30 September 2026"` / `"Closed 4 August 2026"`. A fact, not a threat. */
export function describeDeadline(deadline: bigint, nowSeconds: number): string {
  const passed = nowSeconds >= Number(deadline);
  return `${passed ? "Closed" : "Closes"} ${formatDate(deadline)}`;
}

/** ISO `yyyy-mm-dd` in UTC, for `<input type="date">` round-tripping. */
export function toDateInput(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** Interprets a `<input type="date">` value as 23:59:59 UTC on that day. */
export function fromDateInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T23:59:59Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * UTF-8 byte length.
 *
 * SchoolProfile's limits (MAX_SHORT, MAX_URI, MAX_DESCRIPTION, MAX_TITLE, MAX_BODY) are
 * `bytes(...).length`, not character counts. A form that counted characters would let a
 * school type a description full of accents or emoji, pay gas, and get reverted with
 * StringTooLong. Counted properly, the form refuses before the wallet ever opens.
 */
const encoder = new TextEncoder();

export function byteLength(value: string): number {
  return encoder.encode(value).length;
}
