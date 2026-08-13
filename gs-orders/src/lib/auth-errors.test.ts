import { describe, expect, it } from "vitest";
import { mapAuthError } from "./auth-errors";

describe("mapAuthError", () => {
  it("CASO 10: correo ya registrado -> mensaje claro y distinguible", () => {
    expect(mapAuthError({ message: "Email address already registered", status: 422 })).toBe(
      "Ya existe un usuario con ese correo."
    );
    expect(mapAuthError({ message: "User already exists", status: 422 })).toBe("Ya existe un usuario con ese correo.");
  });

  it("CASO 5: rate limit (429) -> mensaje específico sugiriendo generar enlace", () => {
    expect(mapAuthError({ message: "Request failed", status: 429 })).toBe(
      "Se alcanzó temporalmente el límite de envío de invitaciones. Intenta más tarde o genera un enlace de acceso."
    );
  });

  it("rate limit detectado por texto aunque el status no sea 429", () => {
    expect(mapAuthError({ message: "email rate limit exceeded", status: 500 })).toBe(
      "Se alcanzó temporalmente el límite de envío de invitaciones. Intenta más tarde o genera un enlace de acceso."
    );
  });

  it("falla de envío/SMTP -> mensaje distinto al de rate limit", () => {
    expect(mapAuthError({ message: "Error sending invite email", status: 500 })).toBe(
      "No se pudo enviar el correo de invitación. Intenta más tarde o genera un enlace de acceso."
    );
  });

  it("redirect URL no permitida -> mensaje de configuración", () => {
    expect(mapAuthError({ message: "Redirect URL not allowed", status: 400 })).toBe(
      "La configuración de redirección no es válida. Contacta al administrador del sistema."
    );
  });

  it("error desconocido de Supabase -> mensaje genérico de fallback", () => {
    expect(mapAuthError({ message: "Unexpected failure XYZ", status: 500 })).toBe(
      "No se pudo crear el usuario. Intenta de nuevo."
    );
  });

  it("sin error -> mensaje genérico de fallback", () => {
    expect(mapAuthError(null)).toBe("No se pudo crear el usuario. Intenta de nuevo.");
    expect(mapAuthError(undefined)).toBe("No se pudo crear el usuario. Intenta de nuevo.");
  });
});
