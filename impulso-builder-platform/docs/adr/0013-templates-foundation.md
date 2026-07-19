# ADR-0013 — Templates Foundation

## Problema
Con Epic 3 completo, el flujo fundamental de Sticker Builder queda cerrado: Crear → Diseñar → Guardar → Abrir → Exportar. Pero "Crear" hoy solo ofrece tres tamaños de sticker fijos (`STICKER_SIZE_PRESETS`) o un lienzo personalizado — un concepto específico de Sticker Builder, sin ningún camino de reutilización por otros módulos, y sin forma de que un usuario guarde su propio punto de partida. Esta épica construye **Templates**, el pilar de plataforma que resuelve "cómo empieza un usuario un proyecto nuevo" de forma reutilizable por cualquier módulo (Planner Builder, Coloring Book Builder, Worksheet Builder, Flashcard Builder, Journal Builder, Mockup Builder, futuros módulos), reemplazando por completo el concepto de "preset" específico de un módulo.

## Contexto
- `docs/product/03-Architecture-Map.md` NO nombraba "Templates" como pilar planeado antes de esta épica — a diferencia de Asset Library y Export Engine, que ya aparecían como `⏳ planeado` desde el diseño original. Es un pilar genuinamente nuevo, no la ejecución de algo ya anticipado.
- `docs/ARCHITECTURE.md` línea 224 sí anticipaba, en el flujo conceptual de un módulo, "elegir plantilla o lienzo en blanco" — sin ningún diseño de cómo se implementaría.
- `apps/sticker-builder/src/projectPresets.ts`'s `STICKER_SIZE_PRESETS` (3 tamaños fijos: cuadrado 5×5, círculo 5×5, rectángulo 7×5) era el precedente más cercano a un "template": una lista curada de puntos de partida — pero modelada como datos primitivos (`{name, width, height, shape}`), no como un `Project` completo, y sin ningún mecanismo de guardado por el usuario.
- El usuario fue explícito: "No quiero mantener dos conceptos distintos ('Presets' y 'Templates')... Los tamaños actuales de Sticker deben convertirse en Templates built-in del sistema" — consolidación explícitamente aprobada (ver sección "Decisión confirmada con el usuario").
- `@impulso/asset-library` estableció el precedente arquitectónico de "descriptor liviano (siempre listable) + contenido pesado (cargado bajo demanda)" (`AssetDescriptor`/binario en IndexedDB) — el mismo patrón se reutiliza aquí para `TemplateDescriptor`/`TemplateContent`.

## Alternativas evaluadas

### ¿Qué ES un Template?
- **A. Un `Project` completo + metadatos de catálogo** (elegida): un Template representa un proyecto entero (`document`, `moduleId`, todo lo que un `Project` ya modela), envuelto en metadatos de catálogo (`name`, `description`, `tags`, `builtIn`, timestamps). Crear un proyecto nuevo desde un Template es clonar ese `Project` con ids frescos.
- **B. Un nuevo concepto en Document Schema** (ej. `TemplateDocument` con placeholders/reglas de sustitución): descartada — el encargo pide "un proyecto completo", no una plantilla paramétrica con huecos rellenables; introducir un tipo nuevo en Document Schema para esto habría sido complejidad sin necesidad real, y habría acoplado Document Schema (que hoy no sabe nada de "catálogo" o "plataforma") a un concepto de UX.
- **C. Una lista de fábricas de proyecto** (una función `() => Project` por template, código, no datos): descartada — no permite que un usuario cree sus propios templates (el encargo pide "Guardar como plantilla"), y no es serializable/almacenable.

**Decisión:** opción A. Consecuencia directa: **Document Schema no necesitó ningún cambio para esta épica** — `Project` ya era suficiente. Un Template es, literalmente, un `Project` guardado con metadatos adicionales.

