import { describe, expect, it } from "vitest";

import { computeWeightedAmount, followupBucket, isQuotationExpired } from "@/lib/followups/rules";

const NOW = new Date("2026-07-16T12:00:00.000Z");

describe("isQuotationExpired (docs/ARCHITECTURE.md §6.1, Módulo 11)", () => {
  it("expires a SENT quotation whose validUntil has passed", () => {
    expect(
      isQuotationExpired({ status: "SENT", validUntil: new Date("2026-07-01T00:00:00.000Z"), now: NOW }),
    ).toBe(true);
  });

  it("does not expire a SENT quotation still within its validity window", () => {
    expect(
      isQuotationExpired({ status: "SENT", validUntil: new Date("2026-08-01T00:00:00.000Z"), now: NOW }),
    ).toBe(false);
  });

  it("does not expire a SENT quotation with no validUntil at all", () => {
    expect(isQuotationExpired({ status: "SENT", validUntil: null, now: NOW })).toBe(false);
  });

  it("does not expire quotations outside SENT, even past their validity date", () => {
    for (const status of [
      "DRAFT",
      "PENDING_APPROVAL",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "CONVERTED_TO_ORDER",
    ] as const) {
      expect(
        isQuotationExpired({ status, validUntil: new Date("2026-07-01T00:00:00.000Z"), now: NOW }),
      ).toBe(false);
    }
  });
});

describe("followupBucket (docs/ARCHITECTURE.md §9, Módulo 11)", () => {
  it("classifies any terminal status as DONE regardless of nextFollowupAt", () => {
    for (const status of ["ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED", "CONVERTED_TO_ORDER"] as const) {
      expect(followupBucket({ quotationStatus: status, nextFollowupAt: null, now: NOW })).toBe("DONE");
      expect(
        followupBucket({ quotationStatus: status, nextFollowupAt: new Date("2026-07-01"), now: NOW }),
      ).toBe("DONE");
    }
  });

  it("classifies an open quotation with no scheduled follow-up as NONE", () => {
    expect(followupBucket({ quotationStatus: "SENT", nextFollowupAt: null, now: NOW })).toBe("NONE");
  });

  it("classifies a past-due follow-up as OVERDUE", () => {
    expect(
      followupBucket({ quotationStatus: "SENT", nextFollowupAt: new Date("2026-07-15T09:00:00.000Z"), now: NOW }),
    ).toBe("OVERDUE");
  });

  it("classifies a follow-up scheduled for later today as TODAY", () => {
    expect(
      followupBucket({ quotationStatus: "SENT", nextFollowupAt: new Date("2026-07-16T23:00:00.000Z"), now: NOW }),
    ).toBe("TODAY");
    expect(
      followupBucket({ quotationStatus: "SENT", nextFollowupAt: new Date("2026-07-16T00:00:00.000Z"), now: NOW }),
    ).toBe("TODAY");
  });

  it("classifies a follow-up scheduled for a future day as UPCOMING", () => {
    expect(
      followupBucket({ quotationStatus: "SENT", nextFollowupAt: new Date("2026-07-17T00:00:00.000Z"), now: NOW }),
    ).toBe("UPCOMING");
  });
});

describe("computeWeightedAmount (docs/ARCHITECTURE.md §5.2, Módulo 11)", () => {
  it("returns null when there is no probability set", () => {
    expect(computeWeightedAmount(1000, null)).toBeNull();
  });

  it("computes total times probability, never storing it", () => {
    expect(computeWeightedAmount(1000, 40)?.toNumber()).toBe(400);
    expect(computeWeightedAmount(1428.57, 30)?.toNumber()).toBeCloseTo(428.57, 2);
  });
});
