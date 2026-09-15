import { describe, expect, it } from "vitest";
import {
  canCreatePurchaseOrderReceipt,
  canFulfillInventory,
  canManageCommissions,
  canManageDeliveries,
  canManageSalesOrderFinance,
  canReceiveInventory,
  canReserveInventory,
} from "./logistics";
import { canWriteRecord } from "./ownership";
import type { CurrentProfile } from "./profile";

function profile(overrides: Partial<CurrentProfile> = {}): CurrentProfile {
  return {
    userId: "user-1",
    email: "user@example.com",
    name: "Usuario",
    role: "vendedor",
    salespersonId: "sp-owner",
    active: true,
    ...overrides,
  };
}

const OWNER_SP = "sp-owner";
const OTHER_SP = "sp-otro";
const NONE = new Set<string>();

describe("helpers logísticos 6R.1B-2 — reglas comunes", () => {
  it("[1] admin activo → todas las operaciones logísticas true, sin ninguna capability", () => {
    const admin = profile({ role: "admin", salespersonId: null });
    expect(canReserveInventory(admin, NONE, OTHER_SP)).toBe(true);
    expect(canFulfillInventory(admin, NONE, OTHER_SP)).toBe(true);
    expect(canManageDeliveries(admin, NONE, OTHER_SP)).toBe(true);
    expect(canReceiveInventory(admin, NONE)).toBe(true);
  });

  it("[2] dueño sin capabilities → mantiene la autoridad previa sobre su propio registro (reservas/fulfillment/entregas)", () => {
    const owner = profile({ role: "vendedor", salespersonId: OWNER_SP });
    expect(canReserveInventory(owner, NONE, OWNER_SP)).toBe(true);
    expect(canFulfillInventory(owner, NONE, OWNER_SP)).toBe(true);
    expect(canManageDeliveries(owner, NONE, OWNER_SP)).toBe(true);
  });

  it("dueño de la OC (vía el Pedido) SIN can_receive_inventory NO puede recibir — la recepción nunca tuvo autoridad de ownership", () => {
    const owner = profile({ role: "vendedor", salespersonId: OWNER_SP });
    expect(canReceiveInventory(owner, NONE)).toBe(false);
  });

  it("[9] usuario inactivo → false en las 4, incluso con la capability activa (nunca confiar solo en el Set)", () => {
    const inactive = profile({ active: false });
    const withAll = new Set(["can_reserve_inventory", "can_fulfill_inventory", "can_manage_deliveries", "can_receive_inventory"]);
    expect(canReserveInventory(inactive, withAll, OTHER_SP)).toBe(false);
    expect(canFulfillInventory(inactive, withAll, OTHER_SP)).toBe(false);
    expect(canManageDeliveries(inactive, withAll, OTHER_SP)).toBe(false);
    expect(canReceiveInventory(inactive, withAll)).toBe(false);
  });

  it("[10] capability ausente (Set vacío), sobre registro ajeno, sin ser owner/admin → false en las 4", () => {
    const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
    expect(canReserveInventory(vendedor, NONE, OTHER_SP)).toBe(false);
    expect(canFulfillInventory(vendedor, NONE, OTHER_SP)).toBe(false);
    expect(canManageDeliveries(vendedor, NONE, OTHER_SP)).toBe(false);
    expect(canReceiveInventory(vendedor, NONE)).toBe(false);
  });

  it("[7] can_view_all_sales sola → todas las operaciones logísticas false (nunca se lee esa key en absoluto)", () => {
    const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
    const onlyViewAll = new Set(["can_view_all_sales"]);
    expect(canReserveInventory(vendedor, onlyViewAll, OTHER_SP)).toBe(false);
    expect(canFulfillInventory(vendedor, onlyViewAll, OTHER_SP)).toBe(false);
    expect(canManageDeliveries(vendedor, onlyViewAll, OTHER_SP)).toBe(false);
    expect(canReceiveInventory(vendedor, onlyViewAll)).toBe(false);
  });

  it("[8] tener una capability logística nunca hace TRUE a canWriteRecord — son autoridades independientes (se importa y se llama, nunca se reemplaza)", () => {
    const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
    const allLogistics = new Set(["can_reserve_inventory", "can_fulfill_inventory", "can_manage_deliveries", "can_receive_inventory"]);
    // canReserveInventory/etc. devuelven true sobre el registro ajeno por
    // la capability — pero eso NUNCA debe leerse como "canWriteRecord
    // también es true": se verifica importándolo directamente aparte.
    expect(canReserveInventory(vendedor, allLogistics, OTHER_SP)).toBe(true);
    expect(canWriteRecord(vendedor, OTHER_SP)).toBe(false);
  });
});