### ¿Dónde vive el catálogo de Templates?
- **A. Un `TemplateStore` global, paralelo a `AssetBinaryStore`** (elegida): nuevo paquete `packages/template-library`, con su propia base IndexedDB (`ImpulsoTemplates`, independiente de `ImpulsoAssets`), completamente fuera de cualquier `Document` — un catálogo de plataforma, no un campo anidado de un proyecto.
- **B. Anidar templates dentro de `Document.assets` o un campo nuevo del `Project`**: descartada de inmediato — un Template no pertenece a NINGÚN proyecto, es el catálogo desde el que nacen los proyectos; anidarlo invertiría la relación de dependencia.

### ¿`template-library` depende de `@impulso/export-engine` para generar miniaturas?
- **A. `TemplateContent.thumbnail` es un `Blob` opaco; el paquete no conoce Export Engine** (elegida) — mismo patrón exacto que Asset Library no depender de Export Engine: `template-library` solo declara y persiste el `Blob`, nunca lo genera. Solo `apps/sticker-builder`'s `createThumbnailGenerator` (una función de ~5 líneas) conecta `@impulso/export-engine` con el flujo de guardado/sembrado de Templates.
- **B. `template-library` depende de `@impulso/export-engine` para rasterizar internamente**: descartada — habría acoplado un paquete de catálogo/almacenamiento a un motor de rasterización, y forzado a cualquier consumidor de solo-catálogo (ej. un futuro backend que solo liste templates) a cargar Konva transitivamente.

**Decisión:** `packages/template-library` depende únicamente de `@impulso/document-schema` y `@impulso/engine`. Verificado: cero referencia a `@impulso/export-engine`, `@impulso/renderer-konva` ni `konva` en su `package.json` ni en su código.

### ¿Cómo se clona un `Project` completo con ids frescos?
- **A. Nueva función `cloneProjectWithNewIds` en `@impulso/engine`, reutilizando `cloneSceneObjectWithNewIds`** (elegida): itera páginas → capas → objetos de nivel superior, delegando cada objeto (incluida la recursión de grupos) a la función de clonado ya existente y probada. Regenera `Project.id`, `Document.id`, cada `Page.id`, cada `Layer.id`; resetea `documentVersion` a 1 y `history.entries` a `[]`; actualiza timestamps.
- **B. Reimplementar la lógica de clonado desde cero en `template-library`**: descartada — habría duplicado la lógica no trivial de clonado recursivo de grupos que `@impulso/engine` ya resuelve y prueba.
- **C. Clonar por serialización JSON simple + reemplazo de ids con regex**: descartada — fragil ante cualquier cambio futuro de forma del schema, y no resetea correctamente el historial de undo/redo.

**Decisión:** opción A. `generateId` es un parámetro **requerido** (no tiene default) — consistente con la convención ya establecida por `cloneSceneObjectWithNewIds`: "el Engine nunca inventa identidad." Esto también evita depender de `crypto.randomUUID()`, que no está disponible en el `lib` (`["ES2022"]`, sin `DOM`) del `tsconfig.json` de `@impulso/engine` — el paquete es deliberadamente libre de dependencias del DOM.

**Riesgo aceptado explícitamente:** `cloneProjectWithNewIds` preserva `document.assets` y cada `ImageObject.assetId` **sin reasignar**. Es una función pura y síncrona, sin acceso a `AssetBinaryStore` — no puede duplicar de forma segura un binario. Reasignar el id sin duplicar el binario habría dejado referencias rotas. Consecuencia: un proyecto clonado desde un Template con imágenes comparte el mismo binario de Asset que el Template original (no hay deduplicación por-proyecto). Se registra en Technical Debt.

### ¿Cómo conviven Templates "de fábrica" (built-in) y Templates guardados por el usuario?
- **A. Mismo `TemplateDescriptor`, campo `builtIn: boolean`** (elegida): un único catálogo; los built-in se siembran una vez (idempotente, por id de catálogo fijo: `builtin_square-5x5`, `builtin_circle-5x5`, `builtin_rect-7x5`) y la UI oculta el botón de eliminar solo para ellos. El contenido (el `Project` interno) de un built-in sigue usando ids reales generados en el momento de sembrado — la estabilidad del id de catálogo es lo único que importa para la idempotencia del sembrado, no los ids internos del contenido.
- **B. Dos colecciones/tipos separados (built-in vs. de usuario)**: descartada — habría duplicado la interfaz `TemplateStore`/UI de galería para dos casos que en realidad son el mismo dato con un flag distinto.

