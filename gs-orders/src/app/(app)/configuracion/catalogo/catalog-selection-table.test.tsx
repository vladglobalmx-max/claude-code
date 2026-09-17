// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CatalogSelectionTable, type CatalogRow } from "./catalog-selection-table";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}));

/**
 * Ajuste de cierre — selección múltiple + eliminación (soft-delete) del
 * Catálogo. Fija el contrato de la UI: seleccionar uno/varios/todos los
 * visibles, y que "Eliminar del catálogo" solo se dispara tras confirmar
 * el diálogo, con el texto exacto pedido.
 */

const bulkDeactivateCatalogProducts = vi.fn();
const bulkDeactivateAllMatchingCatalogProducts = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), back: vi.fn() }),
}));

vi.mock("./actions", () => ({
  bulkDeactivateCatalogProducts: (...args: unknown[]) => bulkDeactivateCatalogProducts(...args),
  bulkDeactivateAllMatchingCatalogProducts: (...args: unknown[]) => bulkDeactivateAllMatchingCatalogProducts(...args),
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

function defaultProps(rows: CatalogRow[]) {
  return {
    products: rows,
    businessUnits: [] as { id: string; name: string }[],
    imageUrls: {} as Record<string, string>,
    totalMatching: rows.length,
    canSelectAllMatching: false,
    filters: {} as { bu?: string; tipo?: string },
  };
}

function renderTable(rows: CatalogRow[] = products, overrides: Partial<ReturnType<typeof defaultProps>> = {}) {
  return render(<CatalogSelectionTable {...defaultProps(rows)} {...overrides} />);
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

  /**
   * Fix de bug de cierre — la selección se acumulaba entre páginas
   * (evidencia en producción: filtro BU, page=26, "1296 productos
   * seleccionados", Bad Request al confirmar). Next.js re-renderiza esta
   * MISMA instancia con un `products` prop distinto al navegar/filtrar —
   * nunca la desmonta — así que el fix depende de resetear `selected`
   * cuando cambia el CONJUNTO de ids visibles, no de un remount.
   */
  describe("fix — la selección nunca sobrevive a un cambio del conjunto `products`", () => {
    it("seleccionar todos en la página 1, luego recibir la página 2 -> selección queda en 0", () => {
      const page1 = products; // p-1, p-2, p-3
      const page2 = [
        buildProduct({ id: "p-4", sku: "SKU-4", name: "Producto 4" }),
        buildProduct({ id: "p-5", sku: "SKU-5", name: "Producto 5" }),
      ];
      const { rerender } = renderTable(page1);
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
      expect(screen.getByText("3 productos seleccionados")).toBeTruthy();

      rerender(<CatalogSelectionTable {...defaultProps(page2)} />);

      expect(screen.queryByText(/seleccionado/)).toBeNull();
      expect(screen.getByLabelText("Seleccionar SKU-4")).toHaveProperty("checked", false);
    });

    it("cambiar filtros (nuevo conjunto de productos, misma cantidad) -> selección limpia igual", () => {
      const filtroA = products; // p-1, p-2, p-3
      const filtroB = [
        buildProduct({ id: "p-9", sku: "SKU-9", name: "Producto 9" }),
        buildProduct({ id: "p-10", sku: "SKU-10", name: "Producto 10" }),
        buildProduct({ id: "p-11", sku: "SKU-11", name: "Producto 11" }),
      ];
      const { rerender } = renderTable(filtroA);
      fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
      fireEvent.click(screen.getByLabelText("Seleccionar SKU-2"));
      expect(screen.getByText("2 productos seleccionados")).toBeTruthy();

      rerender(<CatalogSelectionTable {...defaultProps(filtroB)} />);

      expect(screen.queryByText(/seleccionado/)).toBeNull();
    });

    it("re-render con el MISMO conjunto de ids (sin cambio real) NO borra una selección en curso", () => {
      const { rerender } = renderTable(products);
      fireEvent.click(screen.getByLabelText("Seleccionar SKU-1"));
      expect(screen.getByText("1 producto seleccionado")).toBeTruthy();

      // Mismo array de productos (misma referencia de contenido/ids) — un re-render normal, no una navegación real.
      rerender(<CatalogSelectionTable {...defaultProps(products)} />);

      expect(screen.getByText("1 producto seleccionado")).toBeTruthy();
    });

    it("'Seleccionar todos los visibles' nunca excede el tamaño de la página recibida, incluso con una página grande (50)", () => {
      const bigPage = Array.from({ length: 50 }, (_, i) => buildProduct({ id: `p-${i}`, sku: `SKU-${i}` }));
      renderTable(bigPage);
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));

      expect(screen.getByText("50 productos seleccionados")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Eliminar del catálogo (50)" })).toBeTruthy();
    });
  });

  /**
   * Ajuste operativo — "Seleccionar los N productos que coinciden con
   * estos filtros" (caso real: filtro BU Juno Promotional, ~1,296
   * resultados, 50 visibles por página). NUNCA guarda esos N ids en el
   * cliente — solo un booleano (`allMatchingSelected`) + los filtros
   * (bu/tipo) ya conocidos por page.tsx, y delega el conjunto completo al
   * RPC (0078) al confirmar.
   */
  describe("Seleccionar todos los que coinciden con los filtros (V1: BU/Tipo, sin q, sin estado inactivo/todos)", () => {
    const bigPage = Array.from({ length: 50 }, (_, i) => buildProduct({ id: `p-${i}`, sku: `SKU-${i}` }));

    it("página de 50 con total 1,296 y canSelectAllMatching -> tras seleccionar todos los visibles, aparece 'Seleccionar los 1,296…'", () => {
      renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: true, filters: { bu: "bu-juno" } });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));

      expect(screen.getByText("Seleccionar los 1296 productos que coinciden con estos filtros")).toBeTruthy();
    });

    it("no aparece si canSelectAllMatching=false (V1: estado != activo, o hay búsqueda `q`), aunque totalMatching > página", () => {
      renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: false });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));

      expect(screen.queryByText(/Seleccionar los 1296/)).toBeNull();
    });

    it("no aparece si totalMatching no excede lo ya visible (nada más que seleccionar)", () => {
      renderTable(bigPage, { totalMatching: 50, canSelectAllMatching: true });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));

      expect(screen.queryByText(/coinciden con estos filtros/)).toBeNull();
    });

    it("al hacer clic: modo allMatchingSelected -> muestra '1,296 productos seleccionados', NUNCA construye una lista de 1,296 ids", () => {
      renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: true, filters: { bu: "bu-juno" } });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
      fireEvent.click(screen.getByText("Seleccionar los 1296 productos que coinciden con estos filtros"));

      expect(screen.getByText("1296 productos seleccionados")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Eliminar del catálogo (1296)" })).toBeTruthy();
      // Las casillas de fila quedan deshabilitadas — no hay forma de acumular una lista de ids en este modo.
      expect(screen.getByLabelText("Seleccionar SKU-0")).toHaveProperty("disabled", true);
    });

    it("confirmar en este modo llama a bulkDeactivateAllMatchingCatalogProducts con los FILTROS (bu/tipo), nunca con una lista de ids", async () => {
      bulkDeactivateAllMatchingCatalogProducts.mockResolvedValue({ error: null, updatedCount: 1296 });
      renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: true, filters: { bu: "bu-juno", tipo: "tipo-proyector" } });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
      fireEvent.click(screen.getByText("Seleccionar los 1296 productos que coinciden con estos filtros"));
      fireEvent.click(screen.getByRole("button", { name: "Eliminar del catálogo (1296)" }));

      expect(screen.getByText("¿Eliminar 1296 productos del catálogo?")).toBeTruthy();

      const confirmButtons = screen.getAllByRole("button", { name: "Eliminar del catálogo" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

      await waitFor(() => expect(bulkDeactivateAllMatchingCatalogProducts).toHaveBeenCalledTimes(1));
      expect(bulkDeactivateAllMatchingCatalogProducts).toHaveBeenCalledWith({ bu: "bu-juno", tipo: "tipo-proyector" });
      expect(bulkDeactivateCatalogProducts).not.toHaveBeenCalled();

      await waitFor(() => expect(screen.queryByText(/seleccionado/)).toBeNull());
    });

    it("si el conteo real cambió, el toast final muestra el updatedCount devuelto por el RPC, no el conteo mostrado antes de confirmar", async () => {
      bulkDeactivateAllMatchingCatalogProducts.mockResolvedValue({ error: null, updatedCount: 1290 });
      renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: true, filters: { bu: "bu-juno" } });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
      fireEvent.click(screen.getByText("Seleccionar los 1296 productos que coinciden con estos filtros"));
      fireEvent.click(screen.getByRole("button", { name: "Eliminar del catálogo (1296)" }));
      const confirmButtons = screen.getAllByRole("button", { name: "Eliminar del catálogo" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("1290 productos eliminados del catálogo."));
    });

    it("Cancelar selección en este modo vuelve a 0 y no llama al backend", () => {
      renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: true, filters: { bu: "bu-juno" } });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
      fireEvent.click(screen.getByText("Seleccionar los 1296 productos que coinciden con estos filtros"));
      fireEvent.click(screen.getByRole("button", { name: "Cancelar selección" }));

      expect(screen.queryByText(/seleccionado/)).toBeNull();
      expect(screen.getByLabelText("Seleccionar todos los visibles")).toHaveProperty("checked", false);
      expect(bulkDeactivateAllMatchingCatalogProducts).not.toHaveBeenCalled();
    });

    it("cambiar de página/filtros (nuevo conjunto de products) sale del modo allMatchingSelected", () => {
      const { rerender } = renderTable(bigPage, { totalMatching: 1296, canSelectAllMatching: true, filters: { bu: "bu-juno" } });
      fireEvent.click(screen.getByLabelText("Seleccionar todos los visibles"));
      fireEvent.click(screen.getByText("Seleccionar los 1296 productos que coinciden con estos filtros"));
      expect(screen.getByText("1296 productos seleccionados")).toBeTruthy();

      const page2 = Array.from({ length: 50 }, (_, i) => buildProduct({ id: `p2-${i}`, sku: `SKU2-${i}` }));
      rerender(<CatalogSelectionTable {...defaultProps(page2)} totalMatching={1296} canSelectAllMatching filters={{ bu: "bu-juno" }} />);

      expect(screen.queryByText(/seleccionado/)).toBeNull();
      expect(screen.getByLabelText("Seleccionar SKU2-0")).toHaveProperty("disabled", false);
    });
  });
});
