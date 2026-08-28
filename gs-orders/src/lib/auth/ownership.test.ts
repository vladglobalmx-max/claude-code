import { describe, expect, it } from "vitest";
import { canWriteRecord } from "./ownership";
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

describe("canWriteRecord", () => {
  it("returns false when profile is null", () => {
    expect(canWriteRecord(null, "sp-1")).toBe(false);
  });

  it("returns false when profile is inactive, even if admin", () => {
    expect(canWriteRecord(profile({ role: "admin", active: false }), "sp-1")).toBe(false);
  });

  it("returns true for an active admin on a foreign record", () => {
    expect(canWriteRecord(profile({ role: "admin", salespersonId: null }), "sp-otro")).toBe(true);
  });

  it("returns true for an active vendedor on their own record", () => {
    expect(canWriteRecord(profile({ role: "vendedor", salespersonId: "sp-1" }), "sp-1")).toBe(true);
  });

  it("returns false for an active vendedor on a foreign record — this is the exact bug case (can_view_all_sales widened visibility but must never widen write authority)", () => {
    expect(canWriteRecord(profile({ role: "vendedor", salespersonId: "sp-1" }), "sp-otro")).toBe(false);
  });

  it("returns false for a non-admin with salespersonId null", () => {
    expect(canWriteRecord(profile({ role: "vendedor", salespersonId: null }), "sp-1")).toBe(false);
  });

  it("returns false for a non-admin when the record has no salesperson_id", () => {
    expect(canWriteRecord(profile({ role: "vendedor", salespersonId: "sp-1" }), null)).toBe(false);
  });

  it("cannot be influenced by can_view_all_sales by design — the function signature has no capability parameter at all, so a caller has no way to pass one in", () => {
    // canWriteRecord(profile, recordSalespersonId) — exactly two parameters,
    // neither of which is (or could be) a capability. This test exists as a
    // living assertion of that contract: if a future edit ever adds a third
    // parameter for a capability, this test's intent documents why that
    // would be a regression, not a feature.
    expect(canWriteRecord.length).toBe(2);
  });
});

/**
 * Escenarios de UI reales (THÖREN 6R.1B-1 UX fix) — cada componente/página
 * afectado (cotizaciones/[id]/page.tsx, pedidos/[id]/page.tsx,
 * quote-notes-editor.tsx, reservation-row.tsx, entregas/[id]/page.tsx,
 * y los guards server-side de /editar y /nueva-entrega) reduce su decisión
 * de mostrar/ocultar a exactamente esta misma llamada — no hay lógica de
 * autorización adicional en ningún componente. Este proyecto no tiene
 * infraestructura de renderizado de componentes React (ningún .test.tsx,
 * sin @testing-library/react — los 323 tests existentes son de lógica
 * pura); introducirla sería una ampliación de alcance no pedida. Estos
 * escenarios prueban la MISMA función que cada sitio de UI invoca,
 * nombrados por la situación real que representan — el renderizado en sí
 * se verificó manualmente en el navegador (ver reporte de cierre).
 */
describe("canWriteRecord — escenarios de UI (6R.1B-1)", () => {
  const vendedorPropio = profile({ role: "vendedor", salespersonId: "sp-vendedor-a" });
  const vendedorConVisibilidadAmpliada = profile({ role: "vendedor", salespersonId: "sp-vendedor-b" });
  const admin = profile({ role: "admin", salespersonId: null });

  it("[8] cotización ajena → QuoteStatusActions/Editar/QuoteNotesEditor deben ocultarse (visible por can_view_all_sales, no propia)", () => {
    expect(canWriteRecord(vendedorConVisibilidadAmpliada, "sp-vendedor-a")).toBe(false);
  });

  it("[9] cotización propia → las acciones existentes se mantienen intactas", () => {
    expect(canWriteRecord(vendedorPropio, "sp-vendedor-a")).toBe(true);
  });

  it("[10] pedido ajeno → status/operational-status/Editar/reservas/entregas deben ocultarse", () => {
    expect(canWriteRecord(vendedorConVisibilidadAmpliada, "sp-vendedor-a")).toBe(false);
  });

  it("[11] pedido propio → las acciones existentes se mantienen intactas", () => {
    expect(canWriteRecord(vendedorPropio, "sp-vendedor-a")).toBe(true);
  });

  it("[12] /cotizaciones/[id]/editar directo sobre cotización ajena → el guard server-side debe redirigir (canWriteRecord false)", () => {
    expect(canWriteRecord(vendedorConVisibilidadAmpliada, "sp-vendedor-a")).toBe(false);
  });

  it("[13] /pedidos/[id]/editar directo sobre pedido ajeno → el guard server-side debe redirigir (canWriteRecord false)", () => {
    expect(canWriteRecord(vendedorConVisibilidadAmpliada, "sp-vendedor-a")).toBe(false);
  });

  it("[14] /pedidos/[id]/nueva-entrega directo sobre pedido ajeno → el guard server-side debe redirigir (canWriteRecord false)", () => {
    expect(canWriteRecord(vendedorConVisibilidadAmpliada, "sp-vendedor-a")).toBe(false);
  });

  it("[15] entrega ajena (ownership resuelto vía el Pedido origen) → status/detalles/evidencia deben ocultarse", () => {
    // entregas/[id]/page.tsx resuelve ownership con order.salesperson_id,
    // nunca con un campo propio de deliveries (que no tiene salesperson_id).
    const orderSalespersonId = "sp-vendedor-a";
    expect(canWriteRecord(vendedorConVisibilidadAmpliada, orderSalespersonId)).toBe(false);
  });

  it("[16] admin conserva autoridad total sin importar el dueño — lectura/PDF/duplicar nunca dependen de canWriteRecord en ningún sitio (siempre se renderizan aparte)", () => {
    expect(canWriteRecord(admin, "sp-vendedor-a")).toBe(true);
    expect(canWriteRecord(admin, "sp-vendedor-b")).toBe(true);
    expect(canWriteRecord(admin, null)).toBe(true);
  });
});
