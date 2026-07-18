# ADR-0011 — Asset Library

## Problema
EPIC 1 (Sticker Creation Experience) resolvió "agregar imágenes" con un hack documentado como deuda técnica: el binario de cada imagen se embebía como data URL directamente en `customProperties` de cada `ImageObject`, sin ningún registro real ni posibilidad de reutilización. Esta épica reemplaza ese mecanismo por una Asset Library real — pero con un requisito explícito adicional del usuario: que nazca como la **Asset Library oficial de Impulso Platform**, con un modelo y una API que admitan naturalmente futuros tipos de Asset (fuentes, plantillas, íconos, patrones, fondos, texturas, marcos, mockups, assets generados por IA...) sin rediseñarla, aunque esta versión solo implemente imágenes (PNG/SVG).

## Contexto
- `AssetSchema` ya existía en `@impulso/document-schema` desde Foundation 1 (un objeto plano con `type: "image"|"font"` y una validación `superRefine` por tipo) pero estaba completamente huérfano: ningún campo de `Document`/`Project` lo referenciaba, y solo `ImageObject.assetId` apuntaba a un id sin registro real detrás.
- `@impulso/engine` es deliberadamente DOM-free (sin `lib: "DOM"`) — cualquier acceso a IndexedDB no puede vivir ahí.
- El comentario original de `asset.ts` (desde antes de esta épica) ya establecía el principio correcto: "un Asset es una REFERENCIA a un recurso, no el recurso en sí — los bytes reales viven donde el Engine decida almacenarlos, fuera de este paquete".
- El usuario elevó "priorizar reutilización sobre soluciones específicas del módulo" a regla permanente del proyecto en esta misma conversación — justo antes de encargar esta épica.
- `Asset Library` ya estaba nombrada explícitamente como uno de los pilares de la plataforma en `docs/product/03-Architecture-Map.md`, a diferencia de `Persistence` (ADR-0009), que nunca tuvo ese estatus y por eso se mantuvo como módulo de aplicación.

## Alternativas evaluadas

### Modelo de datos: ¿esquema plano con `superRefine`, o unión discriminada?
- *Mantener `AssetSchema` como objeto plano con campos opcionales por tipo + `superRefine`* (la forma original): no escala — cada tipo nuevo agrega otra rama a un único `superRefine` monolítico, y TypeScript no puede discriminar qué campos son válidos para cada `type` sin asertos manuales.
- *Unión discriminada (`AssetBaseSchema` + una variante por tipo concreto, mismo patrón que `SceneObject`)*: **elegida**. Ya es el patrón probado del Document Schema (Rectangle/Ellipse/Path/Image/Text/Group) — agregar un tipo de Asset nuevo es agregar un archivo `xxx.ts` que extiende `AssetBaseSchema` y sumarlo a la unión en `asset.ts`; ningún otro consumidor necesita cambiar. Sin recursión (a diferencia de `SceneObject`/`GroupObject`), así que se usa `z.discriminatedUnion` directamente (mensajes de error más precisos que `z.union`).
- Se agregó `pluginData`/`customProperties` a `AssetBaseSchema` (que el `Asset` original no tenía) — mismo principio ya aplicado a Project/Document/Page/Layer/Object: un lugar reservado para lo que un tipo futuro necesite, sin otro cambio de esquema.
- **No se pre-declararon variantes para los 9 tipos futuros mencionados** (plantillas, íconos, patrones...). Habría sido especular sobre necesidades hipotéticas (en contra del principio de simplicidad del proyecto) — el usuario mismo aclaró "no es necesario implementarlos todavía". Lo que sí se garantiza es que agregarlos después es mecánico: una variante más de la unión, sin tocar Document Schema, Engine, ni el paquete de la Biblioteca.

### ¿Dónde vive el registro de descriptores (`Asset[]`)?
`Document` gana un campo `assets: z.array(AssetSchema).default([])`, paralelo a `pages`/`history` — es contenido versionado/deshacible del documento, no metadata de sesión. Aditivo: `.default([])` resuelve documentos guardados antes de que este campo existiera sin ninguna migración de `schemaVersion` (confirmado: `Asset` nunca se persistió realmente antes de esta épica, así que no hay riesgo de incompatibilidad con datos reales).

### ¿Dónde vive el binario real?
- *Seguir embebiendo como data URL en el documento* (statu quo de EPIC 1): descartado — es precisamente la deuda técnica que esta épica cierra (crecimiento sin límite del `Project` guardado en `localStorage`, ver `PERFORMANCE_BUDGET.md` fila 11).
- *IndexedDB*: **elegida** — sin el límite de ~5-10MB de `localStorage`, ya anticipada como la elección correcta desde `docs/ARCHITECTURE.md` (Fase 0). El `Project` serializado sigue siendo solo metadata liviana (los descriptores en `document.assets`); los blobs pesados quedan completamente fuera de él.
- *Vía la librería `idb`* (mencionada en `ARCHITECTURE.md`) *vs. IndexedDB nativo envuelto en Promises a mano*: se eligió lo segundo — el caso de uso (un único object store, get/set/delete/clear) no justifica una dependencia externa; son ~50 líneas de envoltura, ya testeadas contra `fake-indexeddb`.

