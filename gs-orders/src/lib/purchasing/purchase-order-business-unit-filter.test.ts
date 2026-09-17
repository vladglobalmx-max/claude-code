import { describe, expect, it } from "vitest";
import { purchaseOrderMatchesBusinessUnit } from "./purchase-order-business-unit-filter";

const BU_JUNO = "bu-juno";
const BU_OTHER = "bu-otro";

describe("purchaseOrderMatchesBusinessUnit (fix de cierre 0081 — filtro BU en /compras)", () => {
  it("encuentra una OC directa (origin='directa') vía purchase_orders.business_unit_id, sin Pedido de origen", () => {
    const po = { business_unit_id: BU_JUNO, order: null };
    expect(purchaseOrderMatchesBusinessUnit(po, BU_JUNO)).toBe(true);
    expect(purchaseOrderMatchesBusinessUnit(po, BU_OTHER)).toBe(false);
  });

  it(
    "encuentra una OC de requisición vía purchase_orders.business_unit_id cuando está poblado — el filtro es " +
      "genérico por columna, no por origin (hoy rpc_convert_requisition_to_purchase_order NUNCA la puebla, ver reporte; " +
      "esta prueba protege que el filtro no dependa de ese detalle)",
    () => {
      const po = { business_unit_id: BU_JUNO, order: null };
      expect(purchaseOrderMatchesBusinessUnit(po, BU_JUNO)).toBe(true);
    }
  );

  it("una OC de requisición SIN business_unit_id propio (el caso real hoy) nunca hace match — no hay BU que comparar", () => {
    const po = { business_unit_id: null, order: null };
    expect(purchaseOrderMatchesBusinessUnit(po, BU_JUNO)).toBe(false);
  });

  it("sigue encontrando una OC de Pedido legado (origin='pedido') vía orders.business_unit_id, aunque purchase_orders.business_unit_id sea null", () => {
    const po = { business_unit_id: null, order: { business_unit_id: BU_JUNO } };
    expect(purchaseOrderMatchesBusinessUnit(po, BU_JUNO)).toBe(true);
    expect(purchaseOrderMatchesBusinessUnit(po, BU_OTHER)).toBe(false);
  });

  it("no encuentra una OC de Pedido legado de otra Business Unit", () => {
    const po = { business_unit_id: null, order: { business_unit_id: BU_OTHER } };
    expect(purchaseOrderMatchesBusinessUnit(po, BU_JUNO)).toBe(false);
  });

  it("purchase_orders.business_unit_id tiene prioridad si por alguna razón ambas fuentes están pobladas y coinciden con la BU buscada", () => {
    const po = { business_unit_id: BU_JUNO, order: { business_unit_id: BU_JUNO } };
    expect(purchaseOrderMatchesBusinessUnit(po, BU_JUNO)).toBe(true);
  });
});
