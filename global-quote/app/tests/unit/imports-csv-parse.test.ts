import { describe, expect, it } from "vitest";

import { csvRowsToRecords, parseCsv } from "@/lib/imports/csv-parse";

describe("parseCsv (Módulo 14)", () => {
  it("splits a simple comma-separated file into rows", () => {
    const rows = parseCsv("a,b,c\n1,2,3\n");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas and doubled quotes", () => {
    const rows = parseCsv('name,note\n"Acme, Inc.","she said ""hi"""\n');
    expect(rows).toEqual([
      ["name", "note"],
      ["Acme, Inc.", 'she said "hi"'],
    ]);
  });

  it("handles a newline embedded inside a quoted field", () => {
    const rows = parseCsv('a,b\n"line1\nline2",x\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("normalizes CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("does not produce a phantom trailing row when the file ends without a newline", () => {
    const rows = parseCsv("a,b\n1,2");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("csvRowsToRecords", () => {
  it("maps rows to objects keyed by the trimmed header", () => {
    const records = csvRowsToRecords([
      [" sku ", "name"],
      ["GFB-001", "Enjuague"],
    ]);
    expect(records).toEqual([{ sku: "GFB-001", name: "Enjuague" }]);
  });

  it("fills missing trailing columns with an empty string", () => {
    const records = csvRowsToRecords([
      ["sku", "name", "notes"],
      ["GFB-001", "Enjuague"],
    ]);
    expect(records).toEqual([{ sku: "GFB-001", name: "Enjuague", notes: "" }]);
  });

  it("returns an empty array when there are no rows at all", () => {
    expect(csvRowsToRecords([])).toEqual([]);
  });
});
