import { describe, expect, it } from "vitest";
import {
  buildAttentionQueue,
  buildLatestChangeMap,
  buildOperationalStatusBreakdown,
  classifyAttentionLevel,
  formatDaysInStatus,
  type AttentionQueueSourceRow,
} from "./attention-queue";

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

  it("Fase 6J: ordena CRÍTICO -> ATENCIÓN -> NORMAL, sin importar antigüedad cruzada de nivel", () => {
    // "normal" con más días que "atencion"/"critico" nunca debería salir antes.
    const rows = [row({ id: "normal-viejo" }), row({ id: "atencion" }), row({ id: "critico" })];
    const latest = new Map([
      ["normal-viejo", "2026-08-23T00:00:00Z"], // 1 día -> normal
      ["atencion", "2026-08-20T00:00:00Z"], // 4 días -> atención
      ["critico", "2026-08-18T00:00:00Z"], // 6 días -> crítico
    ]);
    const result = buildAttentionQueue(rows, latest, now, 15);
    expect(result.map((r) => r.id)).toEqual(["critico", "atencion", "normal-viejo"]);
    expect(result.map((r) => r.attentionLevel)).toEqual(["critico", "atencion", "normal"]);
  });

  it("Fase 6J: dentro del mismo nivel, el que lleva más días va primero", () => {
    const rows = [row({ id: "critico-4d" }), row({ id: "critico-10d" })];
    const latest = new Map([
      ["critico-4d", "2026-08-14T00:00:00Z"], // 10 días
      ["critico-10d", "2026-08-20T00:00:00Z"], // 4 días -- nombre engañoso a propósito, se ordena por fecha real
    ]);
    const result = buildAttentionQueue(rows, latest, now, 15);
    // El de 10 días (critico-4d, por su fecha real) debe ir primero.
    expect(result[0]?.id).toBe("critico-4d");
    expect(result[0]?.daysInStatus).toBe(10);
  });
});

describe("classifyAttentionLevel", () => {
  it("0-2 días -> normal", () => {
    expect(classifyAttentionLevel(0)).toBe("normal");
    expect(classifyAttentionLevel(1)).toBe("normal");
    expect(classifyAttentionLevel(2)).toBe("normal");
  });

  it("3-5 días -> atencion", () => {
    expect(classifyAttentionLevel(3)).toBe("atencion");
    expect(classifyAttentionLevel(4)).toBe("atencion");
    expect(classifyAttentionLevel(5)).toBe("atencion");
  });

  it("6+ días -> critico", () => {
    expect(classifyAttentionLevel(6)).toBe("critico");
    expect(classifyAttentionLevel(30)).toBe("critico");
  });
});

describe("formatDaysInStatus", () => {
  it("singular para 1 día", () => {
    expect(formatDaysInStatus(1)).toBe("1 día");
  });

  it("plural para el resto", () => {
    expect(formatDaysInStatus(0)).toBe("0 días");
    expect(formatDaysInStatus(2)).toBe("2 días");
    expect(formatDaysInStatus(15)).toBe("15 días");
  });
});

describe("buildLatestChangeMap", () => {
  it("toma la primera ocurrencia por order_id (se espera orden desc por changed_at)", () => {
    const map = buildLatestChangeMap([
      { order_id: "a", changed_at: "2026-08-20T00:00:00Z" },
      { order_id: "a", changed_at: "2026-08-15T00:00:00Z" },
      { order_id: "b", changed_at: "2026-08-10T00:00:00Z" },
    ]);
    expect(map.get("a")).toBe("2026-08-20T00:00:00Z");
    expect(map.get("b")).toBe("2026-08-10T00:00:00Z");
    expect(map.size).toBe(2);
  });

  it("lista vacía -> mapa vacío", () => {
    expect(buildLatestChangeMap([]).size).toBe(0);
  });
});
