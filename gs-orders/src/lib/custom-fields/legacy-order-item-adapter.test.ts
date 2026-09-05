import { describe, expect, it } from "vitest";
import {
  LEGACY_ORDER_ITEM_FIELD_KEYS,
  applyLegacyOrderItemFieldValue,
  getLegacyOrderItemFieldRawValue,
  isLegacyOrderItemFieldKey,
} from "./legacy-order-item-adapter";
import { emptyProductItem } from "@/components/orders/types";

describe("legacy-order-item-adapter (THÖREN 8B Gap 1)", () => {
  it("isLegacyOrderItemFieldKey reconoce exactamente las 8 claves de Thunder, ninguna otra", () => {
    for (const key of LEGACY_ORDER_ITEM_FIELD_KEYS) {
      expect(isLegacyOrderItemFieldKey(key)).toBe(true);
    }
    expect(isLegacyOrderItemFieldKey("prioridad")).toBe(false);
    expect(isLegacyOrderItemFieldKey("color_favorito")).toBe(false);
  });

  it("un valor histórico ya guardado en la columna nativa sigue leyéndose vía el adapter (TEST 6)", () => {
    const item = { ...emptyProductItem(), power: "120W", color: "Rojo", lensPendingFactory: true };
    expect(getLegacyOrderItemFieldRawValue(item, "power")).toBe("120W");
    expect(getLegacyOrderItemFieldRawValue(item, "color")).toBe("Rojo");
    expect(getLegacyOrderItemFieldRawValue(item, "lens_pending_factory")).toBe("on");
    expect(getLegacyOrderItemFieldRawValue(item, "lens_type")).toBe("");
  });

  it("editar un valor legacy vía el adapter produce el patch correcto sobre la columna nativa, nunca sobre customFieldValues (TEST 7)", () => {
    expect(applyLegacyOrderItemFieldValue("power", "220W")).toEqual({ power: "220W" });
    expect(applyLegacyOrderItemFieldValue("lens_pending_factory", "on")).toEqual({ lensPendingFactory: true });
    expect(applyLegacyOrderItemFieldValue("lens_pending_factory", "")).toEqual({ lensPendingFactory: false });
    expect(applyLegacyOrderItemFieldValue("surface_notes_en", "Concrete floor")).toEqual({
      surfaceNotesEn: "Concrete floor",
    });
  });
});
