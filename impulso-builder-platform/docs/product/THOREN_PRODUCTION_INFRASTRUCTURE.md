# THÖREN Production Infrastructure v1.0

**Alcance.** Con el Template Piloto Oficial (Serum Facial Premium) aprobado como estándar de producción, este documento cierra la etapa de preparación previa a la producción masiva de los 62 templates restantes: extrae del piloto cada patrón repetible en una utilidad reutilizable (`apps/sticker-builder/src/catalogTemplates/kit/`), y refactoriza el propio piloto —y `projectPresets.ts`, la fuente original del patrón de troquel— para consumirla, de modo que la infraestructura esté probada por el mismo código que ya funcionaba, no solo escrita y sin usar. No produce ningún template nuevo del catálogo — por instrucción explícita, eso espera aprobación de este documento.

Toda la infraestructura vive en `apps/sticker-builder/src/catalogTemplates/kit/` (no un paquete nuevo del monorepo): es tooling de producción específico de cómo Sticker Builder construye templates del catálogo de contenido, del mismo nivel que `projectPresets.ts` — no una capacidad de plataforma que otro módulo (`planner-builder` futuro) fuera a reusar tal cual.

---

## 1. Toda la infraestructura creada

| Archivo | Exporta |
|---|---|
| `kit/ids.ts` | `createIdFactory(generateId)` → `{ projectId, documentId, pageId, layerId, objectId }` |
| `kit/metadata.ts` | `buildElementMetadata({now, role?, name?})` |
| `kit/textObjects.ts` | `createTextObject(...)`, `createSplitAccentLine(...)` |
| `kit/graphicElements.ts` | `createRectangle(...)`, `createEllipse(...)`, `createDividerLine(...)` |
| `kit/dieLine.ts` | `createDieLineObjects({shape, widthMm, heightMm, ...})` |
| `kit/layout.ts` | `stackVertically(items, centerY)`, `textLineHeight(fontSize, lineHeight?)` |
| `kit/styleSystem.ts` | Tipos `VisualFamily`, `TypographyRole`, `TemplatePalette`, `TemplateTypography`, `TemplateStyle`; `FAMILY_SAFE_MARGIN_MM`, `getFamilySafeMarginMm(family)` |
| `kit/projectFactory.ts` | `createCatalogProject({moduleId, name, widthMm, heightMm, now, buildObjects, ...})` |
| `kit/types.ts` | `CatalogTemplateSeed` (movido aquí desde `catalogTemplates/index.ts`, re-exportado sin romper nada) |
| `kit/descriptorFactory.ts` | `buildCatalogTemplateDescriptor(seed, {moduleId, now, authorId?})` |
| `kit/validators.ts` | `validateCatalogProject(project)`, `validateTemplateStyle(style)` |
| `kit/index.ts` | Barrel — un solo import (`from "./kit/index.js"`) para cualquier pieza |

**Consumidores reales, no solo declarados**: `projectPresets.ts` (`createProjectFromSize`, los 3 built-in en blanco) ahora usa `createCatalogProject` + `createDieLineObjects` en vez de construir el scaffold a mano; `serumFacialPremium.ts` fue reescrito íntegramente sobre `createCatalogProject`, `createDieLineObjects`, `createTextObject`, `createSplitAccentLine`, `createDividerLine`, `stackVertically`, `textLineHeight`; `catalogTemplates/index.ts` usa `buildCatalogTemplateDescriptor` en vez de construir el `TemplateDescriptor` inline. Los 20 tests existentes de estos tres archivos pasan sin ninguna modificación de sus aserciones — la refactorización probó que el kit reproduce exactamente el comportamiento anterior, no solo que compila.

59 tests nuevos cubren el kit en sí (10 archivos de test, uno por módulo).

---

## 2-4. Qué problema resuelve cada componente, qué automatiza, y qué ahorro representa

