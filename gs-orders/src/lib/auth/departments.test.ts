import { describe, expect, it } from "vitest";
import { TOGGLEABLE_MODULE_KEYS } from "@/lib/organization-modules";
import {
  DEPARTMENT_KEYS,
  DEPARTMENT_BY_MODULE_KEY,
  DEPARTMENT_CAPABILITY,
  DEPARTMENT_LABELS,
  resolveAssignedDepartments,
  isModuleAllowedForDepartments,
  isValidDepartmentKey,
} from "./departments";

describe("departments — catálogo", () => {
  it("cada departamento tiene capability y label", () => {
    for (const department of DEPARTMENT_KEYS) {
      expect(DEPARTMENT_CAPABILITY[department]).toBeTruthy();
      expect(DEPARTMENT_LABELS[department]).toBeTruthy();
    }
  });

  it("isValidDepartmentKey acepta los 5 departamentos reales y rechaza un valor arbitrario", () => {
    for (const department of DEPARTMENT_KEYS) {
      expect(isValidDepartmentKey(department)).toBe(true);
    }
    expect(isValidDepartmentKey("direccion_general")).toBe(false);
  });

  it("comisiones nunca tiene departamento asignado — su gate (commissionsOnly) es independiente", () => {
    expect(DEPARTMENT_BY_MODULE_KEY.comisiones).toBeUndefined();
  });

  it("todo module_key mapeado a un departamento es un module_key toggleable real", () => {
    for (const key of Object.keys(DEPARTMENT_BY_MODULE_KEY)) {
      expect(TOGGLEABLE_MODULE_KEYS as readonly string[]).toContain(key);
    }
  });
});

describe("resolveAssignedDepartments", () => {
  it("sin ninguna capability de departamento, devuelve vacío", () => {
    expect(resolveAssignedDepartments(new Set(["can_manage_users"]))).toEqual([]);
  });

  it("resuelve exactamente los departamentos cuya capability está presente", () => {
    const result = resolveAssignedDepartments(new Set(["can_access_ventas", "can_access_almacen", "can_manage_commissions"]));
    expect(result.sort()).toEqual(["almacen", "ventas"]);
  });

  it("acepta un array además de un Set", () => {
    expect(resolveAssignedDepartments(["can_access_compras"])).toEqual(["compras"]);
  });
});

describe("isModuleAllowedForDepartments", () => {
  it("admin siempre pasa, sin importar el departamento o la asignación", () => {
    expect(isModuleAllowedForDepartments("compras", "admin", [])).toBe(true);
    expect(isModuleAllowedForDepartments("compras", "admin", ["ventas"])).toBe(true);
  });

  it("un moduleKey ausente (null/undefined) — ítems sin module_key — siempre pasa para cualquier rol", () => {
    expect(isModuleAllowedForDepartments(null, "vendedor", ["ventas"])).toBe(true);
    expect(isModuleAllowedForDepartments(undefined, "vendedor", [])).toBe(true);
  });

  it("comisiones siempre pasa esta capa — su gate es independiente (commissionsOnly)", () => {
    expect(isModuleAllowedForDepartments("comisiones", "vendedor", ["ventas"])).toBe(true);
  });

  it("transición segura: sin ninguna asignación todavía, cualquier módulo pasa", () => {
    expect(isModuleAllowedForDepartments("compras", "vendedor", [])).toBe(true);
    expect(isModuleAllowedForDepartments("almacenes" as never, "vendedor", [])).toBe(true);
  });

  it("vendedor con Ventas asignado ve solo módulos de Ventas", () => {
    expect(isModuleAllowedForDepartments("clientes", "vendedor", ["ventas"])).toBe(true);
    expect(isModuleAllowedForDepartments("cotizaciones", "vendedor", ["ventas"])).toBe(true);
    expect(isModuleAllowedForDepartments("ordenes_venta", "vendedor", ["ventas"])).toBe(true);
    expect(isModuleAllowedForDepartments("compras", "vendedor", ["ventas"])).toBe(false);
    expect(isModuleAllowedForDepartments("inventario", "vendedor", ["ventas"])).toBe(false);
  });

  it("vendedor con Compras+Almacén asignados ve ambos, nada más", () => {
    const assigned = ["compras", "almacen"] as const;
    expect(isModuleAllowedForDepartments("proveedores", "vendedor", assigned)).toBe(true);
    expect(isModuleAllowedForDepartments("inventario", "vendedor", assigned)).toBe(true);
    expect(isModuleAllowedForDepartments("recepciones", "vendedor", assigned)).toBe(true);
    expect(isModuleAllowedForDepartments("clientes", "vendedor", assigned)).toBe(false);
    expect(isModuleAllowedForDepartments("facturas", "vendedor", assigned)).toBe(false);
  });

  it("Logística y Administración se resuelven correctamente", () => {
    expect(isModuleAllowedForDepartments("entregas", "vendedor", ["logistica"])).toBe(true);
    expect(isModuleAllowedForDepartments("ordenes_trabajo", "vendedor", ["logistica"])).toBe(true);
    expect(isModuleAllowedForDepartments("facturas", "vendedor", ["administracion"])).toBe(true);
    expect(isModuleAllowedForDepartments("entregas", "vendedor", ["administracion"])).toBe(false);
  });
});