### ¿Cuándo se siembran los Templates built-in?
- **A. Sembrado perezoso, disparado por el primer click real en "Nuevo proyecto"** (elegida): un flag `builtInTemplatesSeeded` evita repetirlo, y la llamada está envuelta en `.catch()` — si sembrar falla (ej. cuota, error de canvas), el usuario igual puede abrir el diálogo y usar "Personalizado".
- **B. Sembrado eager en `mountApp()`**: descartada tras romper la suite de tests existente — bajo jsdom, `indexedDB` no existe como global en absoluto (`globalThis.indexedDB === undefined`), así que tocarlo de forma incondicional en cada montaje de la app rompía los ~26 tests que no inyectan un `templateStore` propio. Más allá del entorno de test, sembrar eager también retrasaría cada arranque de la app con trabajo que no hace falta hasta que el usuario realmente pida crear un proyecto.

## Decisión confirmada con el usuario
Se presentó una única pregunta de arquitectura antes de implementar: si unificar `STICKER_SIZE_PRESETS` bajo Templates (eliminando el concepto de "preset" por completo) o mantener ambos conceptos en paralelo. El usuario aprobó la unificación explícitamente, con alcance ampliado por su cuenta: "Templates" pasa a ser el único punto de entrada para crear proyectos nuevos en toda Impulso Platform; un Template representa un proyecto completo con metadatos de catálogo, completamente independiente del módulo que lo consuma; reutilizable por Sticker Builder y todos los módulos futuros listados en el mapa de arquitectura.

## Decisión tomada

### Arquitectura del paquete (`packages/template-library`, nuevo)
Depende únicamente de `@impulso/document-schema` + `@impulso/engine`.

- `TemplateId` — alias de `string` (no un branded type de Zod como los demás ids del Document Schema). Deliberado: un Template nunca se deserializa como parte de un `Document`/`Project` persistido, por lo que no necesita la misma validación de límite de confianza que sí necesitan los ids que SÍ cruzan esa frontera.
- `TemplateDescriptor { id, moduleId, name, description?, tags, builtIn, createdAt, updatedAt }` — liviano, siempre listable.
- `TemplateContent { project: Project, thumbnail?: Blob }` — pesado, cargado solo bajo demanda (`getContent`).
- `TemplateStore` — interfaz: `listDescriptors(filter?: {moduleId?})`, `getDescriptor`, `getContent`, `save(descriptor, content)`, `delete`, `clear`.
- `createMemoryTemplateStore()` y `createIndexedDbTemplateStore(options?)` — dos implementaciones, ambas verificadas contra el mismo `templateStore.contract.ts` (11 casos), exactamente el patrón ya usado por `@impulso/asset-library`. La versión IndexedDB usa dos object stores (`templateDescriptors`, `templateContent`) abiertos juntos en `onupgradeneeded`, con `save`/`delete`/`clear` operando en una única transacción que abarca ambos stores (atomicidad).
- `instantiateTemplate(templateProject, {now, generateId}): Project` — envoltorio semántico fino sobre `cloneProjectWithNewIds` del Engine, dando a `template-library` su propio nombre de dominio sin que los consumidores necesiten conocer la utilidad interna del Engine.

### Cambios en `@impulso/engine`
- `cloneProjectWithNewIds(project, {now, generateId}): Project` (nuevo, `src/cloning/cloneProject.ts`) — descrito arriba.

