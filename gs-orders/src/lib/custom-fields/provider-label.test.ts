import { describe, expect, it } from "vitest";
import { getProviderFieldLabel } from "./provider-label";
import type { CustomFieldDefinition } from "./types";

function makeDef(overrides: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    id: "def-1",
    organizationId: "org-1",
    businessUnitId: null,
    entityType: "order_item",
    key: "color",
    label: "Color",
    fieldType: "text",
    required: false,
    active: true,
    sortOrder: 0,
    placeholder: null,
    helpText: null,
    options: null,
    requiredBeforeOrder: false,
    requiredBeforeFulfillment: false,
    supplierLabel: null,
    productTypeId: null,
    ...overrides,
  };
}

describe("getProviderFieldLabel (THÖREN — Adenda PDF Pedido, idioma para Proveedor)", () => {
  it("en español siempre usa `label`, tenga o no supplierLabel configurado", () => {
    const def = makeDef({ label: "Técnica de impresión", supplierLabel: "Printing technique" });
    expect(getProviderFieldLabel(def, "es")).toBe("Técnica de impresión");
  });

  it("en inglés usa `supplierLabel` cuando está configurado", () => {
    const def = makeDef({ label: "Técnica de impresión", supplierLabel: "Printing technique" });
    expect(getProviderFieldLabel(def, "en")).toBe("Printing technique");
  });

  it("en inglés SIN supplierLabel configurado, cae a `label` — nunca inventa una traducción", () => {
    const def = makeDef({ label: "Técnica de impresión", supplierLabel: null });
    expect(getProviderFieldLabel(def, "en")).toBe("Técnica de impresión");
  });

  it("genérico: funciona para cualquier definición, no solo campos de Thunder", () => {
    const def = makeDef({ key: "prioridad", label: "Prioridad", supplierLabel: "Priority" });
    expect(getProviderFieldLabel(def, "en")).toBe("Priority");
    expect(getProviderFieldLabel(def, "es")).toBe("Prioridad");
  });
});
