import { describe, expect, it } from "vitest";
import {
  TOGGLEABLE_MODULE_KEYS,
  MODULE_KEY_LABELS,
  MODULE_KEY_BY_PATH_PREFIX,
  isToggleableModuleKey,
} from "./organization-modules";

describe("organization-modules (THÖREN 0084)", () => {
  it("cada module_key toggleable tiene un label", () => {
    for (const key of TOGGLEABLE_MODULE_KEYS) {
      expect(MODULE_KEY_LABELS[key]).toBeTruthy();
    }
  });

  it("MODULE_KEY_BY_PATH_PREFIX cubre exactamente los 14 module_key toggleables, sin duplicados", () => {
    const keysInMap = MODULE_KEY_BY_PATH_PREFIX.map(([, key]) => key);
    expect(new Set(keysInMap).size).toBe(keysInMap.length);
    expect([...keysInMap].sort()).toEqual([...TOGGLEABLE_MODULE_KEYS].sort());
  });

  it("los módulos siempre-disponibles NUNCA aparecen como toggleables", () => {
    const alwaysOn = ["inicio", "configuracion", "unidades_negocio", "personas", "vendedores"];
    for (const key of alwaysOn) {
      expect(isToggleableModuleKey(key)).toBe(false);
    }
  });

  it("isToggleableModuleKey acepta los 14 module_key reales", () => {
    for (const key of TOGGLEABLE_MODULE_KEYS) {
      expect(isToggleableModuleKey(key)).toBe(true);
    }
  });

  it("isToggleableModuleKey rechaza un valor arbitrario", () => {
    expect(isToggleableModuleKey("no_existe")).toBe(false);
  });
});
