/**
 * THÖREN 0084 — Multiempresa real: módulos habilitados por organización.
 * Única fuente de verdad de la lista de `module_key` toggleables — el
 * mismo array que el CHECK de `organization_modules` (0084_organization_
 * modules.sql) y que valida `rpc_set_organization_module()` en DB. Se
 * mantiene sincronizada A MANO (Postgres no puede importar TS ni viceversa)
 * — si se agrega/quita un módulo toggleable, hay que tocar AMBOS lados.
 *
 * inicio/configuracion/unidades_negocio/personas/vendedores son
 * infraestructura administrativa SIEMPRE disponible — nunca aparecen aquí,
 * nunca tienen fila en `organization_modules` (el CHECK de la tabla y la
 * validación de la RPC lo impiden en DB; este archivo nunca los ofrece
 * como opción en la UI, defensa adicional en la capa de aplicación).
 *
 * Sin dependencias de React/lucide-react a propósito: este módulo lo
 * importa `middleware.ts` (raíz del proyecto, fuera de `src/app`) además
 * de la UI — mantenerlo puramente de datos evita arrastrar un bundle de
 * íconos al runtime de middleware.
 */
export const TOGGLEABLE_MODULE_KEYS = [
  "clientes",
  "cotizaciones",
  "ordenes_venta",
  "ordenes_trabajo",
  "entregas",
  "requisiciones",
  "compras",
  "recepciones",
  "proveedores",
  "inventario",
  "almacenes",
  "surtidos",
  "facturas",
  "comisiones",
] as const;

export type ToggleableModuleKey = (typeof TOGGLEABLE_MODULE_KEYS)[number];

export const MODULE_KEY_LABELS: Record<ToggleableModuleKey, string> = {
  clientes: "Clientes",
  cotizaciones: "Cotizaciones",
  ordenes_venta: "Órdenes de Venta",
  ordenes_trabajo: "Órdenes de Trabajo",
  entregas: "Entregas",
  requisiciones: "Requisiciones de Compra",
  compras: "Compras",
  recepciones: "Recepciones de Mercancía",
  proveedores: "Proveedores",
  inventario: "Inventario",
  almacenes: "Almacenes",
  surtidos: "Surtidos",
  facturas: "Facturas",
  comisiones: "Comisiones",
};

export function isToggleableModuleKey(value: string): value is ToggleableModuleKey {
  return (TOGGLEABLE_MODULE_KEYS as readonly string[]).includes(value);
}

/**
 * Prefijo de ruta -> module_key, para el guard de middleware.ts. Orden sin
 * importancia (los prefijos no se solapan entre sí — cada módulo vive en
 * su propia carpeta de nivel superior). No incluye inicio/configuracion/
 * unidades-negocio/personas/vendedores — esos jamás se bloquean.
 */
export const MODULE_KEY_BY_PATH_PREFIX: ReadonlyArray<readonly [string, ToggleableModuleKey]> = [
  ["/clientes", "clientes"],
  ["/cotizaciones", "cotizaciones"],
  ["/ordenes-venta", "ordenes_venta"],
  ["/pedidos", "ordenes_trabajo"],
  ["/entregas", "entregas"],
  ["/requisiciones", "requisiciones"],
  ["/compras", "compras"],
  ["/recepciones", "recepciones"],
  ["/proveedores", "proveedores"],
  ["/inventario", "inventario"],
  ["/almacenes", "almacenes"],
  ["/surtidos", "surtidos"],
  ["/facturas", "facturas"],
  ["/comisiones", "comisiones"],
];
