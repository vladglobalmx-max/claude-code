import { describe, expect, it } from "vitest";
import { getMissingRequiredCustomFields, getMissingRequiredCustomFieldsFromPayload } from "./completeness";
import { emptyProductItem } from "@/components/orders/types";
import type { ProductItemDraft } from "@/components/orders/types";
import type { OrderItemPayload } from "@/lib/validations/order";
import type { CustomFieldDefinition } from "./types";

/**
 * THÖREN 8D — reemplaza a validations/order.test.ts (getMissingProjectorFields,
 * eliminada). Mismos casos A-D que antes, pero ahora expresados vía
 * definitions con requiredBeforeOrder=true — igual que Thunder LED tras la
 * migración 0061 (proyección/instalación), nunca vía `product_type`.
 */
const BU_THUNDER = "bu-thunder-led";

function makeDef(overrides: Partial<CustomFieldDefinition>): CustomFieldDefinition {
  return {
    id: `def-${overrides.key}`,
    organizationId: "org-1",
    businessUnitId: BU_THUNDER,
    entityType: "order_item",
    key: "campo",
    label: "Campo",
    fieldType: "text",
    required: false,
    active: true,
    sortOrder: 0,
    placeholder: null,
    helpText: null,
    options: null,
    requiredBeforeOrder: true,
    requiredBeforeFulfillment: false,
    ...overrides,
  };
}

const THUNDER_DEFINITIONS: CustomFieldDefinition[] = [
  makeDef({ key: "projection_description", label: "Descripción de qué se proyectará", fieldType: "textarea" }),
  makeDef({ key: "projection_images", label: "Imagen o archivo a proyectar", fieldType: "file" }),
  makeDef({ key: "projection_width", label: "Ancho de proyección", fieldType: "number" }),
  makeDef({ key: "projection_height", label: "Alto de proyección", fieldType: "number" }),
  makeDef({ key: "installation_height", label: "Altura de instalación", fieldType: "number" }),
];

function completeDraftItem(overrides: Partial<ProductItemDraft> = {}): ProductItemDraft {
  return {
    ...emptyProductItem(),
    model: "TLL200",
    projectionDescription: "STOP",
    projectionImages: [{ key: "f1", path: "orders/1/proyeccion/stop.png", name: "stop.png", type: "image/png", size: 1, previewUrl: null }],
    projectionWidth: "4",
    projectionHeight: "4",
    installationHeight: "11.5",
    ...overrides,
  };
}

describe("getMissingRequiredCustomFields (draft, THÖREN 8D)", () => {
  it("no exige nada si ninguna definición scoped a esta BU es requiredBeforeOrder", () => {
    const defs = THUNDER_DEFINITIONS.map((d) => ({ ...d, businessUnitId: "otra-bu" }));
    expect(getMissingRequiredCustomFields(defs, BU_THUNDER, [completeDraftItem()])).toEqual([]);
  });

  it("CASO A: un producto completo no exige nada", () => {
    expect(getMissingRequiredCustomFields(THUNDER_DEFINITIONS, BU_THUNDER, [completeDraftItem()])).toEqual([]);
  });

  it("CASO B: 2 productos, cada uno completo con su propia instalación, no exige nada", () => {
    const items = [
      completeDraftItem({ model: "TLL200", installationHeight: "3" }),
      completeDraftItem({ model: "TLL300", installationHeight: "5" }),
    ];
    expect(getMissingRequiredCustomFields(THUNDER_DEFINITIONS, BU_THUNDER, items)).toEqual([]);
  });

  it("CASO D: un producto incompleto reporta cada campo faltante, el completo no aparece", () => {
    const items = [
      completeDraftItem({ model: "TLL200" }),
      completeDraftItem({
        model: "TLL300",
        projectionDescription: "",
        projectionImages: [],
        projectionWidth: "",
        projectionHeight: "",
        installationHeight: "",
      }),
    ];
    const missing = getMissingRequiredCustomFields(THUNDER_DEFINITIONS, BU_THUNDER, items);

    expect(missing).toContain("Producto 2 (TLL300): Descripción de qué se proyectará");
    expect(missing).toContain("Producto 2 (TLL300): Imagen o archivo a proyectar");
    expect(missing).toContain("Producto 2 (TLL300): Ancho de proyección");
    expect(missing).toContain("Producto 2 (TLL300): Alto de proyección");
    expect(missing).toContain("Producto 2 (TLL300): Altura de instalación");
    expect(missing.some((m) => m.startsWith("Producto 1"))).toBe(false);
  });

  it("un archivo elegido pero no subido (transitorio) no cuenta como completo", () => {
    const items = [completeDraftItem({ projectionImages: [] })];
    expect(getMissingRequiredCustomFields(THUNDER_DEFINITIONS, BU_THUNDER, items)).toContain(
      "Producto 1 (TLL200): Imagen o archivo a proyectar"
    );
  });
});

