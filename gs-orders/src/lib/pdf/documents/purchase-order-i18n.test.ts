import { describe, expect, it } from "vitest";
import {
  purchaseOrderLabel,
  translatePurchaseOrderStatus,
  translatePurchaseOrderDateTime,
  LABELS_FOR_TESTING,
} from "./purchase-order-i18n";
import type { PurchaseOrderStatus } from "@/types/domain";

describe("purchaseOrderLabel (THÖREN — Orden de Compra Directa, PDF)", () => {
  it("en español devuelve exactamente el label existente del documento", () => {
    expect(purchaseOrderLabel("documentType", "es")).toBe("Orden de Compra");
    expect(purchaseOrderLabel("supplier", "es")).toBe("Proveedor");
    expect(purchaseOrderLabel("total", "es")).toBe("Total");
  });

  it("en inglés traduce todas las etiquetas fijas del documento", () => {
    expect(purchaseOrderLabel("documentType", "en")).toBe("Purchase Order");
    expect(purchaseOrderLabel("supplier", "en")).toBe("Supplier");
    expect(purchaseOrderLabel("date", "en")).toBe("Date");
    expect(purchaseOrderLabel("requiredDate", "en")).toBe("Required Date");
    expect(purchaseOrderLabel("quantity", "en")).toBe("Quantity");
    expect(purchaseOrderLabel("unit", "en")).toBe("Unit");
    expect(purchaseOrderLabel("description", "en")).toBe("Description");
    expect(purchaseOrderLabel("unitPrice", "en")).toBe("Unit Price");
    expect(purchaseOrderLabel("amount", "en")).toBe("Amount");
    expect(purchaseOrderLabel("subtotal", "en")).toBe("Subtotal");
    expect(purchaseOrderLabel("taxes", "en")).toBe("Taxes");
    expect(purchaseOrderLabel("total", "en")).toBe("Total");
    expect(purchaseOrderLabel("paymentTerms", "en")).toBe("Payment Terms");
    expect(purchaseOrderLabel("shipTo", "en")).toBe("Ship To");
    expect(purchaseOrderLabel("notes", "en")).toBe("Notes");
  });

  it("fix de cierre 0081 — cubre los 3 labels de secciones del layout compartido (Datos relacionados/Notas/Generado el)", () => {
    expect(purchaseOrderLabel("relatedData", "es")).toBe("Datos relacionados");
    expect(purchaseOrderLabel("relatedData", "en")).toBe("Related Information");
    expect(purchaseOrderLabel("notes", "es")).toBe("Notas");
    expect(purchaseOrderLabel("notes", "en")).toBe("Notes");
    expect(purchaseOrderLabel("generatedOn", "es")).toBe("Generado el");
    expect(purchaseOrderLabel("generatedOn", "en")).toBe("Generated on");
  });

  it("ninguna etiqueta queda vacía o sin par es/en", () => {
    for (const key of Object.keys(LABELS_FOR_TESTING) as (keyof typeof LABELS_FOR_TESTING)[]) {
      expect(LABELS_FOR_TESTING[key].es.length).toBeGreaterThan(0);
      expect(LABELS_FOR_TESTING[key].en.length).toBeGreaterThan(0);
    }
  });
});

describe("translatePurchaseOrderStatus", () => {
  it("en español devuelve el label ya existente tal cual (passthrough)", () => {
    expect(translatePurchaseOrderStatus("borrador", "es", "Borrador")).toBe("Borrador");
  });

  it("traduce los 7 valores del enum en inglés", () => {
    const cases: Array<[PurchaseOrderStatus, string]> = [
      ["borrador", "Draft"],
      ["ordenada", "Ordered"],
      ["confirmada", "Confirmed"],
      ["en_transito", "In transit"],
      ["recibida_parcial", "Partially received"],
      ["recibida", "Received"],
      ["cancelada", "Cancelled"],
    ];
    for (const [status, expected] of cases) {
      expect(translatePurchaseOrderStatus(status, "en", "irrelevante")).toBe(expected);
    }
  });
});

describe("translatePurchaseOrderDateTime (fix de cierre 0081 — 'Generado el' del footer)", () => {
  it("en español devuelve el formato ya existente tal cual (passthrough)", () => {
    expect(translatePurchaseOrderDateTime("2026-01-15T14:30:00Z", "es", "15 ene 2026, 14:30")).toBe("15 ene 2026, 14:30");
  });

  it("en inglés usa nombre de mes en inglés, nunca español", () => {
    const result = translatePurchaseOrderDateTime("2026-01-15T14:30:00Z", "en", "irrelevante");
    expect(result).not.toContain("ene");
    expect(result).toContain("Jan");
  });
});
