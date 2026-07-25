import { safeParseProductManifest, type CapabilityProvider, type ProductManifest } from "@impulso/commercial-schema";
import { createManifestCapabilityProvider, createOpenCapabilityProvider } from "./capabilityProvider.js";

export interface CapabilityProviderLoadResult {
  manifest: ProductManifest | null;
  provider: CapabilityProvider;
  /**
   * Vacío si el manifest es válido. Nunca silencioso: si el manifest fue
   * rechazado, el motivo queda aquí para que el llamador lo registre/muestre
   * — el fallback a "conceder todo" nunca oculta que algo salió mal (ver
   * ADR-0027, "Política de fallo del manifest").
   */
  diagnostics: string[];
}

/**
 * Único punto de entrada real para leer el manifest comercial y obtener un
 * CapabilityProvider. Sin backend, sin llamadas remotas — recibe el JSON ya
 * leído (import estático en build, o un objeto de prueba), nunca hace fetch
 * por su cuenta.
 *
 * onInvalid:
 * - "open-fallback" (default): un manifest inválido concede todo (mismo
 *   comportamiento que hoy sin ningún gating) — usado en desarrollo local y
 *   como red de seguridad en runtime si, a pesar de la validación
 *   obligatoria de build-time, el manifest embebido resultara inválido.
 * - "throw": para contextos que exigen fallo estricto (ej. herramientas de
 *   build) — nunca se usa dentro de la app en ejecución, para no romper el
 *   editor de un comprador real por un problema de metadata comercial.
 */
export function loadCapabilityProvider(
  rawManifest: unknown,
  options: { onInvalid?: "open-fallback" | "throw" } = {},
): CapabilityProviderLoadResult {
  const onInvalid = options.onInvalid ?? "open-fallback";
  const result = safeParseProductManifest(rawManifest);

  if (result.success) {
    return {
      manifest: result.data,
      provider: createManifestCapabilityProvider(result.data),
      diagnostics: [],
    };
  }

  const diagnostics = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
  );

  if (onInvalid === "throw") {
    throw new Error(`Manifest comercial inválido: ${diagnostics.join("; ")}`);
  }

  return { manifest: null, provider: createOpenCapabilityProvider(), diagnostics };
}