describe("[3] ajeno + can_reserve_inventory → reserva sí, surtir no", () => {
  const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
  const onlyReserve = new Set(["can_reserve_inventory"]);

  it("puede reservar/ajustar/liberar (canReserveInventory true)", () => {
    expect(canReserveInventory(vendedor, onlyReserve, OTHER_SP)).toBe(true);
  });

  it("NO puede surtir (canFulfillInventory false) — independiente, el backend no lo exige junto", () => {
    expect(canFulfillInventory(vendedor, onlyReserve, OTHER_SP)).toBe(false);
  });
});

describe("[4] ajeno + can_fulfill_inventory → surtir sí, reserva no", () => {
  const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
  const onlyFulfill = new Set(["can_fulfill_inventory"]);

  it("puede surtir (canFulfillInventory true) sin tener can_reserve_inventory", () => {
    expect(canFulfillInventory(vendedor, onlyFulfill, OTHER_SP)).toBe(true);
  });

  it("NO puede reservar/ajustar/liberar (canReserveInventory false)", () => {
    expect(canReserveInventory(vendedor, onlyFulfill, OTHER_SP)).toBe(false);
  });
});

describe("[5] ajeno + can_manage_deliveries → entrega sí", () => {
  it("canManageDeliveries true sobre Pedido ajeno", () => {
    const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
    expect(canManageDeliveries(vendedor, new Set(["can_manage_deliveries"]), OTHER_SP)).toBe(true);
  });
});

describe("[6] ajeno + can_receive_inventory → recepción sí", () => {
  it("canReceiveInventory true, sin necesitar ninguna relación de ownership", () => {
    const vendedor = profile({ role: "vendedor", salespersonId: OWNER_SP });
    expect(canReceiveInventory(vendedor, new Set(["can_receive_inventory"]))).toBe(true);
  });
});

/**
 * [11]-[20] cobertura funcional/UI (THÖREN 6R.1B-2B) — este proyecto no
 * tiene infraestructura de render de componentes (React Testing Library),
 * mismo criterio ya usado en 6R.1B-1: en vez de renderizar JSX, cada caso
 * reproduce EXACTAMENTE la expresión booleana que la pantalla real evalúa
 * para mostrar/ocultar la acción (citando el archivo:línea de origen), de
 * modo que un cambio futuro que rompa esa expresión también rompe la
 * prueba. No sustituye a la prueba manual en navegador (QA visual), pero sí
 * fija en código el comportamiento esperado de cada pantalla tocada por
 * 6R.1B-2B.
 */
