import { describe, expect, it } from "vitest";
import { directPurchaseOrderPayloadSchema } from "./purchase-order";

const basePayload = {
  business_unit_id: "11111111-1111-1111-1111-111111111111",
  supplier_id: "22222222-2222-2222-2222-222222222222",
  direct_purchase_reason: "stock" as const,
  currency: "MXN" as const,
  items: [{ description: "Servicio de instalación", quantity_ordered: 1, unit_price: 100 }],
};

describe("directPurchaseOrderPayloadSchema (THÖREN — Orden de Compra Directa, 0081)", () => {
  it("acepta el payload mínimo válido (sin Pedido/Sales Order/Requisición/cliente)", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it("rechaza sin business_unit_id/supplier_id/direct_purchase_reason/currency", () => {
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, business_unit_id: undefined }).success).toBe(false);
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, supplier_id: undefined }).success).toBe(false);
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, direct_purchase_reason: undefined }).success).toBe(false);
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, currency: undefined }).success).toBe(false);
  });

  it("rechaza un direct_purchase_reason fuera del enum de 6 valores", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, direct_purchase_reason: "otro" });
    expect(result.success).toBe(false);
  });

  it("rechaza sin al menos una partida", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, items: [] });
    expect(result.success).toBe(false);
  });

  it("cada línea exige catalog_product_id O description — rechaza si ninguno está presente", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse({
      ...basePayload,
      items: [{ quantity_ordered: 1, unit_price: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("una línea con solo catalog_product_id (sin description) es válida", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse({
      ...basePayload,
      items: [{ catalog_product_id: "33333333-3333-3333-3333-333333333333", quantity_ordered: 1, unit_price: 100 }],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza cantidad <= 0 o precio unitario negativo", () => {
    expect(
      directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, items: [{ description: "X", quantity_ordered: 0, unit_price: 10 }] }).success
    ).toBe(false);
    expect(
      directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, items: [{ description: "X", quantity_ordered: 1, unit_price: -1 }] }).success
    ).toBe(false);
  });

  it("tax_percent es opcional y por default es 0", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]?.tax_percent).toBe(0);
    }
  });

  it("rechaza tax_percent fuera de 0-100", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse({
      ...basePayload,
      items: [{ description: "X", quantity_ordered: 1, unit_price: 10, tax_percent: 101 }],
    });
    expect(result.success).toBe(false);
  });

  it("destination_warehouse_id y document_language son opcionales", () => {
    const result = directPurchaseOrderPayloadSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it("document_language, cuando se envía, solo acepta es/en", () => {
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, document_language: "fr" }).success).toBe(false);
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, document_language: "en" }).success).toBe(true);
  });

  it("currency solo acepta MXN/USD", () => {
    expect(directPurchaseOrderPayloadSchema.safeParse({ ...basePayload, currency: "EUR" }).success).toBe(false);
  });
});
