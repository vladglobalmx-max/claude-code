import { describe, expect, it } from "vitest";
import { DocumentSchema } from "./document.js";
import { buildMinimalDocument } from "../testUtils/fixtures.js";

describe("DocumentSchema", () => {
  it("valida un documento mínimo bien formado", () => {
    const document = buildMinimalDocument();
    expect(() => DocumentSchema.parse(document)).not.toThrow();
  });

  it("rechaza un documento sin páginas", () => {
    const document = buildMinimalDocument();
    expect(() => DocumentSchema.parse({ ...document, pages: [] })).toThrow();
  });

  it("rechaza un documentVersion no entero o no positivo", () => {
    const document = buildMinimalDocument();
    expect(() => DocumentSchema.parse({ ...document, documentVersion: 0 })).toThrow();
    expect(() => DocumentSchema.parse({ ...document, documentVersion: 1.5 })).toThrow();
  });

  it("rechaza un schemaVersion faltante", () => {
    const document = buildMinimalDocument() as Record<string, unknown>;
    const withoutVersion = { ...document };
    delete withoutVersion.schemaVersion;
    expect(() => DocumentSchema.parse(withoutVersion)).toThrow();
  });
});
