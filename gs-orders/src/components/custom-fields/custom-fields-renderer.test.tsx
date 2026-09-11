// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CustomFieldsRenderer, fieldRequirementSuffix } from "./custom-fields-renderer";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";

function makeDef(overrides: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    id: "def-1",
    organizationId: "org-1",
    businessUnitId: null,
    entityType: "order_item",
    key: "color",
    label: "Color",
    fieldType: "text",
    required: false,
    active: true,
    sortOrder: 0,
    placeholder: null,
    helpText: null,
    options: null,
    requiredBeforeOrder: false,
    requiredBeforeFulfillment: false,
    supplierLabel: null,
    productTypeId: null,
    ...overrides,
  };
}

describe("CustomFieldsRenderer (THÖREN 8B) — genérico, sin nombres de negocio hardcodeados", () => {
  it("no renderiza nada si no hay definiciones", () => {
    const { container } = render(
      <CustomFieldsRenderer definitions={[]} values={{}} idPrefix="p" onChange={() => {}} />
    );
    expect(container.textContent).toBe("");
  });

  it("renderiza un input de texto y dispara onChange con la key de la definición", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldsRenderer
        definitions={[makeDef({ key: "prioridad", label: "Prioridad" })]}
        values={{}}
        idPrefix="item-1"
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText("Prioridad (opcional)");
    fireEvent.change(input, { target: { value: "Alta" } });
    expect(onChange).toHaveBeenCalledWith("prioridad", "Alta");
  });

  it("renderiza un select con las opciones de la definición", () => {
    render(
      <CustomFieldsRenderer
        definitions={[makeDef({ fieldType: "select", key: "esquema", label: "Tipo de esquema", options: ["Comodato", "Venta"] })]}
        values={{}}
        idPrefix="item-1"
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("option", { name: "Comodato" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Venta" })).toBeTruthy();
  });

  it("renderiza una casilla marcada según `values` y dispara on/'' al cambiar", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldsRenderer
        definitions={[makeDef({ fieldType: "checkbox", key: "urgente", label: "Urgente" })]}
        values={{ urgente: "on" }}
        idPrefix="item-1"
        onChange={onChange}
      />
    );
    const checkbox = screen.getByLabelText("Urgente") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("urgente", "");
  });

  it("THÖREN 8C — renderiza un campo file/image con MultiFileField y dispara onUploadFile/onRemoveFile con la key de la definición", async () => {
    const onUploadFile = vi.fn().mockResolvedValue(undefined);
    const onRemoveFile = vi.fn();
    render(
      <CustomFieldsRenderer
        definitions={[makeDef({ fieldType: "file", key: "projection_images", label: "Imagen(es) a proyectar" })]}
        values={{}}
        idPrefix="item-1"
        onChange={() => {}}
        fileValues={{
          projection_images: [
            { key: "f1", path: "orders/1/a.png", name: "a.png", type: "image/png", size: 10, previewUrl: null },
          ],
        }}
        onUploadFile={onUploadFile}
        onRemoveFile={onRemoveFile}
      />
    );
    expect(screen.getByText("a.png")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Eliminar archivo"));
    expect(onRemoveFile).toHaveBeenCalledWith("projection_images", "f1");
  });

  it("no muestra ninguna etiqueta de Business Unit u organización — el componente es puramente genérico", () => {
    const { container } = render(
      <CustomFieldsRenderer
        definitions={[makeDef({ key: "color" }), makeDef({ id: "def-2", key: "tecnica", label: "Técnica de impresión" })]}
        values={{}}
        idPrefix="item-1"
        onChange={() => {}}
      />
    );
    expect(container.textContent).not.toMatch(/thunder|juno|got fresh breath|global supplier/i);
  });
});

describe("fieldRequirementSuffix (bug real: campo 'opcional' que bloqueaba Pedido)", () => {
  it("un campo required_before_order=true (required=false) NO se etiqueta como opcional — se comunica como requerido antes de Pedido", () => {
    const def = makeDef({ key: "projection_description", label: "¿Qué quiere proyectar el cliente?", required: false, requiredBeforeOrder: true });
    expect(fieldRequirementSuffix(def)).toBe(" (requerido antes de Pedido)");
    expect(fieldRequirementSuffix(def)).not.toMatch(/opcional/i);
  });

  it("un campo genuinamente opcional (required=false, requiredBeforeOrder=false) conserva el indicador (opcional)", () => {
    const def = makeDef({ required: false, requiredBeforeOrder: false });
    expect(fieldRequirementSuffix(def)).toBe(" (opcional)");
  });

  it("un campo required=true (obligatorio al capturar) no lleva sufijo, sin importar requiredBeforeOrder", () => {
    expect(fieldRequirementSuffix(makeDef({ required: true, requiredBeforeOrder: false }))).toBe("");
    expect(fieldRequirementSuffix(makeDef({ required: true, requiredBeforeOrder: true }))).toBe("");
  });

  it("genérico: funciona para cualquier key/label, no solo projection_description — sin hardcode vertical", () => {
    const def = makeDef({ key: "prioridad", label: "Prioridad", required: false, requiredBeforeOrder: true });
    expect(fieldRequirementSuffix(def)).toBe(" (requerido antes de Pedido)");
  });

  it("en el DOM: un campo required_before_order muestra el label correcto, nunca '(opcional)'", () => {
    const { container } = render(
      <CustomFieldsRenderer
        definitions={[
          makeDef({ key: "projection_description", label: "¿Qué quiere proyectar el cliente?", required: false, requiredBeforeOrder: true }),
        ]}
        values={{}}
        idPrefix="item-1"
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText("¿Qué quiere proyectar el cliente? (requerido antes de Pedido)")).toBeTruthy();
    expect(container.textContent).not.toMatch(/opcional/i);
  });
});
