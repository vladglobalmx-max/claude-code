import { describe, expect, it } from "vitest";
import { getMissingProjectorFields, type OrderPayload } from "./order";

function basePayload(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    order_date: "2026-08-11",
    salesperson_id: "11111111-1111-1111-1111-111111111111",
    client_name: "Cliente de prueba",
    supplier_name: "Proveedor de prueba",
    product_type: "proyector_gobo",
    status: "pedido",
    items: [{ model: "XYZ-100", quantity: 1 }],
    images: [],
    files: [],
    projector: {
      model: "XYZ-100",
      quantity: 2,
      description: "STOP",
      file: { path: "orders/1/proyeccion/a.png", name: "a.png", type: "image/png" },
      width: 1.1,
      height: 5,
      size_unit: "m",
      installation_height: 11.5,
      installation_height_unit: "m",
    },
    ...overrides,
  };
}

describe("getMissingProjectorFields", () => {
  it("no exige nada si el tipo de producto no es proyector/gobo", () => {
    const payload = basePayload({ product_type: "luminaria", projector: null });
    expect(getMissingProjectorFields(payload)).toEqual([]);
  });

  it("no exige nada mientras el pedido se guarda como borrador", () => {
    const payload = basePayload({ status: "borrador", projector: null });
    expect(getMissingProjectorFields(payload)).toEqual([]);
  });

  it("no exige nada cuando un proyector/gobo completo pasa a Pedido", () => {
    expect(getMissingProjectorFields(basePayload())).toEqual([]);
  });

  it("exige proveedor, modelo, imagen y medidas cuando faltan al pasar a Pedido", () => {
    const payload = basePayload({
      supplier_name: undefined,
      projector: {
        model: undefined,
        quantity: undefined,
        description: undefined,
        file: null,
        width: undefined,
        height: undefined,
        installation_height: undefined,
      },
    });

    const missing = getMissingProjectorFields(payload);

    expect(missing).toContain("Proveedor");
    expect(missing).toContain("Modelo del proyector");
    expect(missing).toContain("Cantidad");
    expect(missing).toContain("Descripción de qué se proyectará");
    expect(missing).toContain("Imagen o archivo a proyectar");
    expect(missing).toContain("Altura de instalación");
    expect(missing).toContain("Ancho de proyección");
    expect(missing).toContain("Alto de proyección");
  });

  it("no marca cantidad como faltante si es 0 o negativa solo por estar presente", () => {
    const payload = basePayload({ projector: { ...basePayload().projector, quantity: 0 } });
    expect(getMissingProjectorFields(payload)).toContain("Cantidad");
  });
});
