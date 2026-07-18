import { describe, expect, it } from "vitest";
import { DocumentSchema } from "./document.js";
import { buildMinimalDocument, NOW } from "../testUtils/fixtures.js";
import { AssetIdSchema } from "../primitives/identifiers.js";

describe("DocumentSchema", () => {
  it("valida un documento mínimo bien formado", () => {
    const document = buildMinimalDocument();
    expect(() => DocumentSchema.parse(document)).not.toThrow();
  });

  it("assets tiene default [] cuando se omite (aditivo: documentos previos a este campo siguen siendo válidos)", () => {
    const document = buildMinimalDocument() as Record<string, unknown>;
    delete document.assets;
    const parsed = DocumentSchema.parse(document);
    expect(parsed.assets).toEqual([]);
  });

  it("acepta un array de assets válido", () => {
    const document = buildMinimalDocument();
    const parsed = DocumentSchema.parse({
      ...document,
      assets: [
        {
          id: AssetIdSchema.parse("asset_1"),
          type: "image",
          name: "logo.png",
          mimeType: "image/png",
          width: 10,
          height: 10,
          metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
          pluginData: {},
          customProperties: {},
        },
      ],
    });
    expect(parsed.assets).toHaveLength(1);
  });

  it("rechaza un asset inválido dentro de assets", () => {
    const document = buildMinimalDocument();
    expect(() =>
      DocumentSchema.parse({
        ...document,
        assets: [{ id: AssetIdSchema.parse("asset_1"), type: "image", name: "logo.png", mimeType: "image/png" }],
      }),
    ).toThrow();
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
