// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DeletePurchaseOrderButton } from "./delete-button";

/**
 * THÖREN — Eliminación segura de Orden de Compra (0082). Fija el contrato
 * de la UI: requiere confirmación explícita (nunca borra de un solo
 * clic), llama a deletePurchaseOrder con el id correcto solo tras
 * confirmar, y mantiene el diálogo abierto (mostrando el error) si el
 * RPC lo rechaza — mismo criterio que PurchaseOrderStatusActions.
 */
const deletePurchaseOrder = vi.fn();
vi.mock("../actions", () => ({ deletePurchaseOrder: (...args: unknown[]) => deletePurchaseOrder(...args) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("DeletePurchaseOrderButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("no llama a deletePurchaseOrder hasta que se confirma explícitamente", () => {
    render(<DeletePurchaseOrderButton purchaseOrderId="po-1" folio="OC-20261709-002" />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Orden de Compra" }));

    expect(screen.getByText("¿Eliminar la Orden de Compra OC-20261709-002?")).toBeTruthy();
    expect(deletePurchaseOrder).not.toHaveBeenCalled();
  });

  it("'Volver' cierra el diálogo sin llamar a deletePurchaseOrder", () => {
    render(<DeletePurchaseOrderButton purchaseOrderId="po-1" folio="OC-20261709-002" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Orden de Compra" }));

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(deletePurchaseOrder).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Eliminar la Orden de Compra OC-20261709-002?")).toBeNull();
  });

  it("'Eliminar definitivamente' llama a deletePurchaseOrder con el id correcto", async () => {
    deletePurchaseOrder.mockResolvedValue(undefined);
    render(<DeletePurchaseOrderButton purchaseOrderId="po-real-id" folio="OC-20261709-002" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Orden de Compra" }));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    await vi.waitFor(() => expect(deletePurchaseOrder).toHaveBeenCalledWith("po-real-id"));
  });

  it("si el RPC rechaza (bloqueo de negocio), el diálogo permanece abierto mostrando el error", async () => {
    deletePurchaseOrder.mockResolvedValue({ error: "No se puede eliminar: tiene 1 recepción(es) de mercancía asociada(s)." });
    const { toast } = await import("sonner");
    render(<DeletePurchaseOrderButton purchaseOrderId="po-1" folio="OC-20261709-002" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Orden de Compra" }));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se puede eliminar: tiene 1 recepción(es) de mercancía asociada(s)."));
    expect(screen.getByText("¿Eliminar la Orden de Compra OC-20261709-002?")).toBeTruthy();
  });
});