### Cambios en `apps/sticker-builder`
- `STICKER_SIZE_PRESETS` eliminado de `projectPresets.ts` (junto con el ahora-innecesario `SizePreset`); `createProjectFromSize`/`StickerShape` se conservan sin cambios (siguen siendo la ruta de creación de "Personalizado").
- `builtInTemplates.ts` (nuevo): los 3 presets anteriores renacen como Templates `builtIn: true`, sembrado idempotente vía `seedBuiltInTemplates`.
- `newProjectDialog.ts` rediseñado: de una lista de radio buttons a una **galería de tarjetas** (miniatura + nombre por Template, tarjeta "Personalizado" con campos de ancho/alto). `open()` es ahora `async` (necesita `listDescriptors({moduleId})` antes de poder dibujar la grilla).
- `saveAsTemplateDialog.ts` (nuevo): formulario nombre+descripción; genera una miniatura vía una función `generateThumbnail` inyectada y llama a `templateStore.save(...)` con `builtIn: false` (siempre eliminable por el usuario).
- `createThumbnailGenerator(resolver)` en `app.ts` — el único puente entre Templates y `@impulso/export-engine` (`exportProject(project, resolver, {format:"png", scale:1, background:{type:"solid", color:"#ffffff"}})`).

## El límite Template Library / Export Engine / Document Schema
- **Document Schema**: sin cambios. `Project` ya modelaba todo lo necesario.
- **Template Library**: solo sabe de `Project` (tipo) y de `Blob` (miniatura, opaco). Nunca importa Export Engine ni Konva.
- **Export Engine**: no sabe que existen los Templates. Simplemente se le pide "exportar este `Project` a PNG" — exactamente la misma llamada pública que usa el diálogo de exportación de Epic 3.
- El puente entre los tres vive exclusivamente en código de aplicación (`apps/sticker-builder/src/app.ts`'s `createThumbnailGenerator`), nunca dentro de ninguno de los tres paquetes.

## Consecuencias
- Sticker Builder ya no tiene ningún concepto de "preset" — "Nuevo proyecto" es siempre una galería de Templates + la opción "Personalizado".
- Cualquier módulo futuro obtiene, sin escribir código de infraestructura nuevo: catálogo persistente de puntos de partida, creación de proyecto por clonado con ids frescos, guardado de sus propios Templates por el usuario — con solo escribir su propio `moduleId` y su propio `createThumbnailGenerator` de una línea.
- El sembrado perezoso + `.catch()` en el handler de "Nuevo" es, además de una necesidad de testing, una mejora real de robustez: un fallo de generación de miniatura nunca deja el botón "Nuevo proyecto" sin respuesta.

## Riesgos
- **Sin deduplicación de Assets al clonar un Template con imágenes** — ver arriba, riesgo aceptado explícitamente y registrado en Technical Debt.
- **Sin versionado/edición de un Template existente** — hoy solo existe crear (guardar snapshot nuevo) y eliminar; no hay "actualizar la plantilla X con los cambios actuales".
- **Sin categorías/búsqueda en la galería** — con pocos Templates por módulo esto no es un problema hoy; se revisará si el catálogo crece.
- **Entorno de test (jsdom) sin `indexedDB` ni `HTMLCanvasElement.toBlob` funcionales**: no es deuda del producto, pero exigió que el sembrado de built-ins sea perezoso y que los tests de app inyecten un `templateStore` en memoria pre-poblado, evitando ejercitar la generación real de miniaturas en ese nivel (sí se prueba, con una función fake, en `builtInTemplates.test.ts`).

## Compatibilidad futura
- Un futuro módulo (Planner Builder, etc.) reutiliza `@impulso/template-library` sin cambios: mismo `TemplateStore`, mismo `instantiateTemplate`, filtrando por su propio `moduleId`.
- Si en el futuro se necesita deduplicar/compartir binarios de Asset entre un Template y sus instancias clonadas, el cambio se localiza en `cloneProjectWithNewIds` (pasar a ser async, aceptar un `AssetBinaryStore` opcional) sin afectar la interfaz pública de `TemplateStore`.
- Un backend remoto de Templates (compartidos entre dispositivos/usuarios) implicaría una tercera implementación de `TemplateStore` (ej. `createRemoteTemplateStore`), sin cambios en ningún consumidor — la misma garantía de sustitución ya validada por `AssetBinaryStore`/`PngRasterizer` en épicas anteriores.
