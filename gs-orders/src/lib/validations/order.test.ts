import { describe, expect, it } from "vitest";
import { getMissingProjectorFields, type OrderItemPayload, type OrderPayload } from "./order";

function baseItem(overrides: Partial<OrderItemPayload> = {}): OrderItemPayload {
  return {
    model: "TLL200",
    quantity: 2,
    projection_description: "STOP",
    projection_file_path: "orders/1/proyeccion/stop.png",
    projection_width: 4,
    projection_height: 4,
    projection_size_unit: "m",
    ...overrides,
  };
}

function basePayload(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    order_date: "2026-08-11",
    salesperson_id: "11111111-1111-1111-1111-111111111111",
    client_name: "Cliente de prueba",
    supplier_name: "Proveedor de prueba",
    product_type: "proyector_gobo",
    status: "pedido",
    items: [baseItem()],
    images: [],
    files: [],
    projector: {
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

  it("CASO A: un pedido con 1 producto y 1 imagen a proyectar completa no exige nada", () => {
    expect(getMissingProjectorFields(basePayload())).toEqual([]);
  });

  it("CASO B: 2 productos distintos, cada uno con su propia imagen a proyectar completa, no exige nada", () => {
    const payload = basePayload({
      items: [
        baseItem({ model: "TLL200", projection_file_path: "orders/1/proyeccion/stop.png" }),
        baseItem({ model: "TLL300", projection_file_path: "orders/1/proyeccion/logo.png", projection_width: 5, projection_height: 3 }),
      ],
    });
    expect(getMissingProjectorFields(payload)).toEqual([]);
  });

  it("CASO C: mismo modelo TLL200 en dos items con imágenes de proyección distintas no exige nada", () => {
    const payload = basePayload({
      items: [
        baseItem({ model: "TLL200", projection_file_path: "orders/1/proyeccion/stop.png" }),
        baseItem({ model: "TLL200", projection_file_path: "orders/1/proyeccion/pedestrian.png" }),
      ],
    });
    expect(getMissingProjectorFields(payload)).toEqual([]);
  });

  it("CASO D: un producto sin imagen a proyectar marca ese producto específico como incompleto", () => {
    const payload = basePayload({
      items: [
        baseItem({ model: "TLL200" }),
        baseItem({
          model: "TLL300",
          projection_description: undefined,
          projection_file_path: null,
          projection_width: undefined,
          projection_height: undefined,
        }),
      ],
    });

    const missing = getMissingProjectorFields(payload);

    expect(missing).toContain("Producto 2 (TLL300): Descripción de qué se proyectará");
    expect(missing).toContain("Producto 2 (TLL300): Imagen o archivo a proyectar");
    expect(missing).toContain("Producto 2 (TLL300): Ancho de proyección");
    expect(missing).toContain("Producto 2 (TLL300): Alto de proyección");
    // el producto 1, completo, no debe aparecer
    expect(missing.some((m) => m.startsWith("Producto 1"))).toBe(false);
  });

  it("exige proveedor y altura de instalación (nivel pedido) cuando faltan al pasar a Pedido", () => {
    const payload = basePayload({ supplier_name: undefined, projector: { installation_height: undefined } });

    const missing = getMissingProjectorFields(payload);

    expect(missing).toContain("Proveedor");
    expect(missing).toContain("Altura de instalación");
  });

  it("no marca cantidad como faltante por estar en 0 (la cantidad mínima ya la exige el schema base)", () => {
    const payload = basePayload({ items: [baseItem({ quantity: 0 })] });
    // getMissingProjectorFields no valida cantidad: ya es obligatoria (min 1) en orderItemSchema
    expect(getMissingProjectorFields(payload)).toEqual([]);
  });
});
