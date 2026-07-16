import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/dashboard/csv";

describe("toCsv (Módulo 13)", () => {
  it("joins headers and rows with CRLF, RFC 4180 style", () => {
    const csv = toCsv(["Folio", "Total"], [["GFB-2026-07-0001-DR", 100]]);
    expect(csv).toBe("Folio,Total\r\nGFB-2026-07-0001-DR,100\r\n");
  });

  it("quotes fields containing a comma, quote, or newline, doubling internal quotes", () => {
    const csv = toCsv(["A"], [['has "quotes", a comma\nand a newline']]);
    expect(csv).toBe('A\r\n"has ""quotes"", a comma\nand a newline"\r\n');
  });

  it("returns just the header row (plus terminator) when there are no rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B\r\n");
  });
});
