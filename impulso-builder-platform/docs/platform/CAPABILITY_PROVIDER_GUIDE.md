# Capability Provider Guide — `@impulso/capabilities` (Fase 4.2)

Cómo funciona la primera implementación real de `CapabilityProvider` (interfaz definida en Fase 4.1, `@impulso/commercial-schema`; implementación real construida en Fase 4.2).

## El contrato

```ts
interface CapabilityProvider {
  has(capabilityId: CapabilityId): CapabilityCheckResult;
}
// CapabilityCheckResult = { granted: boolean; reason: CapabilityCheckReason }
```

Puramente síncrono, sin I/O, sin red — una capability o se tiene o no se tiene, evaluada localmente contra el manifest ya cargado. No hay ningún escenario en V1 donde `has()` necesite esperar una respuesta de red (consistente con `licensingMode: "delivery-only"`, ADR-0028).

## Las tres piezas de `@impulso/capabilities`

1. **`createOpenCapabilityProvider()`** — concede TODO (`granted: true` para cualquier `capabilityId`, incluso uno no reconocido). Es el default seguro: úsalo cuando no hay manifest disponible (desarrollo local sin `commercial-product.json`, o un fallback ante un manifest corrupto) — la app nunca debe bloquear una función por un problema de infraestructura comercial, solo por una decisión de producto real.
2. **`createManifestCapabilityProvider(manifest)`** — concede exactamente las capabilities listadas en `manifest.capabilities` (`reason: "included"`), deniega el resto (`reason: "not-entitled"`). Este es el que efectivamente usa el build comercial real.
3. **`loadCapabilityProvider(rawManifest, options)`** — el punto de entrada que usa `apps/sticker-builder`. Intenta parsear `rawManifest` contra `@impulso/commercial-schema`; si es válido, devuelve un `createManifestCapabilityProvider` real; si no, aplica la política de `options.onInvalid`:
   - `"open-fallback"` (default) — nunca falla en silencio: devuelve un `createOpenCapabilityProvider()` PERO expone `diagnostics` con el detalle de qué falló, para que el llamador decida si lo registra (`console.warn`, como hace `commercialManifest.ts`) o lo ignora.
   - `"throw"` — lanza de inmediato. Pensado para herramientas de build que deben fallar duro ante un manifest roto (aunque hoy `validate-commercial-manifest.mjs` ya cubre ese caso de forma independiente, antes siquiera de intentar cargar un `CapabilityProvider`).

## Cómo se conecta hoy en `apps/sticker-builder`

`src/commercialManifest.ts` → `getCommercialManifest()` importa `commercial-product.json` de forma estática (embebido en el bundle en build-time, sin fetch en runtime), lo cachea, y si es inválido solo emite un `console.warn` con el diagnóstico — nunca bloquea el arranque de la app. El resultado se usa hoy principalmente para mostrar información honesta (branding, versión, canal, soporte) en el diálogo de bienvenida y el "Estado comercial" de la Workspace.

**Nota honesta sobre el estado actual (Fase 4.2):** ningún flujo del producto todavía hace un chequeo real de `capabilities.has(...)` para habilitar/deshabilitar una función de la UI — todas las funciones existentes (exportación rápida, exportación de producción, plantillas, etc.) están disponibles incondicionalmente hoy, independientemente del manifest. El `CapabilityProvider` real ya existe y está cableado, pero conectarlo a puntos de decisión concretos de la UI (mostrar/ocultar un botón según una capability ausente) es trabajo de una fase posterior, cuando exista una edición `"standard"` recortada que realmente necesite diferenciar. Ver Technical Debt.

## Cómo agregar un chequeo real de capability (para una fase futura)

```ts
import { loadCapabilityProvider } from "@impulso/capabilities";
import manifestJson from "../commercial-product.json";

const provider = loadCapabilityProvider(manifestJson, { onInvalid: "open-fallback" });
const result = provider.has("print.imposition");
if (!result.granted) {
  // ocultar/deshabilitar el control correspondiente, mostrando `result.reason`
  // de forma honesta si corresponde (nunca un error genérico).
}
```

## Cobertura de tests

11 tests, 100% cobertura — casos cubiertos: `createOpenCapabilityProvider` concede cualquier ID; `createManifestCapabilityProvider` concede solo lo listado y deniega con la razón correcta; `loadCapabilityProvider` con manifest válido, inválido + `"open-fallback"` (verifica `diagnostics`), e inválido + `"throw"`.
