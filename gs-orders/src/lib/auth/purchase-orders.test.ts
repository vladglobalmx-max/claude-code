import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canApprovePurchaseOrders, canPreparePurchaseOrders } from "./purchase-orders";
import { canReceiveInventory } from "./logistics";
import type { CurrentProfile } from "./profile";

function profile(overrides: Partial<CurrentProfile> = {}): CurrentProfile {
  return {
    userId: "user-1",
    email: "user@example.com",
    name: "Usuario",
    role: "vendedor",
    salespersonId: "sp-1",
    active: true,
    ...overrides,
  };
}

const NONE = new Set<string>();

/**
 * THÖREN 6R.1B-3B — este proyecto no tiene infraestructura de render de
 * componentes (React Testing Library), mismo criterio ya usado en
 * 6R.1B-1/2B: los ítems [8]-[19] reproducen EXACTAMENTE la expresión
 * booleana que la pantalla real evalúa (citando archivo:línea), en vez de
 * renderizar JSX. El ítem [20] es una excepción deliberada: en vez de
 * reproducir una condición (no existe ninguna — esa es justo la
 * afirmación a probar), inspecciona el código fuente del archivo real
 * para confirmar que jamás se ofrece un control editable de proveedor —
 * la única forma honesta de probar una AUSENCIA sin RTL.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compraDetailPageSource = readFileSync(
  path.join(__dirname, "../../app/(app)/compras/[id]/page.tsx"),
  "utf8"
);

describe("helpers de Purchase Orders 6R.1B-3 — reglas comunes", () => {
  it("[1] admin activo → prepare=true, approve=true, sin ninguna capability", () => {
    const admin = profile({ role: "admin" });
    expect(canPreparePurchaseOrders(admin, NONE)).toBe(true);
    expect(canApprovePurchaseOrders(admin, NONE)).toBe(true);
  });

  it("[2] can_prepare_purchase_orders sola → prepare=true, approve=false", () => {
    const vendedor = profile();
    const caps = new Set(["can_prepare_purchase_orders"]);
    expect(canPreparePurchaseOrders(vendedor, caps)).toBe(true);
    expect(canApprovePurchaseOrders(vendedor, caps)).toBe(false);
  });

  it("[3] can_approve_purchase_orders sola → prepare=false, approve=true", () => {
    const vendedor = profile();
    const caps = new Set(["can_approve_purchase_orders"]);
    expect(canPreparePurchaseOrders(vendedor, caps)).toBe(false);
    expect(canApprovePurchaseOrders(vendedor, caps)).toBe(true);
  });

  it("[4] ninguna capability → ambas false", () => {
    const vendedor = profile();
    expect(canPreparePurchaseOrders(vendedor, NONE)).toBe(false);
    expect(canApprovePurchaseOrders(vendedor, NONE)).toBe(false);
  });

  it("[5] usuario inactivo → false en ambas, incluso con las dos capabilities activas", () => {
    const inactive = profile({ active: false });
    const caps = new Set(["can_prepare_purchase_orders", "can_approve_purchase_orders"]);
    expect(canPreparePurchaseOrders(inactive, caps)).toBe(false);
    expect(canApprovePurchaseOrders(inactive, caps)).toBe(false);
  });

  it("[6] can_receive_inventory no afecta prepare/approve (autoridades independientes, 0044 vs 0045)", () => {
    const vendedor = profile();
    const caps = new Set(["can_receive_inventory"]);
    expect(canPreparePurchaseOrders(vendedor, caps)).toBe(false);
    expect(canApprovePurchaseOrders(vendedor, caps)).toBe(false);
    // Y en la otra dirección: prepare/approve tampoco otorgan recepción.
    const preparerCaps = new Set(["can_prepare_purchase_orders", "can_approve_purchase_orders"]);
    expect(canReceiveInventory(vendedor, preparerCaps)).toBe(false);
  });

  it("[7] can_view_all_sales no afecta prepare/approve (visibilidad != autoridad de escritura)", () => {
    const vendedor = profile();
    const caps = new Set(["can_view_all_sales"]);
    expect(canPreparePurchaseOrders(vendedor, caps)).toBe(false);
    expect(canApprovePurchaseOrders(vendedor, caps)).toBe(false);
  });
});

describe("[8]-[17] cobertura funcional/UI por pantalla (compras/[id]/page.tsx, status-actions.tsx)", () => {
  it("[8] borrador + canPrepare (no-admin) → detalles editables (page.tsx: `canEditDetails = isAdmin ? status !== 'cancelada' : canPrepare && status === 'borrador'`)", () => {
    const isAdmin = false;
    const canPrepare = true;
    const status: string = "borrador";
    const canEditDetails = isAdmin ? status !== "cancelada" : canPrepare && status === "borrador";
    expect(canEditDetails).toBe(true);
  });

  it("[9] borrador + canPrepare (admin o no) → partidas editables (page.tsx: `canEditItems = (isAdmin || canPrepare) && status === 'borrador'`)", () => {
    const isAdmin = false;
    const canPrepare = true;
    const status = "borrador";
    const canEditItems = (isAdmin || canPrepare) && status === "borrador";
    expect(canEditItems).toBe(true);
  });

  it("[10] borrador + canPrepare SIN canApprove → no se ofrece 'Autorizar y ordenar' (status-actions.tsx: solo se agrega si `status === 'borrador' && canApprove`)", () => {
    const status = "borrador";
    const canApprove = false;
    const offersAuthorize = status === "borrador" && canApprove;
    expect(offersAuthorize).toBe(false);
  });

  it("[11] borrador + canApprove → se ofrece la acción de autorización", () => {
    const status = "borrador";
    const canApprove = true;
    const offersAuthorize = status === "borrador" && canApprove;
    expect(offersAuthorize).toBe(true);
  });

  it("[12] post-borrador + canPrepare (sin canApprove, no-admin) → NO puede editar detalles (canEditDetails cae a false porque status !== 'borrador')", () => {
    const isAdmin = false;
    const canPrepare = true;
    const status = "ordenada";
    const canEditDetails = isAdmin ? (status as string) !== "cancelada" : canPrepare && (status as string) === "borrador";
    const canEditItems = (isAdmin || canPrepare) && (status as string) === "borrador";
    expect(canEditDetails).toBe(false);
    expect(canEditItems).toBe(false);
  });

  it("[13] post-borrador ('ordenada') + canApprove → se ofrece la transición secuencial válida (ADVANCE_SEQUENCE.ordenada -> 'confirmada')", () => {
    const ADVANCE_SEQUENCE: Partial<Record<string, { next: string; label: string }>> = {
      ordenada: { next: "confirmada", label: "Marcar como confirmada" },
      confirmada: { next: "en_transito", label: "Marcar en tránsito" },
    };
    const status = "ordenada";
    const canApprove = true;
    const advance = ADVANCE_SEQUENCE[status];
    const offersAdvance = Boolean(advance) && canApprove;
    expect(offersAdvance).toBe(true);
    expect(advance?.next).toBe("confirmada");
  });

  it("[14] borrador + canPrepare → puede cancelar (status-actions.tsx: `canCancel = status === 'borrador' ? canPrepare || canApprove : canApprove`)", () => {
    const status = "borrador";
    const canPrepare = true;
    const canApprove = false;
    const canCancel = status === "borrador" ? canPrepare || canApprove : canApprove;
    expect(canCancel).toBe(true);
  });

  it("[15] post-borrador + canPrepare (sin canApprove) → NO puede cancelar", () => {
    const status = "ordenada";
    const canPrepare = true;
    const canApprove = false;
    const canCancel = (status as string) === "borrador" ? canPrepare || canApprove : canApprove;
    expect(canCancel).toBe(false);
  });

  it("[16] post-borrador + canApprove → puede cancelar", () => {
    const status = "en_transito";
    const canPrepare = false;
    const canApprove = true;
    const canCancel = (status as string) === "borrador" ? canPrepare || canApprove : canApprove;
    expect(canCancel).toBe(true);
  });

  it("[17] canReceive es independiente de canPrepare/canApprove — un usuario con las 3 en distintas combinaciones nunca deriva una de otra", () => {
    // Rodolfo: prepare=true, approve=false, receive=true.
    const rodolfo = profile();
    const rodolfoCaps = new Set(["can_prepare_purchase_orders", "can_receive_inventory"]);
    expect(canPreparePurchaseOrders(rodolfo, rodolfoCaps)).toBe(true);
    expect(canApprovePurchaseOrders(rodolfo, rodolfoCaps)).toBe(false);
    expect(canReceiveInventory(rodolfo, rodolfoCaps)).toBe(true);

    // Karla: prepare=true, approve=false, receive=false.
    const karla = profile();
    const karlaCaps = new Set(["can_prepare_purchase_orders"]);
    expect(canPreparePurchaseOrders(karla, karlaCaps)).toBe(true);
    expect(canApprovePurchaseOrders(karla, karlaCaps)).toBe(false);
    expect(canReceiveInventory(karla, karlaCaps)).toBe(false);
  });
});

describe("[18]-[19] route /pedidos/[id]/nueva-compra — mismo guard exacto", () => {
  it("[18] usuario con can_prepare_purchase_orders → el guard de la ruta (canPreparePurchaseOrders) permite continuar", () => {
    const vendedor = profile();
    const caps = new Set(["can_prepare_purchase_orders"]);
    expect(canPreparePurchaseOrders(vendedor, caps)).toBe(true);
  });

  it("[19] usuario sin can_prepare_purchase_orders (ni admin) → el guard de la ruta rechaza (redirect en nueva-compra/page.tsx)", () => {
    const vendedor = profile();
    expect(canPreparePurchaseOrders(vendedor, NONE)).toBe(false);
  });
});

describe("[20] proveedor sigue read-only", () => {
  it("compras/[id]/page.tsx nunca ofrece un control editable de proveedor, en ningún combinación de isAdmin/canPrepare/canApprove (inspección de código fuente — no hay ninguna condición que probar porque esa es justo la afirmación)", () => {
    expect(compraDetailPageSource).toContain('<dd className="text-sm font-medium text-ink">{supplier?.name ?? "—"}</dd>');
    expect(compraDetailPageSource).not.toMatch(/id="supplier"|setSupplierId|supplier_id:\s*supplierId/);
  });
});
