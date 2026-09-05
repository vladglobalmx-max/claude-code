import { describe, expect, it } from "vitest";
import { scopeDefinitionsToBusinessUnit } from "./scope";
import { LEGACY_ORDER_ITEM_FIELD_KEYS } from "./legacy-order-item-adapter";
import type { CustomFieldDefinition } from "./types";

function makeDef(overrides: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    id: `def-${overrides.key ?? "x"}`,
    organizationId: "org-1",
    businessUnitId: null,
    entityType: "order_item",
    key: overrides.key ?? "campo",
    label: overrides.label ?? "Campo",
    fieldType: "text",
    required: false,
    active: true,
    sortOrder: 0,
    placeholder: null,
    helpText: null,
    options: null,
    ...overrides,
  };
}

const BU_THUNDER = "bu-thunder-led";
const BU_JUNO = "bu-juno";
const BU_GFB = "bu-gfb";

const thunderFields = LEGACY_ORDER_ITEM_FIELD_KEYS.map((key) => makeDef({ key, businessUnitId: BU_THUNDER }));
const junoFields = [
  makeDef({ key: "print_technique", label: "Técnica de impresión", businessUnitId: BU_JUNO }),
  makeDef({ key: "print_color", label: "Color", businessUnitId: BU_JUNO }),
];
const orgWideField = makeDef({ key: "referencia_interna", businessUnitId: null });
const allDefinitions = [...thunderFields, ...junoFields, orgWideField];

describe("scopeDefinitionsToBusinessUnit (THÖREN 8B Gap 1)", () => {
  it("TEST 1: Thunder LED con sus definitions activas ve los 8 campos legacy + el org-wide", () => {
    const visible = scopeDefinitionsToBusinessUnit(allDefinitions, BU_THUNDER);
    const keys = visible.map((d) => d.key);
    for (const legacyKey of LEGACY_ORDER_ITEM_FIELD_KEYS) {
      expect(keys).toContain(legacyKey);
    }
    expect(keys).toContain("referencia_interna");
    expect(visible).toHaveLength(LEGACY_ORDER_ITEM_FIELD_KEYS.length + 1);
  });

  it("TEST 2: Juno NO ve ningún campo legacy de Thunder", () => {
    const visible = scopeDefinitionsToBusinessUnit(allDefinitions, BU_JUNO);
    const keys = visible.map((d) => d.key);
    for (const legacyKey of LEGACY_ORDER_ITEM_FIELD_KEYS) {
      expect(keys).not.toContain(legacyKey);
    }
    expect(keys).toContain("print_technique");
  });

  it("TEST 3: GFB (sin definitions propias en este set) tampoco ve ningún campo legacy de Thunder — solo lo org-wide", () => {
    const visible = scopeDefinitionsToBusinessUnit(allDefinitions, BU_GFB);
    const keys = visible.map((d) => d.key);
    for (const legacyKey of LEGACY_ORDER_ITEM_FIELD_KEYS) {
      expect(keys).not.toContain(legacyKey);
    }
    expect(keys).toEqual(["referencia_interna"]);
  });

  it("TEST 4: Tenant B (organización distinta) — su propia lista de definitions ya viene sin nada de Thunder desde el servidor; scope() sobre esa lista sigue sin exponer legacy keys", () => {
    const tenantBOwnDefinitions = [makeDef({ key: "prioridad", businessUnitId: "bu-tenant-b" })];
    const visible = scopeDefinitionsToBusinessUnit(tenantBOwnDefinitions, "bu-tenant-b");
    expect(visible.map((d) => d.key)).toEqual(["prioridad"]);
  });
});
