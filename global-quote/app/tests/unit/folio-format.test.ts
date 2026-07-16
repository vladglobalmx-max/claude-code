import { describe, expect, it } from "vitest";

import {
  appendVersion,
  displayFolio,
  formatLongFolio,
  formatOrderFolio,
  formatShortFolio,
  padConsecutive,
} from "@/lib/folio/format";

describe("folio format (docs/ARCHITECTURE.md §7.1)", () => {
  it("matches the brief's long-format examples exactly", () => {
    expect(
      formatLongFolio({ lineCode: "TSS", year: 2026, month: 7, consecutive: 1, sellerCode: "KS" }),
    ).toBe("TSS-2026-07-0001-KS");
    expect(
      formatLongFolio({ lineCode: "GFB", year: 2026, month: 7, consecutive: 2, sellerCode: "VP" }),
    ).toBe("GFB-2026-07-0002-VP");
    expect(
      formatLongFolio({ lineCode: "JUN", year: 2026, month: 7, consecutive: 3, sellerCode: "EH" }),
    ).toBe("JUN-2026-07-0003-EH");
    expect(
      formatLongFolio({ lineCode: "GTX", year: 2026, month: 7, consecutive: 4, sellerCode: "AP" }),
    ).toBe("GTX-2026-07-0004-AP");
  });

  it("matches the brief's short-format example exactly", () => {
    expect(formatShortFolio({ lineCode: "TSS", year: 2026, month: 7, consecutive: 1 })).toBe(
      "TSS-2607-0001",
    );
  });

  it("matches the brief's order-folio example exactly", () => {
    expect(formatOrderFolio({ lineCode: "TSS", year: 2026, consecutive: 1 })).toBe(
      "PED-TSS-2026-0001",
    );
  });

  it("versions a folio without altering the root folio", () => {
    const base = formatLongFolio({
      lineCode: "TSS",
      year: 2026,
      month: 7,
      consecutive: 1,
      sellerCode: "KS",
    });
    expect(appendVersion(base, 1)).toBe("TSS-2026-07-0001-KS-V1");
    expect(appendVersion(base, 2)).toBe("TSS-2026-07-0001-KS-V2");
    expect(base).toBe("TSS-2026-07-0001-KS");
  });

  it("pads the consecutive to 4 digits by default, without truncating larger numbers", () => {
    expect(padConsecutive(1)).toBe("0001");
    expect(padConsecutive(42)).toBe("0042");
    expect(padConsecutive(12345)).toBe("12345");
  });

  it("displayFolio shows the bare folio for version 1 and the -V{n} suffix from version 2 onward (docs/ARCHITECTURE.md §7.3, Módulo 8)", () => {
    const base = "TSS-2026-07-0001-KS";
    expect(displayFolio(base, 1)).toBe("TSS-2026-07-0001-KS");
    expect(displayFolio(base, 2)).toBe("TSS-2026-07-0001-KS-V2");
    expect(displayFolio(base, 3)).toBe("TSS-2026-07-0001-KS-V3");
  });
});
