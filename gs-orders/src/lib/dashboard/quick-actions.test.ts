import { describe, expect, it } from "vitest";
import { buildQuickActions, MAX_QUICK_ACTIONS } from "./quick-actions";

const NONE = new Set<string>();

function ids(actions: ReturnType<typeof buildQuickActions>): string[] {
  return actions.map((a) => a.id);
}

describe("buildQuickActions — THÖREN 6R.1C", () => {
  it("[1] admin obtiene las acciones ejecutivas fijas (Compras/Inventario/Configuración)", () => {
    const actions = buildQuickActions("admin", NONE);
    expect(ids(actions)).toEqual(["compras", "inventario", "configuracion"]);
  });

  it("[2] vendedor normal (sin capability) obtiene sus acciones comerciales propias", () => {
    const actions = buildQuickActions("vendedor", NONE);
    expect(ids(actions)).toEqual(["nueva-cotizacion", "mis-pedidos", "clientes"]);
  });

  it("[3] can_view_all_sales obtiene acciones comerciales globales (Pedidos + Cotizaciones)", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_view_all_sales"]));
    expect(ids(actions)).toContain("pedidos-globales");
    expect(ids(actions)).toContain("cotizaciones-globales");
    // "Mis pedidos" queda deduplicado contra "Pedidos" (misma familia /pedidos).
    expect(ids(actions)).not.toContain("mis-pedidos");
  });

  it("[4] can_prepare_purchase_orders obtiene la acción de preparar Purchase Orders", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_prepare_purchase_orders"]));
    expect(ids(actions)).toContain("preparar-oc");
  });

  it("[5] can_receive_inventory obtiene la acción de recepciones pendientes", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_receive_inventory"]));
    expect(ids(actions)).toContain("recepciones");
  });

  it("[6] can_manage_deliveries obtiene la acción de entregas", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_manage_deliveries"]));
    expect(ids(actions)).toContain("entregas");
  });

  it("[7] can_manage_users obtiene la acción de Usuarios y accesos", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_manage_users"]));
    expect(ids(actions)).toContain("usuarios");
  });

  it("[8] combinación Rodolfo (deliveries+receive+prepare) no excede el máximo y prioriza Entregas > Recepciones > Preparar OC", () => {
    const caps = new Set(["can_manage_deliveries", "can_receive_inventory", "can_prepare_purchase_orders"]);
    const actions = buildQuickActions("vendedor", caps);
    expect(actions.length).toBeLessThanOrEqual(MAX_QUICK_ACTIONS);
    expect(ids(actions)).toEqual(["entregas", "recepciones", "preparar-oc"]);
  });

  it("[9] combinación Karla (view_all_sales+prepare) da Pedidos, Cotizaciones, Preparar OC", () => {
    const caps = new Set(["can_view_all_sales", "can_prepare_purchase_orders"]);
    const actions = buildQuickActions("vendedor", caps);
    expect(ids(actions)).toEqual(["pedidos-globales", "cotizaciones-globales", "preparar-oc"]);
  });

  it("[10] Alexandro (solo can_manage_users) NO obtiene ninguna acción de alcance global de ventas", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_manage_users"]));
    expect(ids(actions)).not.toContain("pedidos-globales");
    expect(ids(actions)).not.toContain("cotizaciones-globales");
    // Conserva sus 2 acciones base de mayor prioridad antes de Usuarios.
    expect(ids(actions)).toEqual(["nueva-cotizacion", "mis-pedidos", "usuarios"]);
  });

  it("[11] Diana (solo can_view_all_sales) NO obtiene ninguna acción admin-only", () => {
    const actions = buildQuickActions("vendedor", new Set(["can_view_all_sales"]));
    expect(ids(actions)).not.toContain("compras");
    expect(ids(actions)).not.toContain("inventario");
    expect(ids(actions)).not.toContain("configuracion");
    expect(ids(actions)).not.toContain("usuarios");
  });

  it("[12] ninguna combinación de capabilities produce ids duplicados", () => {
    const allCaps = new Set([
      "can_manage_deliveries",
      "can_receive_inventory",
      "can_view_all_sales",
      "can_prepare_purchase_orders",
      "can_approve_purchase_orders",
      "can_manage_users",
    ]);
    const actions = buildQuickActions("vendedor", allCaps);
    expect(new Set(ids(actions)).size).toBe(actions.length);
  });

  it("[13] el orden de prioridad es estable entre llamadas para la misma combinación", () => {
    const caps = new Set(["can_manage_deliveries", "can_receive_inventory"]);
    const first = ids(buildQuickActions("vendedor", caps));
    const second = ids(buildQuickActions("vendedor", caps));
    expect(first).toEqual(second);
  });

  it("[14] el máximo de acciones (MAX_QUICK_ACTIONS) nunca se excede, incluso con todas las capabilities activas", () => {
    const allCaps = new Set([
      "can_manage_deliveries",
      "can_receive_inventory",
      "can_view_all_sales",
      "can_prepare_purchase_orders",
      "can_approve_purchase_orders",
      "can_manage_users",
      "can_reserve_inventory",
      "can_fulfill_inventory",
      "can_view_costs",
    ]);
    expect(buildQuickActions("vendedor", allCaps).length).toBe(MAX_QUICK_ACTIONS);
    expect(buildQuickActions("admin", allCaps).length).toBe(MAX_QUICK_ACTIONS);
  });

  it("[15] capabilities desconocidas no rompen el helper y no producen ninguna acción extra", () => {
    const caps = new Set(["capability_que_no_existe", "otra_mas_inventada"]);
    expect(() => buildQuickActions("vendedor", caps)).not.toThrow();
    const actions = buildQuickActions("vendedor", caps);
    expect(ids(actions)).toEqual(["nueva-cotizacion", "mis-pedidos", "clientes"]);
  });
});
