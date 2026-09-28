import { describe, expect, it } from "vitest";

import { bucketLabel, bucketTitle, formatMoneyCompact, formatRate, parseRange } from "@/features/dashboard/format";

describe("dashboard formatting", () => {
  it("never shows a rate it doesn't have", () => {
    expect(formatRate(undefined)).toBe("—");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(Number.NaN)).toBe("—");
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatRate(66.7)).toBe("66.7%");
    expect(formatRate(100)).toBe("100%");
    expect(formatRate(0)).toBe("0%");
  });

  it("compacts large money but keeps small amounts exact", () => {
    expect(formatMoneyCompact(0)).toBe("$0");
    expect(formatMoneyCompact(950)).toBe("$950");
    expect(formatMoneyCompact(9999)).toBe("$9,999");
    expect(formatMoneyCompact(12500)).toBe("$12.5K");
    expect(formatMoneyCompact(4_200_000)).toBe("$4.2M");
  });

  it("labels trend buckets as UTC calendar dates", () => {
    expect(bucketLabel("2026-03-01", "MONTH")).toBe("Mar");
    expect(bucketTitle("2026-03-01", "MONTH")).toBe("March 2026");
    expect(bucketLabel("2026-09-21", "WEEK")).toBe("Sep 21");
    expect(bucketTitle("2026-09-21", "WEEK")).toBe("Week of Sep 21, 2026");
  });

  it("only accepts known periods from the URL", () => {
    expect(parseRange("LAST_30_DAYS")).toBe("LAST_30_DAYS");
    expect(parseRange("FOREVER")).toBe("LAST_12_MONTHS");
    expect(parseRange(undefined)).toBe("LAST_12_MONTHS");
  });
});
