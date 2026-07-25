import type {
  CapabilityCheckResult,
  CapabilityId,
  CapabilityProvider,
  ProductManifest,
} from "@impulso/commercial-schema";

/**
 * Provider por defecto — concede TODO. Es el default seguro exigido por
 * ADR-0026/CAPABILITY_MODEL.md: introducir el modelo de capabilities no
 * puede, por sí solo, bloquear a un usuario existente o nuevo mientras
 * exista un solo producto/edición real. Se usa (a) en desarrollo local sin
 * manifest servido, y (b) como fallback explícito y registrado si el
 * manifest resultara inválido en runtime a pesar de la validación
 * obligatoria de build-time (ver scripts/validate-commercial-manifest.mjs)
 * — nunca en silencio, siempre con un motivo diagnosticable.
 */
export function createOpenCapabilityProvider(): CapabilityProvider {
  return {
    has(_capabilityId: CapabilityId): CapabilityCheckResult {
      return { granted: true, reason: "included" };
    },
  };
}

/**
 * Provider real: concede exactamente las capabilities listadas en el
 * manifest ya validado — ni una más. Sin backend, sin llamadas remotas, sin
 * caché con expiración (el manifest es estático dentro del propio build).
 */
export function createManifestCapabilityProvider(manifest: ProductManifest): CapabilityProvider {
  const granted = new Set(manifest.capabilities);
  return {
    has(capabilityId: CapabilityId): CapabilityCheckResult {
      if (granted.has(capabilityId)) {
        return { granted: true, reason: "included" };
      }
      return { granted: false, reason: "not-entitled" };
    },
  };
}
