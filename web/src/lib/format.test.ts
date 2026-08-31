import { describe, expect, it } from "vitest";
import {
  byteLength,
  describeDeadline,
  formatAmount,
  formatAmountCompact,
  formatCoarseInterval,
  formatDate,
  formatDateTime,
  formatPercent,
  formatUnits6,
  fromDateInput,
  parseAmount,
  percentValue,
  shortAddress,
  shortHash,
  toAmountInput,
  toDateInput,
} from "./format";

const USD = 1_000_000n;

describe("formatUnits6", () => {
  it("formats whole and fractional amounts exactly", () => {
    expect(formatUnits6(0n)).toBe("0.00");
    expect(formatUnits6(1n)).toBe("0.00"); // 0.000001 truncates at 2dp for display
    expect(formatUnits6(10_000n)).toBe("0.01");
    expect(formatUnits6(450n * USD)).toBe("450.00");
    expect(formatUnits6(1_234_500_000n)).toBe("1,234.50");
  });

  it("stays exact far above Number.MAX_SAFE_INTEGER", () => {
    // 10 trillion USDT. Going through Number() would silently lose the tail digits,
    // which for a product about money is not an acceptable rounding.
    const huge = 10_000_000_000_000n * USD;
    expect(formatUnits6(huge)).toBe("10,000,000,000,000.00");
  });

  it("handles negatives without mangling the group separators", () => {
    expect(formatUnits6(-1_234_500_000n)).toBe("-1,234.50");
  });
});

describe("formatAmount / formatAmountCompact", () => {
  it("appends the symbol unless told not to", () => {
    expect(formatAmount(450n * USD)).toBe("450.00 USDT");
    expect(formatAmount(450n * USD, { symbol: false })).toBe("450.00");
  });

  it("drops trailing zeroes only when the amount is exactly whole", () => {
    expect(formatAmountCompact(450n * USD)).toBe("450 USDT");
    expect(formatAmountCompact(450n * USD + 500_000n)).toBe("450.50 USDT");
  });
});

describe("parseAmount", () => {
  it("accepts plain and grouped decimal input", () => {
    expect(parseAmount("450")).toEqual({ ok: true, value: 450n * USD });
    expect(parseAmount("450.50")).toEqual({ ok: true, value: 450_500_000n });
    expect(parseAmount("1,234.50")).toEqual({ ok: true, value: 1_234_500_000n });
    expect(parseAmount("  12  ")).toEqual({ ok: true, value: 12n * USD });
    expect(parseAmount(".5")).toEqual({ ok: true, value: 500_000n });
  });

  it("rejects rather than rounds beyond six decimals", () => {
    // The vault reverts on over-contribution instead of trimming, for the same reason:
    // a donor must never be charged an amount they did not type.
    const result = parseAmount("1.1234567");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("6 decimal places");
  });

  it("rejects empty, zero, negative, and non-numeric input", () => {
    expect(parseAmount("").ok).toBe(false);
    expect(parseAmount("0").ok).toBe(false);
    expect(parseAmount("0.00").ok).toBe(false);
    expect(parseAmount("-5").ok).toBe(false);
    expect(parseAmount("abc").ok).toBe(false);
    expect(parseAmount("1.2.3").ok).toBe(false);
    expect(parseAmount("1e6").ok).toBe(false);
    expect(parseAmount("Infinity").ok).toBe(false);
  });

  it("round-trips through toAmountInput", () => {
    for (const value of [1n, 500_000n, 450n * USD, 1_234_567n, 999_999_999_999n]) {
      const text = toAmountInput(value);
      const parsed = parseAmount(text);
      expect(parsed.ok, `failed for ${value}`).toBe(true);
      if (parsed.ok) expect(parsed.value).toBe(value);
    }
  });
});