| Componente | Problema que resuelve | Qué automatiza | Ahorro por template |
|---|---|---|---|
| `createIdFactory` | El patrón `XxxIdSchema.parse(\`prefix_${generateId()}\`)` se repetía a mano, una vez por tipo de id, en cada builder de Project. | Genera los 5 tipos de id (`project_`/`document_`/`page_`/`layer_`/`object_`) con el prefijo y schema de validación correctos, sin que el autor del template tenga que recordarlos. | Elimina ~5 líneas de boilerplate repetitivo y su fuente de errores (prefijo equivocado, schema equivocado) por template. |
| `buildElementMetadata` | El objeto literal `{tags:[], visible:true, locked:false, createdAt, updatedAt}` se repetía en cada objeto/Layer/Page/Document. | Construye ese objeto una vez, con `role`/`name` opcionales añadidos solo si se pasan (nunca como `undefined` explícito). | Elimina la repetición del literal en cada uno de los ~6-10 objetos por template. |
| `createTextObject` | Un `TextObject` sin `size` no hace wrap ni se centra — limitación real de `@impulso/document-schema` que el piloto solo descubrió por casualidad al construir el layout con cuidado. | Obliga a pasar `size` (parámetros `width`/`height` requeridos) — la trampa deja de ser posible de omitir por accidente. | Elimina una clase entera de bug silencioso ("el texto no aparece/no se centra") que de otro modo se descubriría tarde, por template, probablemente en QA visual manual. |
| `createSplitAccentLine` | `Style.fill` es un color por objeto — un dato tipo "15%/30ml" con dos colores no cabe en un solo `TextObject`. El piloto resolvió esto a mano, calculando la geometría de dos cajas adyacentes con álgebra simple pero fácil de equivocar. | Dado un `centerX`/`gap` y dos lados (`left`/`right`, cada uno con su propio color/contenido/fuente), calcula la posición exacta de ambos — la misma fórmula validada en el piloto, ahora reutilizable sin rederivarla. | Cualquiera de los templates del catálogo con un dato "de dos colores en una línea" (común en Food & Beverage: proceso + origen; en QR & Smart Labels: código + etiqueta) se resuelve en una llamada, no rederivando la geometría cada vez. |
| `createRectangle` / `createEllipse` | El objeto literal completo (`id`, `transform`, `style` con todos sus defaults, `metadata`, `pluginData`, `customProperties`) para una forma simple se escribía entero cada vez. | Reduce una forma a sus parámetros relevantes (posición, tamaño, color, opcionalmente `role`/`name`) — el resto (`pluginData: {}`, `customProperties: {}`, defaults de `style`) queda fijo y correcto. | Cualquier template con una forma gráfica simple (rectángulos de fondo, franjas, sellos circulares) evita repetir ~12 líneas de boilerplate por forma. |
| `createDividerLine` | La línea divisoria fina (presente en Lujo Silencioso y en otras familias, ver `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.4) requiere centrar manualmente `x = centerX - width/2` — un cálculo pequeño pero repetido y propenso a error de signo. | Centra la línea automáticamente dado solo su centro y ancho deseado. | Evita rederivar el centrado en cada template que use una línea divisoria (Lujo Silencioso, Elegante Personal, y cualquier otro que la reutilice). |
| `createDieLineObjects` | El troquel circular estaba duplicado casi verbatim entre `projectPresets.ts` (los 3 built-in) y `serumFacialPremium.ts` — la definición de "cómo se ve un troquel circular en código" vivía en dos lugares que podían divergir con el tiempo. | Genera la línea de corte (`EllipseObject` con `role:"die-line"`) para `"circle"`, o ningún objeto para `"square"`/`"rectangle"`/`"custom"` (el troquel coincide con el borde de la página) — una sola fuente de verdad, ahora usada por ambos consumidores reales. | Elimina la duplicación ya existente (no solo previene una futura) y cubre automáticamente cualquiera de los templates circulares del catálogo (círculo es la forma por defecto para productos "de mesa", según §5.4 del Design Language Guide — la mayoría del catálogo). |
| `stackVertically` / `textLineHeight` | El cálculo de "centrar un bloque de N elementos apilados verticalmente" se hizo a mano en el piloto con variables nombradas una por una (`wordmarkHeight`, `gapAfterWordmark`, `blockTop`, `wordmarkY`, `productNameY`...) — correcto, pero no reutilizable sin copiar y renombrar. | Dado un arreglo de `{key, height, gapAfter}` y un `centerY`, calcula la posición `y` de cada elemento, centrando el bloque completo. Es la composición base de THÖREN según `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.2 ("el eje único vertical centrado... para casi todas las familias"). | El layout vertical de cualquier template de catálogo (la gran mayoría, salvo la única excepción documentada de alineación izquierda en Técnico Funcional) se reduce a declarar la lista de elementos con su altura y espacio — no a rederivar el álgebra de centrado cada vez. |
| `styleSystem.ts` (`VisualFamily`, `TemplateStyle`, `FAMILY_SAFE_MARGIN_MM`) | Las reglas de `THOREN_DESIGN_LANGUAGE_GUIDE.md` (3 colores + 1 acento variable, máximo 1 tipografía "de carácter" + 1 "de apoyo", margen de aire por familia) vivían solo en prosa — no había forma de comprobar en código que un template nuevo las respeta. | No fija paletas/tipografías concretas (esas siguen viniendo de cada batch) — fija la ESTRUCTURA que un `TemplateStyle` debe tener, y expone el margen de aire recomendado por familia como una constante consultable en vez de "buscarlo en el documento cada vez". | Da a `validateTemplateStyle` (siguiente fila) algo concreto que comprobar, y evita que un colaborador nuevo tenga que releer el documento de 12 secciones para recordar cuántos colores/tipografías "de carácter" permite el sistema. |
| `createCatalogProject` | El scaffold completo de Project/Document/Page/Layer (ids, `schemaVersion`, `assets: []`, `history` vacío, metadata compartida) se repetía casi idéntico entre `createProjectFromSize` y `createSerumFacialPremiumProject` — la única diferencia real entre ambos era qué objetos poner dentro de la Layer. | Construye el scaffold completo una sola vez; cada template solo aporta su `buildObjects`. Preserva el orden exacto de generación de ids del código original (objetos primero, luego Project/Document/Page/Layer) — verificado con un test de determinismo dedicado. | Cada uno de los 62 templates restantes evita reescribir ~35 líneas de boilerplate estructural idéntico; solo necesita su propio `buildObjects`. |
| `buildCatalogTemplateDescriptor` | El mapeo `CatalogTemplateSeed → TemplateDescriptor` vivía inline en el loop de `seedCatalogTemplates` — mezclaba "cómo se itera la siembra" con "cómo se traduce un seed a descriptor". | Aísla el mapeo en una función pura, testeable sin un `TemplateStore` real. | No ahorra líneas por template (el mapeo ya era mecánico), pero permite testear el mapeo de metadata de cada uno de los 62 templates sin tener que sembrar un store completo por test. |
| `validateCatalogProject` | No existía ninguna comprobación automática de las trampas reales encontradas en el piloto (texto sin caja, objeto sin `role`, más de un troquel) — solo se detectaban si un test específico las cubría a mano. | Comprueba automáticamente, sobre cualquier `Project` de catálogo: validez de schema, `TextObject`s sin `size`, objetos sin `metadata.role`, más de un objeto `die-line`. | Convierte 3 clases de error ya vividas en el piloto en un chequeo de una línea (`validateCatalogProject(project)`) ejecutable contra cualquiera de los 62 templates futuros, en vez de depender de que cada test de cada template las recuerde por separado. |
| `validateTemplateStyle` | Las reglas de §2.2/§3.1 del Design Language Guide (colores duplicados, tipografías "de carácter" repetidas) son mecánicamente verificables pero nadie las comprobaba en código. | Detecta paletas con colores duplicados entre roles, o una tipografía "de carácter"/"de apoyo" con la misma familia repetida. | Atrapa un error de copy-paste de paleta/tipografía (plausible al producir 62 templates a partir de batches similares) antes de que llegue a producción. |

---

## 5. Qué riesgos elimina

- **Divergencia entre el patrón de troquel de los built-in y el del catálogo de contenido** — antes existían dos implementaciones casi idénticas (`projectPresets.ts` y `serumFacialPremium.ts`) que podían empezar a diferir con el tiempo sin que nada lo notara; ahora hay una sola (`createDieLineObjects`), usada por ambas.
- **`TextObject`s sin `size` colándose en producción** — la limitación real de `@impulso/document-schema` (texto sin caja no hace wrap ni se centra) ya causó una decisión de diseño cuidadosa en el piloto; `createTextObject` la hace estructuralmente difícil de omitir, y `validateCatalogProject` la detecta si ocurre de todos modos.
- **Objetos sin `metadata.role` en templates nuevos** — sin `role`, un objeto es invisible para el patrón de verificación usado en todo el piloto (tests estructurales por rol, selectores e2e, panel de Capas con nombre semántico); `validateCatalogProject` lo detecta antes de que un template llegue a e2e.
- **Recalcular geometría ya resuelta** (centrado de bloque vertical, partición de una línea en dos colores, centrado de una línea divisoria) — cada uno de estos cálculos ya se hizo una vez, correctamente, en el piloto; sin extraerlos, el riesgo era rederivarlos con un error de signo o de mitad en cada uno de los 62 templates restantes.
- **Errores de formato/prefijo de id** — con `createIdFactory`, es estructuralmente imposible usar el schema equivocado para un tipo de id (el método ya sabe cuál usar).
- **Deriva silenciosa de las reglas del Design Language Guide** — sin `validateTemplateStyle`, nada impedía que un template nuevo usara 2 tipografías "de carácter" o un color de acento igual al de texto; ahora hay un chequeo automatizable, aunque opcional (ver §8).

## 6. Cómo cambia el flujo de producción respecto al piloto

| | Piloto (Serum Facial Premium) | A partir de ahora (62 restantes) |
|---|---|---|
| Scaffold de Project | Escrito a mano, objeto por objeto, campo por campo (~140 líneas). | `createCatalogProject({...}, buildObjects)` — el scaffold es una llamada; solo se escribe `buildObjects`. |
| Troquel circular | Reconstruido a mano, mismo código que `projectPresets.ts` pero duplicado. | `createDieLineObjects({shape, widthMm, heightMm})` — una llamada, ya validada. |
| Cada `TextObject` | Objeto literal completo, con riesgo de omitir `size`. | `createTextObject({...})` — `size` es un parámetro requerido. |
| Layout vertical | Constantes de altura/espacio nombradas a mano, más el álgebra de centrado inline. | `stackVertically([...], centerY)` — se declara la lista de elementos, se recibe la posición ya centrada. |
| Dato de dos colores en una línea | Geometría de dos cajas derivada a mano con papel/lápiz mental. | `createSplitAccentLine({...})` — una llamada. |
| `TemplateDescriptor` | Mapeo inline dentro del loop de siembra. | `buildCatalogTemplateDescriptor(seed, {...})` — reutilizado, testeado aparte. |
| Validación previa a dar por terminado un template | Solo lo que cada test específico decidiera cubrir. | `validateCatalogProject(project)` (y, cuando se declare un `TemplateStyle`, `validateTemplateStyle(style)`) como paso de chequeo estándar antes de considerar un template listo. |
| Verificación e2e | Un spec de Playwright escrito desde cero para el piloto (galería → crear → editar → guardar → exportar). | El mismo spec es el patrón a replicar (selectores ya confirmados: `.new-project-card`, `.layer-row`, `#export-btn`, etc.) — se adapta el contenido esperado por template, no la estructura del spec. |

El flujo pasa de "escribir un Project completo a mano, con cuidado" a "declarar contenido de diseño usando piezas ya probadas" — la traducción de la especificación del batch a decisiones de layout/color/tipografía sigue siendo manual (ver §8), pero la mecánica de convertir esas decisiones en un `Project` válido deja de requerir escribir boilerplate de schema.

## 7. Qué porcentaje del proceso considero automatizado después de esta etapa

**Aproximadamente 55-65% del esfuerzo mecánico de producción por template**, no del proceso completo — la traducción creativa (leer el batch, decidir coordenadas/colores/tipografía reales) sigue siendo enteramente manual y es, en tiempo, la parte más grande del trabajo por template. Lo que cambia es la porción "convertir esas decisiones en código válido":

- **Automatizado por completo**: scaffold de Project/Document/Page/Layer, generación de ids, metadata compartida, troquel circular, forma de cualquier `TextObject`/`RectangleObject`/`EllipseObject` individual, centrado de bloques verticales, partición de datos de dos colores, mapeo seed→descriptor, mecanismo de siembra (`seedCatalogTemplates` ya genera sobre `CATALOG_TEMPLATES` sin cambios necesarios por template).
- **Parcialmente automatizado (la herramienta existe, la decisión sigue siendo humana)**: validación de reglas del Design Language Guide (`validateTemplateStyle` comprueba, pero declarar el `TemplateStyle` de cada template es una decisión de diseño); verificación estructural (`validateCatalogProject` comprueba, pero no reemplaza la revisión de que el diseño se vea bien).
- **Cero automatizado, sigue siendo 100% manual**: todo lo listado en §8.

Este porcentaje se estima sobre el esfuerzo de ingeniería/código por template, no sobre el tiempo total de producción (que sigue dominado por la traducción de diseño, no por escribir el `Project`).

## 8. Qué seguirá requiriendo criterio humano

- **Traducir la prosa de Dirección de Arte/Layout de cada batch a coordenadas, tipografía y color exactos** — sigue siendo juicio de diseño puro; ninguna pieza de este kit decide esto por quien produce el template, solo reduce el costo de expresarlo en código una vez decidido.
- **Decidir a qué familia de lenguaje visual pertenece cada template** (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) antes de empezar — el kit modela la estructura de un `TemplateStyle` pero no infiere la familia por el batch.
- **Decidir illustration vs. no-illustration**, y producir/encargar los assets SVG cuando aplique (`@impulso/asset-library`) — el kit no tiene (ni debería tener) un helper para esto; ningún template con ilustración se ha producido todavía.
- **Formas de troquel personalizadas** (`shape: "custom"` — fajas con muescas de plegado, rombos normados, formas no geométricas) — `createDieLineObjects` cubre círculo/cuadrado/rectángulo; una forma personalizada requiere su propia geometría, decidida caso por caso.
- **Resolver restricciones de schema nuevas y no anticipadas** — `Style.fill` de un color por objeto ya se resolvió (`createSplitAccentLine`), pero un template futuro puede exponer una limitación distinta del modelo de datos que ningún helper actual cubre; eso requerirá la misma clase de decisión técnica documentada que produjo este helper, no una automática.
- **Revisión visual/de diseño de que el resultado realmente cumple el batch** — ninguna validación automática (`validateCatalogProject`/`validateTemplateStyle`) comprueba que el diseño se vea bien; solo que no viole reglas estructurales o de sistema ya formalizadas.
- **Verificación e2e específica de cada template** (selectores de capas, contenido esperado en export) — el spec del piloto es un patrón a replicar, no algo que se generalice automáticamente sin que una persona confirme qué debe verificar cada template nuevo.

---

## Verificación ejecutada

- `npx turbo run typecheck` — 23/23 tareas exitosas.
- `npx turbo run test` — 23/23 tareas exitosas; `apps/sticker-builder` pasó de 33 a 43 archivos de test (512 tests, +49 nuevos del kit), sin ninguna modificación a las aserciones de los tests preexistentes de `projectPresets.ts`, `serumFacialPremium.ts`, `serumPilotFlow.test.ts` ni `catalogTemplates/index.test.ts` — la refactorización preserva el comportamiento exacto ya validado.
- `npx vitest run --coverage` (`apps/sticker-builder`) — 97.6%/90.2%/92.93%/97.6% (stmts/branch/funcs/lines), por encima de los umbrales configurados (90/85/90/90).
- `npm run test:e2e` (Playwright, Chromium real) — 56/56 escenarios, incluyendo los 2 del piloto (`template-catalog-pilot.spec.ts`), sin regresiones.

## Estado

**Infraestructura de producción terminada, probada y lista para aprobación.** No se produce ningún template adicional del catálogo hasta recibir esa aprobación.
