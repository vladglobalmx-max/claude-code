import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import { issueFolio, reserveNextConsecutive, resolveSequenceYear } from "@/lib/folio/sequence";

const TEST_YEAR = 9999; // año imposible para no chocar con datos reales/demo

async function cleanupTestYear(businessUnitId: string) {
  await prisma.sequenceSettings.deleteMany({ where: { businessUnitId, year: TEST_YEAR } });
}

async function gfb() {
  return prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
}

describe("resolveSequenceYear", () => {
  it("uses the calendar year for ANNUAL and the sentinel 0 for CONTINUOUS", () => {
    const now = new Date("2026-07-16T12:00:00Z");
    expect(resolveSequenceYear("ANNUAL", now)).toBe(2026);
    expect(resolveSequenceYear("CONTINUOUS", now)).toBe(0);
  });
});

describe("reserveNextConsecutive (docs/ARCHITECTURE.md §7.2)", () => {
  it("never collides under concurrency: 50 simultaneous calls yield {1..50} with no duplicates", async () => {
    const businessUnit = await gfb();
    await cleanupTestYear(businessUnit.id);

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        reserveNextConsecutive(prisma, {
          businessUnitId: businessUnit.id,
          documentType: "QUOTATION",
          year: TEST_YEAR,
        }),
      ),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(50);
    expect([...unique].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

    await cleanupTestYear(businessUnit.id);
  });

  it("does not advance the counter when the wrapping transaction rolls back", async () => {
    const businessUnit = await gfb();
    await cleanupTestYear(businessUnit.id);

    const first = await reserveNextConsecutive(prisma, {
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      year: TEST_YEAR,
    });
    expect(first).toBe(1);

    await expect(
      prisma.$transaction(async (tx) => {
        await reserveNextConsecutive(tx, {
          businessUnitId: businessUnit.id,
          documentType: "QUOTATION",
          year: TEST_YEAR,
        });
        throw new Error("simulated failure after reserving a consecutive");
      }),
    ).rejects.toThrow("simulated failure");

    const afterRollback = await reserveNextConsecutive(prisma, {
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      year: TEST_YEAR,
    });
    // Si el rollback hubiera dejado avanzar el contador, esto seria 3, no 2.
    expect(afterRollback).toBe(2);

    await cleanupTestYear(businessUnit.id);
  });

  it("keeps independent series per document type", async () => {
    const businessUnit = await gfb();
    await cleanupTestYear(businessUnit.id);

    const quotation1 = await reserveNextConsecutive(prisma, {
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      year: TEST_YEAR,
    });
    const order1 = await reserveNextConsecutive(prisma, {
      businessUnitId: businessUnit.id,
      documentType: "ORDER",
      year: TEST_YEAR,
    });
    const quotation2 = await reserveNextConsecutive(prisma, {
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      year: TEST_YEAR,
    });

    expect(quotation1).toBe(1);
    expect(order1).toBe(1);
    expect(quotation2).toBe(2);

    await cleanupTestYear(businessUnit.id);
  });
});

describe("issueFolio", () => {
  afterEach(async () => {
    const businessUnit = await gfb();
    await prisma.sequenceSettings.deleteMany({
      where: { businessUnitId: businessUnit.id, year: new Date().getFullYear() },
    });
  });

  it("issues a quotation folio in the long format with the seller code", async () => {
    const businessUnit = await gfb();
    await prisma.sequenceSettings.deleteMany({
      where: { businessUnitId: businessUnit.id, year: new Date().getFullYear() },
    });

    const result = await issueFolio({
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      sellerCode: "DR",
    });

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    expect(result.folio).toBe(`GFB-${now.getFullYear()}-${month}-0001-DR`);
    expect(result.consecutive).toBe(1);

    const second = await issueFolio({
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      sellerCode: "DR",
    });
    expect(second.consecutive).toBe(2);
    expect(second.folio).not.toBe(result.folio);
  });

  it("issues an order folio in the PED- format, independent from quotations", async () => {
    const businessUnit = await gfb();

    const quotation = await issueFolio({
      businessUnitId: businessUnit.id,
      documentType: "QUOTATION",
      sellerCode: "DR",
    });
    const order = await issueFolio({
      businessUnitId: businessUnit.id,
      documentType: "ORDER",
      sellerCode: "DR",
    });

    expect(order.folio).toBe(`PED-GFB-${new Date().getFullYear()}-0001`);
    expect(quotation.consecutive).toBe(1);
    expect(order.consecutive).toBe(1);
  });
});
