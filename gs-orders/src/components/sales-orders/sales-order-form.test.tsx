// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SalesOrderForm } from "./sales-order-form";
import { emptySalesOrderForm } from "./types";
import type { Customer } from "@/types/domain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * THÖREN 0077 — bug reportado en Cloud: SO-20261509-004/005 se crearon con
 * el checkbox "Operación de prueba" marcado en la UI, pero quedaron con
 * is_test=false en la base. Estos tests fijan el contrato de serialización
 * completo (checkbox -> state -> payload que recibe onSubmit, exactamente
 * el mismo objeto que createSalesOrder reenvía a rpc_create_sales_order)
 * para que una regresión futura en esta capa quede detectada aquí, sin
 * depender de inspeccionar Cloud a mano.
 */

const customers: Customer[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    organization_id: "org-1",
    name: "Cliente Test",
    legal_name: null,
    tax_id: null,
    email: null,
    phone: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const salespeople = [{ id: "sp-1", name: "Vendedor Test" }];

function renderCreateForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const utils = render(
    <SalesOrderForm
      mode="create"
      salesOrderId="so-1"
      isAdmin={false}
      salespeople={salespeople}
      salespersonName="Vendedor Test"
      customers={customers}
      catalogProducts={[]}
      initialState={emptySalesOrderForm({ salespersonId: "sp-1" })}
      onSubmit={onSubmit}
    />
  );
  return { onSubmit, ...utils };
}

/** Llena los campos mínimos exigidos por handleSubmit antes de poder enviar (cliente + SKU de la línea 1 ya presente). */
function fillMinimumRequiredFields() {
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "11111111-1111-1111-1111-111111111111" } });
  fireEvent.change(screen.getByLabelText("SKU / referencia"), { target: { value: "SKU-TEST" } });
}

describe("SalesOrderForm — serialización de is_test (THÖREN 0077, fix bug Cloud)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("crear con el checkbox 'Operación de prueba' marcado -> onSubmit recibe is_test: true", async () => {
    const { onSubmit } = renderCreateForm();
    fillMinimumRequiredFields();

    fireEvent.click(screen.getByLabelText("Operación de prueba"));
    fireEvent.click(screen.getByRole("button", { name: "Crear Sales Order" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, payload] = onSubmit.mock.calls[0]!;
    expect(payload.is_test).toBe(true);
  });

  it("crear sin marcar el checkbox -> onSubmit recibe is_test: false", async () => {
    const { onSubmit } = renderCreateForm();
    fillMinimumRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Crear Sales Order" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, payload] = onSubmit.mock.calls[0]!;
    expect(payload.is_test).toBe(false);
  });

  it("marcar y luego desmarcar antes de enviar -> onSubmit recibe is_test: false (el último estado real del checkbox, no el primero)", async () => {
    const { onSubmit } = renderCreateForm();
    fillMinimumRequiredFields();

    const checkbox = screen.getByLabelText("Operación de prueba");
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Crear Sales Order" }));

    const [, payload] = onSubmit.mock.calls[0]!;
    expect(payload.is_test).toBe(false);
  });

  it("modo edit -> el checkbox 'Operación de prueba' no se renderiza (inmutable después de crear)", () => {
    render(
      <SalesOrderForm
        mode="edit"
        salesOrderId="so-1"
        orderNumber="SO-20261509-999"
        isAdmin={false}
        salespeople={salespeople}
        salespersonName="Vendedor Test"
        customers={customers}
        catalogProducts={[]}
        initialState={{ ...emptySalesOrderForm({ salespersonId: "sp-1" }), isTest: true }}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Operación de prueba")).toBeNull();
  });
});
