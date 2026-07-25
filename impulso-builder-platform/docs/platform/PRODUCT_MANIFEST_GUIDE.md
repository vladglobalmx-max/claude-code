# Product Manifest Guide — `commercial-product.json` (Fase 4.2)

Cómo leer y modificar el manifest real de Impulso Sticker Builder. Para el contrato formal (Zod) ver `packages/commercial-schema/src/productManifest.ts`; para la decisión arquitectónica original, ADR-0027 (y su enmienda de Fase 4.2).

## Ubicación

`apps/sticker-builder/commercial-product.json` — un único archivo, checked-in, es la fuente de verdad para: qué capabilities tiene esta edición del producto, cómo se llama, a qué canal pertenece, y dónde están sus documentos legales.

## Campos y su propósito

| Campo | Ejemplo real | Propósito |
|---|---|---|
| `schemaVersion` | `1` | Versión del *formato* del manifest (no del producto) — solo sube si el schema cambia de forma incompatible. |
| `productId` | `"impulso-sticker-builder"` | Identificador estable del producto, nunca cambia entre versiones. |
| `slug` | `"sticker-builder"` | Identificador corto para URLs/nombres de archivo. |
| `productVersion` | `"1.0.0"` | Versión semántica del *producto comercial* (independiente del `version` de `package.json` del monorepo). |
| `edition` | `"professional"` | Ver sección "Standard vs Professional" abajo. |
| `modules` | `["sticker-builder"]` | Qué módulos del monorepo entrega este producto — hoy uno solo; el campo ya soporta bundles futuros. |
| `capabilities` | `["sticker.core", "print.pdf", ...]` | La lista real de capabilities que `CapabilityProvider` concederá — ver `CAPABILITY_PROVIDER_GUIDE.md`. |
| `branding.displayName`/`shortName` | `"Impulso Sticker Builder Professional"` | Usado en el título del diálogo de bienvenida y el "Estado comercial" en la app. |
| `support.email` | `"soporte@bookfluence.shop"` | Único canal de soporte en V1 — mostrado en la bienvenida y en la documentación del comprador. |
| `updateChannel` | `"stable"` | Reservado para cuando exista más de un canal de actualización (beta/stable) — hoy siempre `"stable"`. |
| `licensingMode` | `"delivery-only"` | Ver ADR-0028 — sin activación, sin validación online, sin cuenta técnica en V1. |
| `channel` | `"gumroad"` | Por dónde se distribuye *este build concreto* (distinto del array `channels` de `CommercialProduct`, que es más general). |
| `legal.*Path` | `"legal/LICENCIA-DE-USO.md"` | Rutas **relativas dentro del paquete de entrega** — nunca URLs externas obligatorias, para que los documentos legales viajen siempre junto al producto, incluso sin internet. |
| `buildMetadata.*` | `null` en el repo | Se rellena SOLO al empaquetar (`build:commercial`), nunca a mano — ver `COMMERCIAL_BUILD_GUIDE.md`. |
| `releaseMetadata.releaseNotesPath` | `"docs/NOTAS-DE-VERSION.md"` | Ruta relativa dentro del paquete a las notas de versión reales. |

## Standard vs Professional — la decisión ya tomada

V1 se lanza directamente como **`edition: "professional"`**, con la lista completa de capabilities de impresión (`print.professional`, `print.pdf`, `print.imposition`, `print.cut-paths`, `print.crop-marks`, `print.preflight`). No existe todavía una edición `"standard"` recortada (sin exportación de producción) — introducirla es straightforward en el modelo (una segunda instancia de manifest con menos capabilities) pero se decidió no fragmentar la oferta en la primera venta real, para no dividir la atención de marketing/soporte antes de tener evidencia de demanda diferenciada. Ver `V1_COMMERCIAL_RECOMMENDATION.md` para el análisis completo.

## Cómo modificar el manifest de forma segura

1. Editar `commercial-product.json` directamente.
2. Correr `pnpm validate:manifest` (o dejar que `pnpm build:commercial` lo haga por ti) — cualquier error de schema se lista con su `path` exacto.
3. Si agregaste/quitaste una capability, confirmar que el código que la usa (`getCapabilityProvider()`/chequeos de `capabilities.has(...)`) está alineado — el manifest es la fuente de verdad, pero nada evita hoy un desalineamiento manual entre "lo que el manifest promete" y "lo que el código realmente hace" (riesgo documentado en Technical Debt).
4. Nunca editar `buildMetadata`/`releaseMetadata.releaseDate` a mano — se sobrescriben en cada `build:commercial`.

## Qué pasa si el manifest es inválido

- **En build-time** (`build:commercial`/`validate:manifest`): el proceso falla con exit code 1 y una lista de errores — nunca se genera un paquete con un manifest roto.
- **En runtime, solo en desarrollo local** (`commercialManifest.ts`): si el JSON import falla el parseo (no debería ocurrir si `validate:manifest` ya pasó, pero cubre el caso de edición manual sin correr el validador), cae a un manifest `null` con un `console.warn` — la app sigue funcionando (capabilities abiertas vía `createOpenCapabilityProvider()`), nunca se rompe silenciosamente ni bloquea el arranque. Este fallback **no existe** en el build comercial empaquetado — ahí un manifest inválido ya habría hecho fallar el paso 1 de `build:commercial`.
