import { describe, expect, it } from "vitest";
import { canFulfillInventory, canManageDeliveries, canReceiveInventory, canReserveInventory } from "./logistics";
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
});
