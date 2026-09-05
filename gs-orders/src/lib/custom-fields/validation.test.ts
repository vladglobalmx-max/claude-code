import { describe, expect, it } from "vitest";
import { validateCustomFieldValue, validateCustomFields } from "./validation";
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
    ...overrides,
  };
}

describe("validateCustomFieldValue (THÖREN 8B)", () => {
  it("required bloquea vacío (TEST 9 del set de 26)", () => {
    const def = makeDef({ required: true });
    expect(validateCustomFieldValue(def, "")).toEqual({ ok: false, error: "Color es obligatorio." });
    expect(validateCustomFieldValue(def, undefined)).toEqual({ ok: false, error: "Color es obligatorio." });
  });

  it("required permite valor presente", () => {
    const def = makeDef({ required: true });
    const result = validateCustomFieldValue(def, "Rojo");
    expect(result.ok).toBe(true);
  });

  it("text guarda/lee (TEST 10)", () => {
    const def = makeDef({ fieldType: "text" });
    const result = validateCustomFieldValue(def, "  Azul  ");
    expect(result).toEqual({
      ok: true,
      value: {
        definitionId: "def-1",
        valueText: "Azul",
        valueNumber: null,
        valueBoolean: null,
        valueDate: null,
        valueJson: null,
      },
    });
  });

  it("number guarda/lee (TEST 11)", () => {
    const def = makeDef({ fieldType: "number", key: "employee_count", label: "Número de empleados" });
    const result = validateCustomFieldValue(def, "42");
    expect(result).toEqual({
      ok: true,
      value: {
        definitionId: "def-1",
        valueText: null,
        valueNumber: 42,
        valueBoolean: null,
        valueDate: null,
        valueJson: null,
      },
    });
  });

  it("number rechaza texto no numérico", () => {
    const def = makeDef({ fieldType: "number" });
    const result = validateCustomFieldValue(def, "abc");
    expect(result.ok).toBe(false);
  });

  it("select rechaza opción inválida (TEST 12)", () => {
    const def = makeDef({ fieldType: "select", options: ["Normal", "Urgente"] });
    const result = validateCustomFieldValue(def, "Crítico");
    expect(result).toEqual({ ok: false, error: "Color: opción no válida." });
  });

  it("select acepta opción válida", () => {
    const def = makeDef({ fieldType: "select", options: ["Normal", "Urgente"] });
    const result = validateCustomFieldValue(def, "Urgente");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.valueText).toBe("Urgente");
  });

  it("checkbox guarda/lee (TEST 13)", () => {
    const def = makeDef({ fieldType: "checkbox", key: "lens_pending_factory" });
    expect(validateCustomFieldValue(def, "on")).toEqual({
      ok: true,
      value: {
        definitionId: "def-1",
        valueText: null,
        valueNumber: null,
        valueBoolean: true,
        valueDate: null,
        valueJson: null,
      },
    });
    expect(validateCustomFieldValue(def, undefined)).toEqual({
      ok: true,
      value: {
        definitionId: "def-1",
        valueText: null,
        valueNumber: null,
        valueBoolean: false,
        valueDate: null,
        valueJson: null,
      },
    });
  });

  it("file/image guardan un arreglo de rutas de Storage (JSON) — required exige al menos un archivo", () => {
    const def = makeDef({ fieldType: "file", key: "projection_images", label: "Imagen(es) a proyectar", required: true });
    expect(validateCustomFieldValue(def, undefined)).toEqual({ error: "Imagen(es) a proyectar es obligatorio.", ok: false });
    expect(validateCustomFieldValue(def, "[]")).toEqual({ error: "Imagen(es) a proyectar es obligatorio.", ok: false });

    const withFiles = validateCustomFieldValue(def, JSON.stringify(["orders/1/proyeccion/a.png", "orders/1/proyeccion/b.pdf"]));
    expect(withFiles).toEqual({
      ok: true,
      value: {
        definitionId: "def-1",
        valueText: null,
        valueNumber: null,
        valueBoolean: null,
        valueDate: null,
        valueJson: ["orders/1/proyeccion/a.png", "orders/1/proyeccion/b.pdf"],
      },
    });
  });

  it("image no requerido permite vacío y JSON inválido se trata como sin archivos", () => {
    const def = makeDef({ fieldType: "image", key: "foto" });
    expect(validateCustomFieldValue(def, undefined).ok).toBe(true);
    expect(validateCustomFieldValue(def, "esto no es json").ok).toBe(true);
  });

  it("date valida formato YYYY-MM-DD", () => {
    const def = makeDef({ fieldType: "date" });
    expect(validateCustomFieldValue(def, "2026-01-15").ok).toBe(true);
    expect(validateCustomFieldValue(def, "15/01/2026").ok).toBe(false);
  });

  it("campo inactive no se valida ni renderiza (TEST 14) — validateCustomFields lo omite", () => {
    const active = makeDef({ id: "a", key: "a", active: true, required: true });
    const inactive = makeDef({ id: "b", key: "b", active: false, required: true });
    // El campo inactivo requerido NO debe bloquear aunque venga vacío.
    const result = validateCustomFields([active, inactive], { a: "valor" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values).toHaveLength(1);
  });

  it("sort_order respetado (TEST 15) — validateCustomFields preserva el orden recibido", () => {
    const first = makeDef({ id: "1", key: "k1", sortOrder: 10 });
    const second = makeDef({ id: "2", key: "k2", sortOrder: 20 });
    const result = validateCustomFields([first, second], { k1: "a", k2: "b" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.map((v) => v.definitionId)).toEqual(["1", "2"]);
  });
});
