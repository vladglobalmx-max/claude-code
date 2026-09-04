// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SetPasswordForm } from "./set-password-form";

/**
 * THÖREN — bug real de "/set-password aparece vacío" (Tenant B QA): los 3
 * estados de este componente (checking/invalid/ready) SIEMPRE deben
 * renderizar contenido visible — nunca null/vacío. Estos tests fijan ese
 * contrato explícitamente, además de cubrir el checklist pedido
 * (a/b/c/d).
 */

const verifyOtp = vi.fn();
const updateUser = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { verifyOtp, updateUser },
  }),
}));

let mockSearchParams = new URLSearchParams();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

/** Contenido no-vacío real: al menos un texto o control interactivo visible. */
function expectNonEmptyRender(container: HTMLElement) {
  const hasText = (container.textContent ?? "").trim().length > 0;
  const hasControls = container.querySelectorAll("input, button").length > 0;
  expect(hasText || hasControls, "el card no debe quedar vacío").toBe(true);
}

describe("SetPasswordForm (THÖREN — fix bug /set-password vacío)", () => {
  it("a) estado inicial (checking) muestra 'Verificando enlace…' — nunca vacío", () => {
    mockSearchParams = new URLSearchParams({ token_hash: "tok", type: "invite" });
    // Promesa deliberadamente sin resolver todavía, para capturar el estado
    // "checking" en el primer render.
    verifyOtp.mockReturnValue(new Promise(() => {}));

    const { container } = render(<SetPasswordForm />);

    expect(screen.getByText("Verificando enlace…")).toBeTruthy();
    expectNonEmptyRender(container);
  });

  it("b) enlace sin token_hash/type reconocible -> estado inválido visible — nunca vacío", async () => {
    mockSearchParams = new URLSearchParams(); // sin token_hash ni type
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(<SetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText(/Este enlace no es válido o ya expiró/)).toBeTruthy();
    });
    expectNonEmptyRender(container);
    // Instrumentación mínima (punto 3 de la autorización): se loguea el
    // fallo con contexto, nunca con el token_hash real (no había ninguno
    // en este caso, pero tampoco se registra su valor cuando sí existe).
    expect(consoleError).toHaveBeenCalledWith(
      "[set-password] enlace sin token_hash/type reconocible",
      expect.objectContaining({ hasTokenHash: false })
    );
    expect(verifyOtp).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("b2) verifyOtp responde con error -> estado inválido visible, sin exponer detalle técnico al usuario", async () => {
    mockSearchParams = new URLSearchParams({ token_hash: "tok-expirado", type: "recovery" });
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: "Token expirado", code: "otp_expired" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText(/Este enlace no es válido o ya expiró/)).toBeTruthy();
    });
    // El mensaje visible NUNCA debe incluir "Token expirado" ni el código
    // técnico — eso solo va a console.error (Runtime Logs), no a la UI.
    expect(screen.queryByText(/Token expirado/)).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "[set-password] verifyOtp falló",
      expect.objectContaining({ message: "Token expirado", code: "otp_expired" })
    );

    consoleError.mockRestore();
  });

  it("b3) verifyOtp rechaza la promesa (excepción real) -> estado inválido visible, nunca colgado en 'checking' para siempre", async () => {
    mockSearchParams = new URLSearchParams({ token_hash: "tok", type: "invite" });
    verifyOtp.mockRejectedValue(new Error("Network request failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText(/Este enlace no es válido o ya expiró/)).toBeTruthy();
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[set-password] excepción inesperada verificando el enlace",
      expect.objectContaining({ message: "Network request failed" })
    );

    consoleError.mockRestore();
  });

  it("c) estado ready muestra ambos campos de contraseña y el botón de submit", async () => {
    mockSearchParams = new URLSearchParams({ token_hash: "tok-valido", type: "invite" });
    verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    const { container } = render(<SetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva contraseña")).toBeTruthy();
    });
    expect(screen.getByLabelText("Confirmar contraseña")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Guardar contraseña y entrar/ })).toBeTruthy();
    expectNonEmptyRender(container);
  });

  it("d) los 3 estados conocidos (checking/invalid/ready) nunca renderizan un contenedor vacío", async () => {
    // checking
    mockSearchParams = new URLSearchParams({ token_hash: "tok", type: "invite" });
    verifyOtp.mockReturnValue(new Promise(() => {}));
    const checking = render(<SetPasswordForm />);
    expectNonEmptyRender(checking.container);
    checking.unmount();

    // invalid
    mockSearchParams = new URLSearchParams();
    const invalid = render(<SetPasswordForm />);
    await waitFor(() => expectNonEmptyRender(invalid.container));
    invalid.unmount();

    // ready
    mockSearchParams = new URLSearchParams({ token_hash: "tok-valido", type: "recovery" });
    verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
    const ready = render(<SetPasswordForm />);
    await waitFor(() => expectNonEmptyRender(ready.container));
  });
});