function completePayloadItem(overrides: Partial<OrderItemPayload> = {}): OrderItemPayload {
  return {
    model: "TLL200",
    quantity: 2,
    reference_images: [],
    projection_images: [{ path: "orders/1/proyeccion/stop.png" }],
    projection_description: "STOP",
    projection_width: 4,
    projection_height: 4,
    installation_height: 11.5,
    ...overrides,
  };
}

describe("getMissingRequiredCustomFieldsFromPayload (server pre-flight, THÖREN 8D)", () => {
  it("CASO A: un payload completo no exige nada", () => {
    expect(getMissingRequiredCustomFieldsFromPayload(THUNDER_DEFINITIONS, BU_THUNDER, [completePayloadItem()])).toEqual([]);
  });

  it("un payload manipulado con campos vacíos/ausentes sigue siendo detectado", () => {
    const items = [
      completePayloadItem({
        model: "TLL300",
        projection_description: undefined,
        projection_images: [],
        projection_width: undefined,
        projection_height: undefined,
        installation_height: undefined,
      }),
    ];
    const missing = getMissingRequiredCustomFieldsFromPayload(THUNDER_DEFINITIONS, BU_THUNDER, items);
    expect(missing).toContain("Producto 1 (TLL300): Descripción de qué se proyectará");
    expect(missing).toContain("Producto 1 (TLL300): Imagen o archivo a proyectar");
    expect(missing).toContain("Producto 1 (TLL300): Ancho de proyección");
    expect(missing).toContain("Producto 1 (TLL300): Alto de proyección");
    expect(missing).toContain("Producto 1 (TLL300): Altura de instalación");
  });

  it("Juno/GFB (business_unit_id distinto) no heredan las definiciones de Thunder", () => {
    const items = [completePayloadItem({ projection_description: undefined, projection_images: [] })];
    expect(getMissingRequiredCustomFieldsFromPayload(THUNDER_DEFINITIONS, "bu-juno", items)).toEqual([]);
  });

  it("un pedido sin Business Unit (null) solo respeta definiciones org-wide, ninguna de Thunder", () => {
    const items = [completePayloadItem({ projection_description: undefined, projection_images: [] })];
    expect(getMissingRequiredCustomFieldsFromPayload(THUNDER_DEFINITIONS, null, items)).toEqual([]);
  });

  it("un campo genuinamente nuevo (no legacy) requiredBeforeOrder se lee de custom_field_values", () => {
    const prioridad = makeDef({
      key: "prioridad",
      label: "Prioridad",
      fieldType: "text",
      businessUnitId: "bu-tenant-b",
    });
    const items: OrderItemPayload[] = [
      { ...completePayloadItem(), custom_field_values: {} },
    ];
    expect(getMissingRequiredCustomFieldsFromPayload([prioridad], "bu-tenant-b", items)).toEqual([
      "Producto 1 (TLL200): Prioridad",
    ]);
    const withValue: OrderItemPayload[] = [
      { ...completePayloadItem(), custom_field_values: { prioridad: "Alta" } },
    ];
    expect(getMissingRequiredCustomFieldsFromPayload([prioridad], "bu-tenant-b", withValue)).toEqual([]);
  });
});
