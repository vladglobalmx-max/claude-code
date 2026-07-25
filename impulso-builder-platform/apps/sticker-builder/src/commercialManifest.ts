import { loadCapabilityProvider, type CapabilityProviderLoadResult } from "@impulso/capabilities";
import commercialProductJson from "../commercial-product.json";

/**
 * Único punto de lectura del manifest comercial en toda la app (Fase 4.2).
 * Importado como dato estático de build (Vite lo embebe en el bundle) —
 * cero fetch, cero dependencia de red, funciona igual con o sin servidor.
 * El build comercial (ver Commercial Build Guide) valida este mismo
 * archivo con `pnpm validate:manifest` ANTES de construir — si llegó hasta
 * aquí en un build comercial real, ya se sabe válido; el fallback abierto de
 * `loadCapabilityProvider` es una red de seguridad, nunca la vía normal.
 */
let cached: CapabilityProviderLoadResult | null = null;

export function getCommercialManifest(): CapabilityProviderLoadResult {
  if (!cached) {
    cached = loadCapabilityProvider(commercialProductJson);
    if (cached.diagnostics.length > 0) {
      console.warn(
        "[commercial] commercial-product.json es inválido — cayendo a acceso abierto (sin gating). Diagnóstico:",
        cached.diagnostics,
      );
    }
  }
  return cached;
}
