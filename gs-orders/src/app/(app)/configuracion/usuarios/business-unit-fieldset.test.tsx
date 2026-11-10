// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UserAccessForm } from "./user-form";
import type { UserAccessRow } from "@/types/domain";

// El react-dom instalado (18.3.1, paquete npm plano) no expone
// useFormState/useFormStatus a nivel de raíz — Next.js los resuelve en
// build/dev con su propio react-dom vendorizado (next/dist/compiled),
// invisible para Vitest/Node puro. Sin este shim, renderizar
// <UserAccessForm> truena antes de llegar a ninguna aserción — nada que
// ver con el bug que se investiga aquí.
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: (action: unknown, initialState: unknown) => [initialState, action],
    useFormStatus: () => ({ pending: false }),
  };
});

const resetUserPassword = vi.fn();
const createUserAccessLink = vi.fn();
const generatePasswordResetLink = vi.fn();
const updateUserDepartments = vi.fn(async (_userId: string, _departments: string[]) => ({ ok: true as const }));
const updateUserBusinessUnits = vi.fn(async (_userId: string, _businessUnitIds: string[]) => ({ ok: true as const }));

vi.mock("./actions", () => ({
  resetUserPassword: (email: string) => resetUserPassword(email),
  createUserAccessLink: (formData: FormData) => createUserAccessLink(formData),
  generatePasswordResetLink: (email: string) => generatePasswordResetLink(email),
  updateUserDepartments: (userId: string, departments: string[]) => updateUserDepartments(userId, departments),
  updateUserBusinessUnits: (userId: string, businessUnitIds: string[]) => updateUserBusinessUnits(userId, businessUnitIds),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const JUNO_ID = "d13e7b3d-be35-43ce-bb66-e3d8dfd3036d";
const OTRA_BU_ID = "11111111-1111-1111-1111-111111111111";

const testUser: UserAccessRow = {
  user_id: "user-contacto",
  email: "contacto@globalsupplier.com.mx",
  name: "Contacto Global Supplier",
  role: "vendedor",
  salesperson_id: "sp-ptg",
  salesperson_name: "Prueba THOREN Global Supplier",
  salesperson_prefix: "PTG",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
};

/**
 * THÖREN | CIERRE DEL DIAGNÓSTICO BUSINESS UNITS — reproduce la interacción
 * REAL que reportó el usuario: marcar el checkbox de "Juno Promotional" en
 * la pantalla de edición y hacer clic en "Guardar Business Units". Fija,
 * con un render real (React Testing Library, no inspección de texto), qué
 * llega exactamente a updateUserBusinessUnits — para confirmar o descartar
 * con evidencia (no con hipótesis) si el arreglo enviado es el correcto o
 * llega vacío/incompleto.
 */
describe("BusinessUnitAssignmentFieldset (vía UserAccessForm) — selección real de Juno Promotional", () => {
  it("al marcar Juno Promotional y hacer clic en Guardar Business Units, envía exactamente [JUNO_ID] — no un arreglo vacío", async () => {
    const mockFormAction = vi.fn(async () => undefined);

    render(
      <UserAccessForm
        action={mockFormAction}
        user={testUser}
        availableSalespeople={[]}
        submitLabel="Guardar cambios"
        canChooseRole={false}
        canManageBusinessUnits={true}
        assignedBusinessUnitIds={[]}
        availableBusinessUnits={[
          { id: JUNO_ID, name: "Juno Promotional" },
          { id: OTRA_BU_ID, name: "Otra Business Unit" },
        ]}
      />
    );

    const junoCheckbox = screen.getByLabelText("Juno Promotional") as HTMLInputElement;
    expect(junoCheckbox.checked).toBe(false);

    fireEvent.click(junoCheckbox);
    expect(junoCheckbox.checked).toBe(true);

    const guardarBuButton = screen.getByRole("button", { name: "Guardar Business Units" });
    fireEvent.click(guardarBuButton);

    await vi.waitFor(() => {
      expect(updateUserBusinessUnits).toHaveBeenCalledTimes(1);
    });

    expect(updateUserBusinessUnits).toHaveBeenCalledWith("user-contacto", [JUNO_ID]);

    // THÖREN | requisito 6 del ticket — ningún conflicto con el formulario
    // general: el botón "Guardar Business Units" (type="button", anidado
    // dentro del <form> principal) nunca debe disparar la Server Action
    // del formulario completo (updateUserAccess).
    expect(mockFormAction).not.toHaveBeenCalled();
  });

  it("marcar y luego desmarcar Juno Promotional antes de guardar envía un arreglo vacío — comportamiento esperado, no un bug", async () => {
    const mockFormAction = vi.fn(async () => undefined);

    render(
      <UserAccessForm
        action={mockFormAction}
        user={testUser}
        availableSalespeople={[]}
        submitLabel="Guardar cambios"
        canChooseRole={false}
        canManageBusinessUnits={true}
        assignedBusinessUnitIds={[]}
        availableBusinessUnits={[{ id: JUNO_ID, name: "Juno Promotional" }]}
      />
    );

    const junoCheckbox = screen.getByLabelText("Juno Promotional") as HTMLInputElement;
    fireEvent.click(junoCheckbox); // marcar
    fireEvent.click(junoCheckbox); // desmarcar — simula un doble-clic o un cambio de opinión real

    fireEvent.click(screen.getByRole("button", { name: "Guardar Business Units" }));

    await vi.waitFor(() => {
      expect(updateUserBusinessUnits).toHaveBeenCalledTimes(1);
    });

    expect(updateUserBusinessUnits).toHaveBeenCalledWith("user-contacto", []);
  });

  it("con una Business Unit ya asignada, el checkbox nace marcado y guardar sin tocar nada reenvía esa misma asignación (nunca la vacía por accidente)", async () => {
    const mockFormAction = vi.fn(async () => undefined);

    render(
      <UserAccessForm
        action={mockFormAction}
        user={testUser}
        availableSalespeople={[]}
        submitLabel="Guardar cambios"
        canChooseRole={false}
        canManageBusinessUnits={true}
        assignedBusinessUnitIds={[JUNO_ID]}
        availableBusinessUnits={[{ id: JUNO_ID, name: "Juno Promotional" }]}
      />
    );

    const junoCheckbox = screen.getByLabelText("Juno Promotional") as HTMLInputElement;
    expect(junoCheckbox.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Guardar Business Units" }));

    await vi.waitFor(() => {
      expect(updateUserBusinessUnits).toHaveBeenCalledTimes(1);
    });

    expect(updateUserBusinessUnits).toHaveBeenCalledWith("user-contacto", [JUNO_ID]);
  });
});