### ¿El paquete de la Biblioteca duplica el registro de descriptores, o solo administra binarios?
- *Un `AssetLibrary` con su propio registro interno de descriptores además del binario*: descartado — duplicaría el estado ya versionado en `document.assets` (dos fuentes de verdad a sincronizar, exactamente lo que "mantener la arquitectura limpia" advierte evitar).
- *El paquete SOLO administra binarios (`AssetBinaryStore`: get/set/delete/clear por `AssetId`), y `document.assets` sigue siendo la única fuente de verdad de los descriptores*: **elegida**. `AssetBinaryStore` es 100% agnóstico al tipo de Asset — funciona igual para imágenes, fuentes, texturas o cualquier tipo futuro, porque todos son en última instancia un `Blob` identificado por su id.
- La *ingesta* (cómo se construye un Asset+Blob a partir de una fuente externa) es deliberadamente un concepto separado y por tipo: `createImageAssetFromFile` es el único "ingestion helper" implementado — un futuro tipo (fuente, plantilla...) agrega el suyo propio sin tocar `AssetBinaryStore` ni el registro.

### ¿Paquete nuevo (`packages/asset-library`) o módulo de app?
ADR-0009 (Persistence) decidió NO crear un paquete porque no había un segundo consumidor real. El mismo argumento sigue siendo válido hoy (Sticker Builder sigue siendo el único módulo) — pero `Asset Library`, a diferencia de Persistence, ya está nombrada como pilar de la plataforma, y el usuario elevó "priorizar reutilización" a regla permanente. Se decidió construirla ya como `packages/asset-library`: interfaz pequeña (`AssetBinaryStore` + un ingestion helper), costo bajo de hacerlo bien desde el día uno, evita un refactor de extracción después.

## Decisión tomada
- **Document Schema**: `asset/base.ts` (`AssetBaseSchema`), `asset/image.ts` (`ImageAssetSchema`), `asset/font.ts` (`FontAssetSchema`, ya declarado desde antes, ahora extraído a su propio archivo), `asset/asset.ts` (`AssetSchema` = unión discriminada + `AssetTypeSchema` de conveniencia). `Document.assets: Asset[]`.
- **Engine**: 3 comandos nuevos (`addAsset`, `removeAsset`, `renameAsset`) operando sobre `document.assets`, genéricos sobre cualquier variante de `Asset`. `EntityRefSchema` gana el nivel `"asset"` para que `updateMetadata` (ya genérico) cubra tags/descripción de un Asset sin un comando dedicado.
- **`packages/asset-library`** (nuevo paquete): `AssetBinaryStore` (interfaz), `createIndexedDbAssetStore`/`createMemoryAssetStore` (dos implementaciones intercambiables, verificadas contra la MISMA suite de contrato), `createImageAssetFromFile` (único ingestion helper implementado).
- **`apps/sticker-builder`**: `assetResolution.ts` (`ResolvedAssetCache`, el puente sincrónico entre el `AssetBinaryStore` asíncrono y `resolveAssetSource` — sincrónico por contrato del Renderer desde Foundation 3), `legacyMigration.ts` (migra automáticamente, al "Abrir", cualquier proyecto guardado con el data URL embebido de EPIC 1 hacia el modelo real, y vuelve a guardar el resultado para no re-migrar en cada apertura), `assetsPanel.ts` (Sidebar izquierda, pestaña "Assets": grid, subir, insertar, eliminar), `tools.ts` extendido con `uploadAsset`/`insertImageFromAsset`.

## Consecuencias
- `@impulso/document-schema` 0.1.0 → 0.2.0, `@impulso/engine` 0.4.0 → 0.5.0, `@impulso/sticker-builder` 0.3.0 → 0.4.0. `@impulso/asset-library` nace en 0.1.0.
- El documento guardado en `localStorage` sigue siendo liviano sin importar cuántas imágenes tenga el proyecto — el crecimiento real vive en IndexedDB.
- Reabrir un proyecto guardado con el formato antiguo de EPIC 1 lo migra automáticamente y de forma transparente la primera vez, sin acción manual del usuario.
- Un futuro tipo de Asset (fuente, plantilla, ícono...) es: una variante nueva en `asset/`, opcionalmente un ingestion helper nuevo en `packages/asset-library/src/ingestion/`, y la UI que lo consuma — sin tocar `AssetBinaryStore`, sin tocar los comandos del Engine, sin tocar `Document.assets`.

## Riesgos
- **Sin deduplicación por contenido**: subir la misma imagen dos veces crea dos Assets y dos blobs independientes — aceptado como alcance de v1, documentado como deuda técnica.
- **`removeAsset` no valida si el Asset sigue en uso** por algún `ImageObject.assetId` — coherente con el resto del Engine (no valida referencias cruzadas en otros casos tampoco); el Renderer ya degrada correctamente a un placeholder ante un `assetId` sin resolver.
- **Sin compresión/optimización al subir** — el tamaño del archivo original se guarda tal cual.
- **`fake-indexeddb` no interopera perfectamente con el `Blob` de jsdom** (un Blob clonado a través de IndexedDB simulado pierde su prototipo real) — se resolvió testeando `indexedDbStore.ts` en un entorno `"node"` explícito (`// @vitest-environment node`), donde el `Blob` nativo sí sobrevive el roundtrip; verificado además con la app completa contra un build de producción real en Chromium.
- **Solo `image` está implementado**: `font` sigue siendo un tipo declarado sin ningún flujo real que lo produzca (deuda heredada, sin cambios en esta épica).

## Compatibilidad futura
Agregar cualquiera de los tipos mencionados por el usuario (fuentes, plantillas, íconos, patrones, fondos, texturas, marcos, mockups, assets de IA) sigue el mismo camino mecánico documentado arriba — ninguno de los tres niveles (Document Schema, Engine, `packages/asset-library`) necesita rediseñarse. Cuando exista un segundo módulo real de Impulso Platform, este paquete ya es directamente reutilizable sin ningún refactor de extracción (a diferencia de `persistence.ts`, que sigue viviendo en la app).
