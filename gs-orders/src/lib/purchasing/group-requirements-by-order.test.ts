import { describe, expect, it } from "vitest";
import { groupRequirementsByOrder, describeMultiplePoCreation, type RequirementSelection } from "./group-requirements-by-order";

function selection(overrides: Partial<RequirementSelection> = {}): RequirementSelection {
  return {
    requirementId: "req-1",
    orderId: "order-1",
    orderItemId: "item-1",
    quantity: 1,
    ...overrides,
  };
}

describe("groupRequirementsByOrder (THÖREN Fase 9 / Block 1 — limitación de una PO por Pedido)", () => {
  it("agrupa varias necesidades del MISMO Pedido en un solo grupo", () => {
    const groups = groupRequirementsByOrder([
      selection({ requirementId: "req-1", orderId: "order-A" }),
      selection({ requirementId: "req-2", orderId: "order-A" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.orderId).toBe("order-A");
    expect(groups[0]?.selections).toHaveLength(2);
  });

  it("separa necesidades de Pedidos distintos en grupos distintos, en el orden en que aparecen", () => {
    const groups = groupRequirementsByOrder([
      selection({ requirementId: "req-1", orderId: "order-B" }),
      selection({ requirementId: "req-2", orderId: "order-A" }),
      selection({ requirementId: "req-3", orderId: "order-B" }),
    ]);
    expect(groups.map((g) => g.orderId)).toEqual(["order-B", "order-A"]);
    expect(groups.find((g) => g.orderId === "order-B")!.selections).toHaveLength(2);
    expect(groups.find((g) => g.orderId === "order-A")!.selections).toHaveLength(1);
  });

  it("arreglo vacío produce cero grupos", () => {
    expect(groupRequirementsByOrder([])).toEqual([]);
  });
});

describe("describeMultiplePoCreation", () => {
  it("no advierte nada cuando todo cabe en una sola PO", () => {
    expect(describeMultiplePoCreation(1)).toBeNull();
    expect(describeMultiplePoCreation(0)).toBeNull();
  });

  it("informa explícitamente cuántas PO se van a crear, sin ocultar la limitación", () => {
    expect(describeMultiplePoCreation(2)).toBe(
      "Se crearán 2 Purchase Orders porque actualmente cada PO pertenece a un solo Pedido."
    );
    expect(describeMultiplePoCreation(3)).toContain("3 Purchase Orders");
  });
});
