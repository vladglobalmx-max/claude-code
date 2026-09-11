import { describe, expect, it } from "vitest";
import { scopeDefinitionsToBusinessUnit, scopeDefinitionsToItem } from "./scope";
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
    requiredBeforeOrder: false,
    requiredBeforeFulfillment: false,
    supplierLabel: null,
    productTypeId: null,
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

/**
 * THÖREN — Bug real: custom fields aplicados al Tipo de Producto
 * incorrecto (0065). Mismo caso real reportado: Thunder LED, producto
 * TLLTPB140R (Tipo de Producto "Luces Grúa Viajera") no debe ver ni ser
 * bloqueado por los campos de proyección, que son exclusivos de
 * "Proyector / GOBO" — ambos Tipos de Producto dentro de la MISMA
 * Business Unit (Thunder LED).
 */
describe("scopeDefinitionsToItem (THÖREN — bug real product_type_id, 0065)", () => {
  const PT_PROYECTOR = "pt-proyector-gobo";
  const PT_LUZ_GRUA = "pt-luz-grua-viajera";

  const buWideField = makeDef({ key: "referencia_interna", businessUnitId: BU_THUNDER, productTypeId: null });
  const proyectorField = makeDef({
    key: "projection_description",
    businessUnitId: BU_THUNDER,
    productTypeId: PT_PROYECTOR,
    requiredBeforeOrder: true,
  });
  const luzGruaField = makeDef({ key: "luz_grua_solo", businessUnitId: BU_THUNDER, productTypeId: PT_LUZ_GRUA });
  const defs = [buWideField, proyectorField, luzGruaField];

  it("TEST 1: un item Proyector / GOBO ve su propio campo y el BU-wide, nunca el de Luz Grua", () => {
    const visible = scopeDefinitionsToItem(defs, BU_THUNDER, PT_PROYECTOR);
    const keys = visible.map((d) => d.key);
    expect(keys).toContain("projection_description");
    expect(keys).toContain("referencia_interna");
    expect(keys).not.toContain("luz_grua_solo");
  });

  it("TEST 2: un item Luces Grua Viajera (caso real TLLTPB140R) NUNCA ve los campos de proyeccion, aunque sean requiredBeforeOrder", () => {
    const visible = scopeDefinitionsToItem(defs, BU_THUNDER, PT_LUZ_GRUA);
    const keys = visible.map((d) => d.key);
    expect(keys).not.toContain("projection_description");
    expect(keys).toContain("luz_grua_solo");
    expect(keys).toContain("referencia_interna");
  });

  it("TEST 3: un item sin Tipo de Producto resoluble (catalogProductId null o producto sin tipo) solo ve lo org/BU-wide", () => {
    const visible = scopeDefinitionsToItem(defs, BU_THUNDER, null);
    expect(visible.map((d) => d.key)).toEqual(["referencia_interna"]);
  });

  it("TEST 4: una definition BU-wide (product_type_id NULL) aparece para CUALQUIER Tipo de Producto de esa BU", () => {
    expect(scopeDefinitionsToItem(defs, BU_THUNDER, PT_PROYECTOR).map((d) => d.key)).toContain("referencia_interna");
    expect(scopeDefinitionsToItem(defs, BU_THUNDER, PT_LUZ_GRUA).map((d) => d.key)).toContain("referencia_interna");
    expect(scopeDefinitionsToItem(defs, BU_THUNDER, "otro-tipo-cualquiera").map((d) => d.key)).toContain(
      "referencia_interna"
    );
  });

  it("TEST 5: BU-scope sigue aplicando primero — otra BU nunca ve un campo de Thunder aunque el product_type_id coincida por casualidad", () => {
    const visible = scopeDefinitionsToItem(defs, "otra-bu", PT_PROYECTOR);
    expect(visible).toEqual([]);
  });
});