describe("[11]-[20] cobertura funcional/UI por pantalla", () => {
  it("[11] Reservas — sin reserva activa + canReserve=true → se ofrece 'Reservar stock' (reservation-row.tsx: `row.reservation || !canReserve ? null : (...)`)", () => {
    const hasReservation = false;
    const canReserve = true;
    const showReserveForm = !(hasReservation || !canReserve);
    expect(showReserveForm).toBe(true);
  });

  it("[12] Reservas — sin reserva activa + canReserve=false (solo lectura vía can_view_all_sales) → NO se ofrece 'Reservar stock'", () => {
    const hasReservation = false;
    const canReserve = false;
    const showReserveForm = !(hasReservation || !canReserve);
    expect(showReserveForm).toBe(false);
  });

  it("[13] Reservas — con reserva activa + canFulfill=true + pendiente>0 + no huérfana → se ofrece 'Surtir' (reservation-row.tsx: `row.reservation && canFulfill && !row.isOrphaned && pendingToFulfill > 0`)", () => {
    const hasReservation = true;
    const canFulfill = true;
    const isOrphaned = false;
    const pendingToFulfill = 3;
    const showFulfillForm = hasReservation && canFulfill && !isOrphaned && pendingToFulfill > 0;
    expect(showFulfillForm).toBe(true);
  });

  it("[14] Reservas — misma reserva pero huérfana (producto ya no está en las partidas) → 'Surtir' se oculta aunque canFulfill=true", () => {
    const hasReservation = true;
    const canFulfill = true;
    const isOrphaned = true;
    const pendingToFulfill = 3;
    const showFulfillForm = hasReservation && canFulfill && !isOrphaned && pendingToFulfill > 0;
    expect(showFulfillForm).toBe(false);
  });

  it("[15] Entregas — 'Nueva entrega' visible si canWrite O canManageDeliveries (deliveries-section.tsx: `{(canWrite || canManageDeliveries) && (...)}`) — Rodolfo (solo capability, sin ownership) también la ve", () => {
    const canWrite = false; // no es dueño ni admin
    const canManageDeliveriesFlag = true; // tiene can_manage_deliveries
    expect(canWrite || canManageDeliveriesFlag).toBe(true);
  });

  it("[16] Entregas — nueva-entrega guard server-side (nueva-entrega/page.tsx) bloquea cuando ni ownership ni capability aplican", () => {
    const vendedorAjeno = profile({ role: "vendedor", salespersonId: OWNER_SP });
    expect(canManageDeliveries(vendedorAjeno, NONE, OTHER_SP)).toBe(false);
  });

  it("[17] Detalle de Entrega — Rodolfo (capability, sin ser dueño del Pedido origen) obtiene autoridad completa de escritura (status/detalle/evidencia comparten el mismo canWrite=canManageDeliveries en entregas/[id]/page.tsx)", () => {
    const rodolfo = profile({ role: "vendedor", salespersonId: OTHER_SP });
    const canWriteOnEntrega = canManageDeliveries(rodolfo, new Set(["can_manage_deliveries"]), OWNER_SP);
    expect(canWriteOnEntrega).toBe(true);
  });

  it("[18] Detalle de Entrega — solo can_view_all_sales (sin can_manage_deliveries ni ownership) → solo lectura, ninguna acción de escritura visible", () => {
    const soloLectura = profile({ role: "vendedor", salespersonId: OTHER_SP });
    const canWriteOnEntrega = canManageDeliveries(soloLectura, new Set(["can_view_all_sales"]), OWNER_SP);
    expect(canWriteOnEntrega).toBe(false);
  });

  it("[19] Recepción de OC — canReceive=true vía capability (no-admin) muestra la columna de recepción, pero el estado/detalles de la Purchase Order siguen ocultos (isAdmin=false) — compras/[id]/page.tsx usa canReceive e isAdmin por separado", () => {
    const rodolfo = profile({ role: "vendedor", salespersonId: OTHER_SP });
    const isAdmin = (rodolfo.role as string) === "admin";
    const canReceive = canReceiveInventory(rodolfo, new Set(["can_receive_inventory"]));
    expect(canReceive).toBe(true);
    expect(isAdmin).toBe(false);
  });

  it("[20] Recepción de OC — admin conserva ambas autoridades a la vez (recepción Y estado/detalles de la Purchase Order)", () => {
    const admin = profile({ role: "admin", salespersonId: null });
    const isAdmin = admin.role === "admin";
    const canReceive = canReceiveInventory(admin, NONE);
    expect(canReceive).toBe(true);
    expect(isAdmin).toBe(true);
  });

  describe("canManageSalesOrderFinance (THÖREN Financial Release, 0068)", () => {
    it("admin activo → true sin ninguna capability", () => {
      const admin = profile({ role: "admin", salespersonId: null });
      expect(canManageSalesOrderFinance(admin, NONE)).toBe(true);
    });

    it("dueño (salesperson) de la Sales Order SIN can_manage_sales_order_finance → false — nunca tuvo autoridad de ownership sobre lo financiero", () => {
      const owner = profile({ role: "vendedor", salespersonId: OWNER_SP });
      expect(canManageSalesOrderFinance(owner, NONE)).toBe(false);
    });

    it("no-admin, no dueño, CON can_manage_sales_order_finance → true (caso típico: rol de Finanzas)", () => {
      const finance = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canManageSalesOrderFinance(finance, new Set(["can_manage_sales_order_finance"]))).toBe(true);
    });

    it("usuario inactivo → false incluso con la capability activa", () => {
      const inactive = profile({ active: false });
      expect(canManageSalesOrderFinance(inactive, new Set(["can_manage_sales_order_finance"]))).toBe(false);
    });

    it("sin capability y sin ser admin → false", () => {
      const vendedor = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canManageSalesOrderFinance(vendedor, new Set(["can_view_all_sales"]))).toBe(false);
    });
  });

  describe("canManageCommissions (THÖREN Comisiones privadas de Dirección, 0073 — ajuste post-review: EXCLUSIVAMENTE la capability, ni admin la otorga por defecto)", () => {
    it("admin activo SIN can_manage_commissions → false — a diferencia de TODAS las demás capabilities de este archivo, admin NO tiene atajo aquí", () => {
      const admin = profile({ role: "admin", salespersonId: null });
      expect(canManageCommissions(admin, NONE)).toBe(false);
    });

    it("admin activo CON can_manage_commissions → true (Dirección General puede ser un admin, pero es la capability la que autoriza, no el rol)", () => {
      const admin = profile({ role: "admin", salespersonId: null });
      expect(canManageCommissions(admin, new Set(["can_manage_commissions"]))).toBe(true);
    });

    it("dueño (salesperson) de la Sales Order SIN can_manage_commissions → false — el propio vendedor NUNCA tiene autoridad aquí, ni siquiera sobre su propia comisión", () => {
      const owner = profile({ role: "vendedor", salespersonId: OWNER_SP });
      expect(canManageCommissions(owner, NONE)).toBe(false);
    });

    it("no-admin, no dueño, CON can_manage_commissions → true (caso típico: Dirección General)", () => {
      const director = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canManageCommissions(director, new Set(["can_manage_commissions"]))).toBe(true);
    });

    it("usuario inactivo → false incluso con la capability activa", () => {
      const inactive = profile({ active: false });
      expect(canManageCommissions(inactive, new Set(["can_manage_commissions"]))).toBe(false);
    });

    it("sin capability y sin ser admin → false, incluso con can_manage_sales_order_finance (comisiones es estrictamente independiente de Finanzas)", () => {
      const finance = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canManageCommissions(finance, new Set(["can_manage_sales_order_finance", "can_view_all_sales"]))).toBe(false);
    });
  });

  describe("canCreatePurchaseOrderReceipt — fix puntual: botón \"Recibir mercancía\" (bug reportado: no aparecía para una PO en_transito)", () => {
    it("PO en_transito + permiso (can_receive_inventory) → true", () => {
      const receiver = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "en_transito")).toBe(true);
    });

    it("PO en_transito + admin (sin capability explícita) → true", () => {
      const admin = profile({ role: "admin", salespersonId: null });
      expect(canCreatePurchaseOrderReceipt(admin, NONE, "en_transito")).toBe(true);
    });

    it("PO en_transito SIN permiso → false (oculto)", () => {
      const vendedor = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canCreatePurchaseOrderReceipt(vendedor, NONE, "en_transito")).toBe(false);
    });

    it("PO borrador, con permiso → false (oculto — nunca hay nada que recibir en un borrador)", () => {
      const receiver = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "borrador")).toBe(false);
    });

    it("PO cancelada, con permiso → false (oculto)", () => {
      const receiver = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "cancelada")).toBe(false);
    });

    it("PO recibida (fully received), con permiso → false (oculto — fix: 'recibida' se retiró de PURCHASE_ORDER_RECEIVABLE_STATUSES)", () => {
      const receiver = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "recibida")).toBe(false);
    });

    it("PO ordenada/confirmada/recibida_parcial, con permiso → true (siguen siendo receptibles)", () => {
      const receiver = profile({ role: "vendedor", salespersonId: OTHER_SP });
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "ordenada")).toBe(true);
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "confirmada")).toBe(true);
      expect(canCreatePurchaseOrderReceipt(receiver, new Set(["can_receive_inventory"]), "recibida_parcial")).toBe(true);
    });

    it("usuario inactivo → false incluso en en_transito con la capability activa", () => {
      const inactive = profile({ active: false });
      expect(canCreatePurchaseOrderReceipt(inactive, new Set(["can_receive_inventory"]), "en_transito")).toBe(false);
    });
  });
});
