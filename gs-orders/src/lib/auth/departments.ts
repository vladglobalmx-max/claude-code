/**
 * THÖREN | CONTROL DE ACCESO POR DEPARTAMENTOS — módulo compartido,
 * framework-agnóstico (sin React/server-only/supabase-js), mismo criterio
 * de diseño que organization-modules.ts: lo importan TANTO middleware.ts
 * (Edge, raíz del proyecto) COMO sidebar.tsx (cliente) y el layout del
 * servidor — una única función de autorización (`isModuleAllowedForDepartments`)
 * para que nunca pueda haber un desacuerdo entre "lo que el sidebar
 * muestra" y "lo que el servidor permite".
 *
 * ALCANCE — esta capa es ADITIVA y nunca sustituye nada existente:
 *   - Nunca se conecta a ítems SIN `moduleKey` (Inicio/Configuración/
 *     Unidades de Negocio/Personas/Vendedores) — siguen exactamente igual
 *     que hoy, infraestructura administrativa siempre disponible.
 *   - Nunca se conecta a Comisiones (`comisiones` module_key) — su propio
 *     gate (`commissionsOnly`: can_manage_commissions O
 *     can_view_own_commissions) es independiente y no se toca.
 *   - admin siempre pasa (bypass total, ver `isModuleAllowedForDepartments`)
 *     — Dirección General conserva acceso completo, requisito explícito.
 *   - "Transición segura": un usuario SIN ninguna capability de
 *     departamento otorgada (`assignedDepartments` vacío) también pasa
 *     siempre — el filtro solo se activa para un usuario una vez que
 *     Dirección le asignó al menos un departamento. Esto es intencional,
 *     no un bug: ver DECISIÓN en rpc_set_user_departments (0093) y el
 *     requisito "TRANSICIÓN SEGURA" del ticket.
 *   - Esta capa es de VISIBILIDAD DE RUTA/MENÚ únicamente — nunca
 *     sustituye RLS/policies de datos. Ocultar `/compras` aquí no protege
 *     por sí solo los endpoints o filas de `purchase_orders`; esa
 *     protección real sigue siendo RLS, sin cambios.
 */
import type { ToggleableModuleKey } from "@/lib/organization-modules";
import type { UserRole } from "@/types/domain";

export const DEPARTMENT_KEYS = ["ventas", "administracion", "compras", "almacen", "logistica"] as const;

export type DepartmentKey = (typeof DEPARTMENT_KEYS)[number];

/** DepartmentKey -> capability key en `user_capabilities` (ver 0093). */
export const DEPARTMENT_CAPABILITY: Record<DepartmentKey, string> = {
  ventas: "can_access_ventas",
  administracion: "can_access_administracion",
  compras: "can_access_compras",
  almacen: "can_access_almacen",
  logistica: "can_access_logistica",
};

export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  ventas: "Ventas",
  administracion: "Administración",
  compras: "Compras",
  almacen: "Almacén",
  logistica: "Logística",
};

/**
 * module_key -> departamento, exactamente el mismo agrupamiento visual de
 * NAV_GROUPS (nav-config.ts) — ver comentario de cabecera de ese archivo
 * para el mapeo grupo->módulo histórico. `comisiones` se omite a propósito
 * (ver ALCANCE arriba): un module_key ausente de este mapa nunca se
 * restringe por departamento, solo por su gate existente.
 */
export const DEPARTMENT_BY_MODULE_KEY: Partial<Record<ToggleableModuleKey, DepartmentKey>> = {
  clientes: "ventas",
  cotizaciones: "ventas",
  ordenes_venta: "ventas",
  entregas: "logistica",
  ordenes_trabajo: "logistica",
  requisiciones: "compras",
  compras: "compras",
  proveedores: "compras",
  recepciones: "almacen",
  inventario: "almacen",
  surtidos: "almacen",
  almacenes: "almacen",
  facturas: "administracion",
};

function isDepartmentKey(value: string): value is DepartmentKey {
  return (DEPARTMENT_KEYS as readonly string[]).includes(value);
}

/**
 * Resuelve los departamentos asignados a partir de un Set/array de
 * capability keys ya activas del usuario (mismo insumo que
 * getCurrentCapabilities() en capabilities.ts) — puramente de datos, sin
 * I/O: el caller (middleware.ts o el layout del servidor) resuelve las
 * capabilities activas con su propio mecanismo ya existente.
 */
export function resolveAssignedDepartments(capabilities: Iterable<string>): DepartmentKey[] {
  const capabilitySet = capabilities instanceof Set ? capabilities : new Set(capabilities);
  return DEPARTMENT_KEYS.filter((department) => capabilitySet.has(DEPARTMENT_CAPABILITY[department]));
}

/**
 * Única función de autorización compartida sidebar+servidor. `moduleKey`
 * es null/undefined para cualquier ítem sin module_key (Inicio/
 * Configuración/Personas/Vendedores/Unidades de Negocio) o para Comisiones
 * (gate independiente, ver DEPARTMENT_BY_MODULE_KEY) — en ambos casos
 * siempre permitido por esta capa, su propio gate existente decide.
 */
export function isModuleAllowedForDepartments(
  moduleKey: ToggleableModuleKey | null | undefined,
  role: UserRole,
  assignedDepartments: readonly DepartmentKey[]
): boolean {
  if (role === "admin") return true;
  if (!moduleKey) return true;

  const department = DEPARTMENT_BY_MODULE_KEY[moduleKey];
  if (!department) return true;

  // Transición segura: sin ninguna asignación todavía, el filtro no se
  // activa para este usuario — conserva su acceso actual sin cambios.
  if (assignedDepartments.length === 0) return true;

  return assignedDepartments.includes(department);
}

export function isValidDepartmentKey(value: string): value is DepartmentKey {
  return isDepartmentKey(value);
}
