import { describe, expect, it } from "vitest";
import { PageSchema, GridConfigSchema } from "./page.js";
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

  it("un documento sin `grid` (anterior a Fase 7.3) recibe los defaults explícitos", () => {
    const page = PageSchema.parse({
      id: PageIdSchema.parse("page_4"),
      size: { width: 100, height: 100 },
      metadata: { createdAt: NOW, updatedAt: NOW },
    });
    expect(page.grid).toEqual({ visible: false, snapEnabled: false, size: 10, type: "lines" });
  });

  it("acepta un `grid` parcial, defaulteando los campos ausentes", () => {
    const page = PageSchema.parse({
      id: PageIdSchema.parse("page_5"),
      size: { width: 100, height: 100 },
      grid: { visible: true, size: 20 },
      metadata: { createdAt: NOW, updatedAt: NOW },
    });
    expect(page.grid).toEqual({ visible: true, snapEnabled: false, size: 20, type: "lines" });
  });
});

describe("GridConfigSchema", () => {
  it("rechaza size cero, negativo, NaN o infinito", () => {
    expect(() => GridConfigSchema.parse({ size: 0 })).toThrow();
    expect(() => GridConfigSchema.parse({ size: -5 })).toThrow();
    expect(() => GridConfigSchema.parse({ size: NaN })).toThrow();
    expect(() => GridConfigSchema.parse({ size: Infinity })).toThrow();
  });

  it("rechaza un `type` fuera del único valor soportado hoy", () => {
    expect(() => GridConfigSchema.parse({ type: "dots" })).toThrow();
  });

  it("acepta un size positivo válido", () => {
    expect(GridConfigSchema.parse({ size: 25 }).size).toBe(25);
  });
});
