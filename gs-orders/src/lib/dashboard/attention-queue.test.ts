import { describe, expect, it } from "vitest";
import { buildAttentionQueue, buildOperationalStatusBreakdown, type AttentionQueueSourceRow } from "./attention-queue";

function row(overrides: Partial<AttentionQueueSourceRow> = {}): AttentionQueueSourceRow {
  return {
    id: "order-1",
    folio: "PED-0001",
    clientName: "CEMEX",
    businessUnitName: "Thunder LED Lights",
    salespersonName: "Vendedor Uno",
    operationalStatus: "pedido",
    ...overrides,
  };
}

describe("buildOperationalStatusBreakdown", () => {
  it("cuenta cada estado, empezando todos en 0", () => {
    const result = buildOperationalStatusBreakdown(["pedido", "en_proceso", "pedido", "completado"]);
    expect(result).toEqual({
      pedido: 2,
      en_proceso: 1,
      ordenado_a_proveedor: 0,
      en_transito: 0,
      recibido: 0,
      programado_entrega_instalacion: 0,
      completado: 1,
      cancelado: 0,
    });
  });

  it("lista vacía -> todos en 0", () => {
    const result = buildOperationalStatusBreakdown([]);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});

describe("buildAttentionQueue", () => {
  const now = new Date("2026-08-24T12:00:00Z");

  it("calcula daysInStatus desde el último cambio registrado", () => {
    const rows = [row({ id: "a" })];
    const latest = new Map([["a", "2026-08-20T12:00:00Z"]]);
    const result = buildAttentionQueue(rows, latest, now, 15);
    expect(result).toHaveLength(1);
    expect(result[0]?.daysInStatus).toBe(4);
    expect(result[0]?.lastChangedAt).toBe("2026-08-20T12:00:00Z");
  });

  it("ordena de más antiguo a más reciente en su estado actual", () => {
    const rows = [row({ id: "reciente" }), row({ id: "antiguo" }), row({ id: "medio" })];
    const latest = new Map([
      ["reciente", "2026-08-23T00:00:00Z"],
      ["antiguo", "2026-08-01T00:00:00Z"],
      ["medio", "2026-08-15T00:00:00Z"],
    ]);
    const result = buildAttentionQueue(rows, latest, now, 15);
    expect(result.map((r) => r.id)).toEqual(["antiguo", "medio", "reciente"]);
  });

  it("descarta pedidos sin fila de historial (defensivo, nunca inventa fecha)", () => {
    const rows = [row({ id: "con-historial" }), row({ id: "sin-historial" })];
    const latest = new Map([["con-historial", "2026-08-20T00:00:00Z"]]);
    const result = buildAttentionQueue(rows, latest, now, 15);
    expect(result.map((r) => r.id)).toEqual(["con-historial"]);
  });

  it("respeta el límite", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const latest = new Map([
      ["a", "2026-08-01T00:00:00Z"],
      ["b", "2026-08-02T00:00:00Z"],
      ["c", "2026-08-03T00:00:00Z"],
    ]);
    const result = buildAttentionQueue(rows, latest, now, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("nunca da días negativos aunque el reloj del cliente esté ligeramente adelantado", () => {
    const rows = [row({ id: "a" })];
    const latest = new Map([["a", "2026-08-25T00:00:00Z"]]); // "futuro" respecto a `now`
    const result = buildAttentionQueue(rows, latest, now, 15);
    expect(result[0]?.daysInStatus).toBe(0);
  });
});
