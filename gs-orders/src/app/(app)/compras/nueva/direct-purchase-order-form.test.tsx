// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DirectPurchaseOrderForm } from "./direct-purchase-order-form";

/**
 * THÖREN — fix de bug: "Producto del catálogo (opcional)" en /compras/nueva
 * no mostraba todo el catálogo activo. La causa real era el LOADER
 * (page.tsx: select sin .range() sobre product_catalog, cortado en
 * silencio por PostgREST en max_rows=1,000 — ver fetchAllPages,
 * paginated-fetch.ts) — ya cubierto por el propio contrato de
 * fetchAllPages (paginated-fetch.test.ts). Estos tests fijan el contrato
 * de la CAPA QUE QUEDA EN EL CLIENTE una vez el loader entrega el catálogo
 * completo: que un producto "lejano" en la lista SIGUE siendo
 * seleccionable vía la búsqueda (nunca se trunca de nuevo aquí por el cap
 * de opciones renderizadas), que el filtro de Business Unit es aditivo (no
 * esconde nada hasta que se elige una BU), y que "Sin producto de
 * catálogo" se conserva.
 */

const businessUnits = [
  { id: "bu-1", name: "BU Uno" },
  { id: "bu-2", name: "BU Dos" },
];
const suppliers = [{ id: "sup-1", name: "Proveedor Uno" }];
const warehouses: { id: string; name: string }[] = [];

function makeProduct(overrides: Partial<{ id: string; sku: string; name: string; unit: string | null; model: string | null; brand: string | null; businessUnitIds: string[] }>) {
  return {
    id: overrides.id ?? "p-generic",
    sku: overrides.sku ?? "SKU-GEN",
    name: overrides.name ?? "Producto genérico",
    unit: overrides.unit ?? "pza",
    model: overrides.model ?? null,
    brand: overrides.brand ?? null,
    businessUnitIds: overrides.businessUnitIds ?? [],
  };
}

/** Simula un catálogo grande (> el cap de opciones renderizadas MAX_PRODUCT_OPTIONS=50) — el producto objetivo queda deliberadamente FUERA del bloque inicial. */
function buildLargeCatalog(targetOverrides: Partial<ReturnType<typeof makeProduct>>) {
  const filler = Array.from({ length: 120 }, (_, i) => makeProduct({ id: `filler-${i}`, sku: `AAA-${String(i).padStart(4, "0")}`, name: `Relleno ${i}` }));
  const target = makeProduct({ id: "target-1", sku: "ZZZ-9999", name: "Reflector especial Z", ...targetOverrides });
  return [...filler, target];
}

function renderForm(catalogProducts: ReturnType<typeof makeProduct>[], onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const utils = render(
    <DirectPurchaseOrderForm
      businessUnits={businessUnits}
      suppliers={suppliers}
      warehouses={warehouses}
      catalogProducts={catalogProducts}
      onSubmit={onSubmit}
    />
  );
  return { onSubmit, ...utils };
}

describe("DirectPurchaseOrderForm — selector de Producto del catálogo (fix bug 'catálogo incompleto')", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("un producto fuera del bloque inicial (más allá del cap de opciones renderizadas) aparece al buscarlo por nombre", () => {
    renderForm(buildLargeCatalog({}));

    const select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    expect(within(select).queryByText(/Reflector especial Z/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Buscar en catálogo (SKU, nombre o modelo)"), {
      target: { value: "reflector especial" },
    });

    expect(within(select).queryByText(/Reflector especial Z/)).not.toBeNull();
  });

  it("un producto fuera del bloque inicial también aparece al buscarlo por SKU", () => {
    renderForm(buildLargeCatalog({}));

    fireEvent.change(screen.getByLabelText("Buscar en catálogo (SKU, nombre o modelo)"), {
      target: { value: "ZZZ-9999" },
    });

    const select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    expect(within(select).queryByText(/ZZZ-9999/)).not.toBeNull();
  });

  it("un producto fuera del bloque inicial aparece al buscarlo por modelo", () => {
    renderForm(buildLargeCatalog({ model: "MOD-ESPECIAL-1" }));

    fireEvent.change(screen.getByLabelText("Buscar en catálogo (SKU, nombre o modelo)"), {
      target: { value: "mod-especial-1" },
    });

    const select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    expect(within(select).queryByText(/ZZZ-9999/)).not.toBeNull();
  });

  it("seleccionar el producto encontrado por búsqueda funciona (no solo se muestra, también se puede elegir)", () => {
    renderForm(buildLargeCatalog({}));

    fireEvent.change(screen.getByLabelText("Buscar en catálogo (SKU, nombre o modelo)"), {
      target: { value: "ZZZ-9999" },
    });
    const select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "target-1" } });

    expect(select.value).toBe("target-1");
    expect((screen.getByLabelText("Descripción") as HTMLInputElement).value).toBe("Reflector especial Z");
  });

  it("respeta la Business Unit seleccionada: un producto restringido a otra BU no aparece hasta elegir esa BU", () => {
    const products = [
      makeProduct({ id: "p-bu1", sku: "SKU-BU1", name: "Producto solo BU Uno", businessUnitIds: ["bu-1"] }),
      makeProduct({ id: "p-bu2", sku: "SKU-BU2", name: "Producto solo BU Dos", businessUnitIds: ["bu-2"] }),
      makeProduct({ id: "p-todas", sku: "SKU-TODAS", name: "Producto compartido", businessUnitIds: [] }),
    ];
    renderForm(products);

    // Sin BU elegida todavía: se ofrece el catálogo completo (nunca un subconjunto arbitrario).
    let select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    expect(within(select).queryByText(/Producto solo BU Uno/)).not.toBeNull();
    expect(within(select).queryByText(/Producto solo BU Dos/)).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Business Unit"), { target: { value: "bu-1" } });

    select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    expect(within(select).queryByText(/Producto solo BU Uno/)).not.toBeNull();
    expect(within(select).queryByText(/Producto compartido/)).not.toBeNull();
    expect(within(select).queryByText(/Producto solo BU Dos/)).toBeNull();
  });

  it("conserva la opción 'Sin producto de catálogo' aunque haya catálogo cargado", () => {
    renderForm(buildLargeCatalog({}));
    const select = screen.getByLabelText("Producto del catálogo (opcional)") as HTMLSelectElement;
    expect(within(select).queryByText("Sin producto de catálogo — servicio/refacción/muestra/otro")).not.toBeNull();
  });
});
