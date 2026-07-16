import { describe, expect, it } from "vitest";

import { computeQuotationKpis, groupQuotationKpis, type KpiQuotationInput } from "@/lib/dashboard/kpis";

function q(status: KpiQuotationInput["status"], total: number, marginPct: number | null = null): KpiQuotationInput {
  return { status, total, marginPct };
}

describe("computeQuotationKpis (docs/ARCHITECTURE.md §9.2/§10, Módulo 13)", () => {
  it("excludes DRAFT and PENDING_APPROVAL from 'cotizado' — the client never saw them", () => {
    const kpis = computeQuotationKpis([q("DRAFT", 1000), q("PENDING_APPROVAL", 2000), q("SENT", 500)]);
    expect(kpis.quotedCount).toBe(1);
    expect(kpis.quotedTotal.toString()).toBe("500");
  });

  it("classifies ACCEPTED and CONVERTED_TO_ORDER as won", () => {
    const kpis = computeQuotationKpis([q("ACCEPTED", 100), q("CONVERTED_TO_ORDER", 200), q("SENT", 300)]);
    expect(kpis.wonCount).toBe(2);
    expect(kpis.wonTotal.toString()).toBe("300");
    expect(kpis.quotedTotal.toString()).toBe("600");
  });

  it("classifies REJECTED, EXPIRED and CANCELLED as lost", () => {
    const kpis = computeQuotationKpis([q("REJECTED", 100), q("EXPIRED", 200), q("CANCELLED", 300)]);
    expect(kpis.lostCount).toBe(3);
    expect(kpis.lostTotal.toString()).toBe("600");
  });

  it("computes conversion rate as won / (won + lost), ignoring still-open SENT quotations", () => {
    const kpis = computeQuotationKpis([
      q("ACCEPTED", 100),
      q("ACCEPTED", 100),
      q("REJECTED", 100),
      q("SENT", 999999),
    ]);
    expect(kpis.conversionRatePct?.toString()).toBe("66.666666666666666667");
  });

  it("conversion rate is null when nothing has been decided yet", () => {
    const kpis = computeQuotationKpis([q("SENT", 100)]);
    expect(kpis.conversionRatePct).toBeNull();
  });

  it("averages margin only across quotations that have one, skipping drafts and nulls", () => {
    const kpis = computeQuotationKpis([
      q("SENT", 100, 30),
      q("ACCEPTED", 100, 20),
      q("DRAFT", 100, 50), // excluded: not quoted yet
      q("SENT", 100, null), // no margin computed (e.g. no items)
    ]);
    expect(kpis.averageMarginPct?.toString()).toBe("25");
  });

  it("average margin is null when no quoted quotation has one", () => {
    const kpis = computeQuotationKpis([q("SENT", 100, null)]);
    expect(kpis.averageMarginPct).toBeNull();
  });

  it("reconciles exactly against the sum of the inputs — no rounding drift", () => {
    const rows = [q("SENT", 123.45), q("ACCEPTED", 67.89), q("REJECTED", 10.01)];
    const kpis = computeQuotationKpis(rows);
    const directSum = rows.reduce((acc, r) => acc + Number(r.total), 0);
    expect(kpis.quotedTotal.toNumber()).toBeCloseTo(directSum, 8);
  });
});

describe("groupQuotationKpis", () => {
  it("groups by an arbitrary key, preserving first-appearance order", () => {
    const rows = [
      { status: "SENT" as const, total: 100, marginPct: null, line: "GFB" },
      { status: "ACCEPTED" as const, total: 200, marginPct: null, line: "TSS" },
      { status: "REJECTED" as const, total: 50, marginPct: null, line: "GFB" },
    ];
    const groups = groupQuotationKpis(rows, (r) => r.line);

    expect(groups.map((g) => g.key)).toEqual(["GFB", "TSS"]);
    expect(groups[0].kpis.quotedCount).toBe(2);
    expect(groups[0].kpis.quotedTotal.toString()).toBe("150");
    expect(groups[1].kpis.wonTotal.toString()).toBe("200");
  });

  it("returns an empty array for an empty input", () => {
    expect(groupQuotationKpis([], (r: KpiQuotationInput) => r.status)).toEqual([]);
  });
});