describe("percentages", () => {
  it("never lets rounding contradict the actual state", () => {
    expect(formatPercent(0n, 100n * USD)).toBe("0%");
    // Someone who has given something must never be told the request received nothing.
    expect(formatPercent(1n, 100n * USD)).toBe("<1%");
    expect(formatPercent(50n * USD, 100n * USD)).toBe("50%");
    // Nor may a request one unit short of its goal claim to be complete.
    expect(formatPercent(100n * USD - 1n, 100n * USD)).toBe(">99%");
    expect(formatPercent(100n * USD, 100n * USD)).toBe("100%");
    expect(formatPercent(200n * USD, 100n * USD)).toBe("100%");
  });

  it("treats a zero goal as zero rather than dividing by it", () => {
    expect(formatPercent(5n, 0n)).toBe("0%");
    expect(percentValue(5n, 0n)).toBe(0);
  });

  it("clamps the bar width to 0..100", () => {
    expect(percentValue(200n * USD, 100n * USD)).toBe(100);
    expect(percentValue(0n, 100n * USD)).toBe(0);
    expect(percentValue(25n * USD, 100n * USD)).toBe(25);
  });
});

describe("addresses and hashes", () => {
  it("truncates in the middle and keeps the 0x prefix", () => {
    expect(shortAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe("0xf39F…2266");
    expect(shortAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 6)).toBe("0xf39Fd6…b92266");
    expect(shortAddress(undefined)).toBe("");
  });

  it("shortens a bytes32 without pretending it is readable", () => {
    const hash = "0x" + "ab".repeat(32);
    expect(shortHash(hash)).toBe("0xababab…abab");
    expect(shortHash(hash, 10)).toBe("0xababababab…abab");
  });
});

describe("dates", () => {
  // 2026-09-30T23:59:59Z
  const deadline = 1790812799n;

  it("formats deterministically in UTC, so every reader sees the same date", () => {
    expect(formatDate(deadline)).toBe("30 September 2026");
    // en-GB abbreviates September as "Sept". Pinned deliberately: the locale and time
    // zone are fixed so the server-rendered shell and the client cannot disagree, and so
    // two people never read different deadlines off the same request.
    expect(formatDateTime(deadline)).toBe("30 Sept 2026, 23:59 UTC");
  });

  it("renders a missing or zero timestamp as an em dash, not 1970", () => {
    expect(formatDate(0n)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDateTime(0n)).toBe("-");
  });

  it("describes a deadline as a fact, in the right tense", () => {
    expect(describeDeadline(deadline, 1780000000)).toBe("Closes 30 September 2026");
    expect(describeDeadline(deadline, 1799999999)).toBe("Closed 30 September 2026");
  });

  it("round-trips a date input at end of day UTC", () => {
    const seconds = fromDateInput("2026-09-30");
    expect(seconds).toBe(Number(deadline));
    expect(toDateInput(Number(deadline))).toBe("2026-09-30");
  });

  it("rejects malformed date input", () => {
    expect(fromDateInput("")).toBeNull();
    expect(fromDateInput("30/09/2026")).toBeNull();
    expect(fromDateInput("2026-9-3")).toBeNull();
  });
});

describe("formatCoarseInterval", () => {
  it("is coarse on purpose, never a countdown", () => {
    expect(formatCoarseInterval(30)).toBe("under a minute");
    expect(formatCoarseInterval(600)).toBe("10 minutes");
    expect(formatCoarseInterval(3600)).toBe("about an hour");
    expect(formatCoarseInterval(86_400)).toBe("about a day");
    expect(formatCoarseInterval(3 * 86_400)).toBe("about 3 days");
    expect(formatCoarseInterval(21 * 86_400)).toBe("about 3 weeks");
    expect(formatCoarseInterval(90 * 86_400)).toBe("about 3 months");
    expect(formatCoarseInterval(400 * 86_400)).toBe("over a year");
  });

  it("is sign-agnostic, so the same helper reads correctly for past and future", () => {
    expect(formatCoarseInterval(-3 * 86_400)).toBe("about 3 days");
  });
});

describe("byteLength", () => {
  it("counts UTF-8 bytes, because that is what the contracts check", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("é")).toBe(2);
    expect(byteLength("日本語")).toBe(9);
    // A form counting characters would let this through a 128-byte field and then
    // revert with StringTooLong after the user paid gas.
    expect(byteLength("é".repeat(100))).toBe(200);
  });
});
