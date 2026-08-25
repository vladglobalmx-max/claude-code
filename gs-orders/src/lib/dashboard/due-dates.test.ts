import { describe, expect, it } from "vitest";
import { classifyDueDateStatus, operationalStatusRequiresDueDate, resolveRelevantDueDate } from "./due-dates";

describe("resolveRelevantDueDate", () => {
  const dates = {
    supplierCommitmentDate: "2026-09-05",
    estimatedReceptionDate: "2026-09-10",
    scheduledDeliveryDate: "2026-09-20",
  };

  it("ordenado_a_proveedor -> supplier_commitment_date", () => {
    expect(resolveRelevantDueDate("ordenado_a_proveedor", dates)).toBe("2026-09-05");
  });

  it("ordenado_a_proveedor sin supplier_commitment_date -> fallback a estimated_reception_date", () => {
    expect(
      resolveRelevantDueDate("ordenado_a_proveedor", { ...dates, supplierCommitmentDate: null })
    ).toBe("2026-09-10");
  });

  it("ordenado_a_proveedor sin ninguna de las dos -> null", () => {
    expect(
      resolveRelevantDueDate("ordenado_a_proveedor", {
        supplierCommitmentDate: null,
        estimatedReceptionDate: null,
        scheduledDeliveryDate: "2026-09-20",
      })
    ).toBeNull();
  });

  it("en_transito -> estimated_reception_date (sin fallback a supplier_commitment_date)", () => {
    expect(resolveRelevantDueDate("en_transito", dates)).toBe("2026-09-10");
  });

  it("recibido / programado_entrega_instalacion -> scheduled_delivery_date", () => {
    expect(resolveRelevantDueDate("recibido", dates)).toBe("2026-09-20");
    expect(resolveRelevantDueDate("programado_entrega_instalacion", dates)).toBe("2026-09-20");
  });

  it("completado / cancelado -> null (nunca vencido)", () => {
    expect(resolveRelevantDueDate("completado", dates)).toBeNull();
    expect(resolveRelevantDueDate("cancelado", dates)).toBeNull();
  });

  it("pedido / en_proceso -> null (solo antigüedad de Fase 6J, sin vencimiento por fecha)", () => {
    expect(resolveRelevantDueDate("pedido", dates)).toBeNull();
    expect(resolveRelevantDueDate("en_proceso", dates)).toBeNull();
  });

  it("nunca inventa una fecha que no fue capturada", () => {
    expect(
      resolveRelevantDueDate("en_transito", { ...dates, estimatedReceptionDate: null })
    ).toBeNull();
  });
});

describe("operationalStatusRequiresDueDate", () => {
  it("pedido/en_proceso/completado/cancelado -> false", () => {
    expect(operationalStatusRequiresDueDate("pedido")).toBe(false);
    expect(operationalStatusRequiresDueDate("en_proceso")).toBe(false);
    expect(operationalStatusRequiresDueDate("completado")).toBe(false);
    expect(operationalStatusRequiresDueDate("cancelado")).toBe(false);
  });

  it("ordenado_a_proveedor/en_transito/recibido/programado_entrega_instalacion -> true", () => {
    expect(operationalStatusRequiresDueDate("ordenado_a_proveedor")).toBe(true);
    expect(operationalStatusRequiresDueDate("en_transito")).toBe(true);
    expect(operationalStatusRequiresDueDate("recibido")).toBe(true);
    expect(operationalStatusRequiresDueDate("programado_entrega_instalacion")).toBe(true);
  });
});

describe("classifyDueDateStatus", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const noDates = { supplierCommitmentDate: null, estimatedReceptionDate: null, scheduledDeliveryDate: null };

  it("estado sin concepto de vencimiento (pedido/en_proceso/completado/cancelado) -> null, aunque haya fechas capturadas", () => {
    const dates = {
      supplierCommitmentDate: "2026-08-01",
      estimatedReceptionDate: "2026-08-01",
      scheduledDeliveryDate: "2026-08-01",
    };
    expect(classifyDueDateStatus("pedido", dates, now)).toBeNull();
    expect(classifyDueDateStatus("en_proceso", dates, now)).toBeNull();
    expect(classifyDueDateStatus("completado", dates, now)).toBeNull();
    expect(classifyDueDateStatus("cancelado", dates, now)).toBeNull();
  });

  it("estado que requiere fecha pero no está capturada -> sin_fecha (nunca 'en_tiempo' artificial)", () => {
    expect(classifyDueDateStatus("en_transito", noDates, now)).toBe("sin_fecha");
    expect(classifyDueDateStatus("recibido", noDates, now)).toBe("sin_fecha");
  });

  it("fecha ya pasada -> vencido", () => {
    expect(classifyDueDateStatus("en_transito", { ...noDates, estimatedReceptionDate: "2026-08-30" }, now)).toBe("vencido");
  });

  it("vence hoy -> proximo_a_vencer", () => {
    expect(classifyDueDateStatus("en_transito", { ...noDates, estimatedReceptionDate: "2026-09-01" }, now)).toBe(
      "proximo_a_vencer"
    );
  });

  it("vence dentro de 2 días -> proximo_a_vencer", () => {
    expect(classifyDueDateStatus("en_transito", { ...noDates, estimatedReceptionDate: "2026-09-03" }, now)).toBe(
      "proximo_a_vencer"
    );
  });

  it("vence en más de 2 días -> en_tiempo", () => {
    expect(classifyDueDateStatus("en_transito", { ...noDates, estimatedReceptionDate: "2026-09-04" }, now)).toBe(
      "en_tiempo"
    );
  });

  it("ordenado_a_proveedor usa el fallback dentro de la clasificación completa", () => {
    expect(
      classifyDueDateStatus(
        "ordenado_a_proveedor",
        { supplierCommitmentDate: null, estimatedReceptionDate: "2026-08-30", scheduledDeliveryDate: null },
        now
      )
    ).toBe("vencido");
  });
});
