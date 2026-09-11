import { describe, expect, it } from "vitest";
import { catalogProductSchema } from "./catalog";

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sku: "TP-0001",
    name: "Proyector LED Dual",
    product_type_id: "b8f5b1a0-1111-4444-8888-000000000001",
    business_unit_ids: [],
    active: true,
    ...overrides,
  };
}

/**
 * THÖREN — Catálogo UX (Organization → BU → Product Type → Products):
 * product_type_id es obligatorio en el SERVIDOR, no solo en
 * catalog-form.tsx — capa 1 (cliente) nunca es suficiente por sí sola
 * (mismo criterio que el resto del proyecto, ver custom-fields/validation.ts).
 */
describe("catalogProductSchema — product_type_id obligatorio (THÖREN Catálogo UX)", () => {
  it("acepta un payload válido con product_type_id", () => {
    const result = catalogProductSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rechaza product_type_id null", () => {
    const result = catalogProductSchema.safeParse(validPayload({ product_type_id: null }));
    expect(result.success).toBe(false);
  });

  it("rechaza product_type_id ausente", () => {
    const { product_type_id: _omit, ...rest } = validPayload();
    const result = catalogProductSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rechaza product_type_id vacío", () => {
    const result = catalogProductSchema.safeParse(validPayload({ product_type_id: "" }));
    expect(result.success).toBe(false);
  });

  it("rechaza un product_type_id que no es un uuid válido", () => {
    const result = catalogProductSchema.safeParse(validPayload({ product_type_id: "no-es-uuid" }));
    expect(result.success).toBe(false);
  });
});
