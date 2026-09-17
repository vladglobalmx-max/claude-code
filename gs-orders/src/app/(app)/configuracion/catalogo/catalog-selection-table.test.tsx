// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CatalogSelectionTable, type CatalogRow } from "./catalog-selection-table";

/**
 * Ajuste de cierre — selección múltiple + eliminación (soft-delete) del
 * Catálogo. Fija el contrato de la UI: seleccionar uno/varios/todos los
 * visibles, y que "Eliminar del catálogo" solo se dispara tras confirmar
 * el diálogo, con el texto exacto pedido.
 */

const bulkDeactivateCatalogProducts = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), back: vi.fn() }),
}));

vi.mock("./actions", () => ({
  bulkDeactivateCatalogProducts: (...args: unknown[]) => bulkDeactivateCatalogProducts(...args),
}));

function buildProduct(overrides: Partial<CatalogRow>): CatalogRow {
  return {
    id: "p-1",
    sku: "SKU-1",
    name: "Producto 1",
    brand: null,
    model: null,
    unit: null,
    default_price_mxn: 100,
    default_price_usd: null,
    active: true,
    image_path: null,
    product_type_id: null,
    product_types: null,
    product_business_units: [],
    ...overrides,
  };
}

const products: CatalogRow[] = [
  buildProduct({ id: "p-1", sku: "SKU-1", name: "Producto 1" }),
  buildProduct({ id: "p-2", sku: "SKU-2", name: "Producto 2" }),
  buildProduct({ id: "p-3", sku: "SKU-3", name: "Producto 3" }),
];

function renderTable(rows: CatalogRow[] = products) {
  return render(<CatalogSelectionTable products={rows} businessUnits={[]} imageUrls={{}} />);
}

describe("CatalogSelectionTable (ajuste de cierre — selección múltiple / eliminar del catálogo)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("seleccionar uno muestra la barra de acción con el conteo correcto", () => {
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));

    expect(screen.getByText("1 producto seleccionado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Eliminar del catálogo (1)" })).toBeTruthy();
  });

  it("seleccionar varios acumula la selección y actualiza el conteo", () => {
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-3"));

    expect(screen.getByText("2 productos seleccionados")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Eliminar del catálogo (2)" })).toBeTruthy();
  });

  it("'Seleccionar todos los visibles' marca EXACTAMENTE los productos recibidos (nunca más)", () => {
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));

    expect(screen.getByText("3 productos seleccionados")).toBeTruthy();
    expect(screen.getByLabelText("Seleccionar SKU-1")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("Seleccionar SKU-2")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("Seleccionar SKU-3")).toHaveProperty("checked", true);

    // Desmarcar el encabezado quita exactamente esos mismos ids, no otros.
    fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
    expect(screen.queryByText(/seleccionado/)).toBeNull();
  });

  it("'Seleccionar todos los visibles' solo abarca lo que el padre le pasó como `products` (ya filtrado/buscado) — nunca 'todo el catálogo'", () => {
    // Simula que el server component ya filtró a 1 solo producto visible.
    renderTable([buildProduct({ id: "p-2", sku: "SKU-2", name: "Producto 2" })]);
    fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));

    expect(screen.getByText("1 producto seleccionado")).toBeTruthy();
  });

  it("Cancelar selección limpia la selección sin llamar al backend", () => {
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar selección" }));

    expect(screen.queryByText(/seleccionado/)).toBeNull();
    expect(bulkDeactivateCatalogProducts).not.toHaveBeenCalled();
  });

  it("clic en 'Eliminar del catálogo (N)' NO llama al backend todavía — primero exige confirmar en el diálogo", () => {
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar del catálogo (1)" }));

    expect(bulkDeactivateCatalogProducts).not.toHaveBeenCalled();
    expect(screen.getByText("¿Eliminar 1 producto del catálogo?")).toBeTruthy();
    expect(
      screen.getByText("Dejarán de estar disponibles para nuevas cotizaciones y operaciones. Los documentos históricos no se modificarán.")
    ).toBeTruthy();
  });

  it("confirmar en el diálogo llama a bulkDeactivateCatalogProducts con exactamente los ids seleccionados, limpia la selección y refresca", async () => {
    bulkDeactivateCatalogProducts.mockResolvedValue({ error: null, updatedCount: 2 });
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-2"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar del catálogo (2)" }));

    const confirmButtons = screen.getAllByRole("button", { name: "Eliminar del catálogo" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => expect(bulkDeactivateCatalogProducts).toHaveBeenCalledTimes(1));
    const [ids] = bulkDeactivateCatalogProducts.mock.calls[0]!;
    expect(new Set(ids)).toEqual(new Set(["p-1", "p-2"]));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/seleccionado/)).toBeNull());
  });

  it("Cancelar dentro del diálogo no llama al backend", () => {
    renderTable();
    fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar del catálogo (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(bulkDeactivateCatalogProducts).not.toHaveBeenCalled();
  });
});
