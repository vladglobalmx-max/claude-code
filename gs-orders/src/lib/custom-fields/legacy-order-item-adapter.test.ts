import { describe, expect, it } from "vitest";
import {
  LEGACY_ORDER_ITEM_FIELD_KEYS,
  LEGACY_ORDER_ITEM_FILE_FIELD_KEYS,
  applyLegacyOrderItemFieldValue,
  applyLegacyOrderItemFileValue,
  getLegacyOrderItemFieldRawValue,
  getLegacyOrderItemFileValue,
  isLegacyOrderItemFieldKey,
  isLegacyOrderItemFileFieldKey,
} from "./legacy-order-item-adapter";
import { emptyProductItem } from "@/components/orders/types";

describe("legacy-order-item-adapter (THÖREN 8B/8C)", () => {
  it("isLegacyOrderItemFieldKey reconoce exactamente las 18 claves de texto de Thunder (8B + los 10 residuales de 8C), ninguna otra", () => {
    for (const key of LEGACY_ORDER_ITEM_FIELD_KEYS) {
      expect(isLegacyOrderItemFieldKey(key)).toBe(true);
    }
    expect(LEGACY_ORDER_ITEM_FIELD_KEYS).toHaveLength(18);
    expect(isLegacyOrderItemFieldKey("prioridad")).toBe(false);
    expect(isLegacyOrderItemFieldKey("color_favorito")).toBe(false);
  });

  it("un valor histórico ya guardado en la columna nativa sigue leyéndose vía el adapter (TEST 6 de 8B)", () => {
    const item = { ...emptyProductItem(), power: "120W", color: "Rojo", lensPendingFactory: true };
    expect(getLegacyOrderItemFieldRawValue(item, "power")).toBe("120W");
    expect(getLegacyOrderItemFieldRawValue(item, "color")).toBe("Rojo");
    expect(getLegacyOrderItemFieldRawValue(item, "lens_pending_factory")).toBe("on");
    expect(getLegacyOrderItemFieldRawValue(item, "lens_type")).toBe("");
  });

  it("editar un valor legacy vía el adapter produce el patch correcto sobre la columna nativa, nunca sobre customFieldValues (TEST 7 de 8B)", () => {
    expect(applyLegacyOrderItemFieldValue("power", "220W")).toEqual({ power: "220W" });
    expect(applyLegacyOrderItemFieldValue("lens_pending_factory", "on")).toEqual({ lensPendingFactory: true });
    expect(applyLegacyOrderItemFieldValue("lens_pending_factory", "")).toEqual({ lensPendingFactory: false });
    expect(applyLegacyOrderItemFieldValue("surface_notes_en", "Concrete floor")).toEqual({
      surfaceNotesEn: "Concrete floor",
    });
  });

  it("THÖREN 8C — un valor histórico de un campo residual (surface_type/installation_height) sigue leyéndose vía el adapter (TEST 8)", () => {
    const item = {
      ...emptyProductItem(),
      surfaceType: "piso" as const,
      surfaceMaterial: "concreto" as const,
      installationHeight: "2.5",
      installationHeightUnit: "m" as const,
      orientation: "pared" as const,
      use: "interior" as const,
      projectionWidth: "1.2",
      projectionHeight: "0.8",
      projectionSizeUnit: "m" as const,
      installationDistance: "3",
    };
    expect(getLegacyOrderItemFieldRawValue(item, "surface_type")).toBe("piso");
    expect(getLegacyOrderItemFieldRawValue(item, "surface_material")).toBe("concreto");
    expect(getLegacyOrderItemFieldRawValue(item, "installation_height")).toBe("2.5");
    expect(getLegacyOrderItemFieldRawValue(item, "installation_height_unit")).toBe("m");
    expect(getLegacyOrderItemFieldRawValue(item, "installation_orientation")).toBe("pared");
    expect(getLegacyOrderItemFieldRawValue(item, "installation_use")).toBe("interior");
    expect(getLegacyOrderItemFieldRawValue(item, "projection_width")).toBe("1.2");
    expect(getLegacyOrderItemFieldRawValue(item, "projection_height")).toBe("0.8");
    expect(getLegacyOrderItemFieldRawValue(item, "projection_size_unit")).toBe("m");
    expect(getLegacyOrderItemFieldRawValue(item, "installation_distance")).toBe("3");
  });

  it("THÖREN 8C — editar un campo residual vía el adapter produce el patch correcto sobre la columna nativa", () => {
    expect(applyLegacyOrderItemFieldValue("surface_type", "pared")).toEqual({ surfaceType: "pared" });
    expect(applyLegacyOrderItemFieldValue("installation_use", "exterior")).toEqual({ use: "exterior" });
    expect(applyLegacyOrderItemFieldValue("projection_size_unit", "cm")).toEqual({ projectionSizeUnit: "cm" });
  });

  it("THÖREN 8C — projection_images es la única clave legacy respaldada por archivos, no por texto", () => {
    expect(LEGACY_ORDER_ITEM_FILE_FIELD_KEYS).toEqual(["projection_images"]);
    expect(isLegacyOrderItemFileFieldKey("projection_images")).toBe(true);
    expect(isLegacyOrderItemFileFieldKey("power")).toBe(false);

    const media = [{ key: "f1", path: "orders/1/proyeccion/a.png", name: "a.png", type: "image/png", size: 10, previewUrl: null }];
    const item = { ...emptyProductItem(), projectionImages: media };
    expect(getLegacyOrderItemFileValue(item, "projection_images")).toBe(media);
    expect(applyLegacyOrderItemFileValue("projection_images", media)).toEqual({ projectionImages: media });
  });
});
