import { describe, expect, it } from "vitest";
import { PageSchema } from "./page.js";
import { PageIdSchema } from "../primitives/identifiers.js";

const NOW = "2026-07-17T00:00:00.000Z";

describe("PageSchema", () => {
  it("aplica unit por defecto 'px' y layers []", () => {
    const page = PageSchema.parse({
      id: PageIdSchema.parse("page_1"),
      size: { width: 500, height: 500 },
      metadata: { createdAt: NOW, updatedAt: NOW },
    });
    expect(page.unit).toBe("px");
    expect(page.layers).toEqual([]);
  });

  it("acepta unidades físicas mm/in para páginas de impresión", () => {
    const page = PageSchema.parse({
      id: PageIdSchema.parse("page_2"),
      size: { width: 50, height: 50 },
      unit: "mm",
      metadata: { createdAt: NOW, updatedAt: NOW },
    });
    expect(page.unit).toBe("mm");
  });

  it("rechaza una unit fuera del enum", () => {
    expect(() =>
      PageSchema.parse({
        id: PageIdSchema.parse("page_3"),
        size: { width: 10, height: 10 },
        unit: "cm",
        metadata: { createdAt: NOW, updatedAt: NOW },
      }),
    ).toThrow();
  });
});
