# THÖREN Pilot Template Standard v1.0 — Serum Facial Premium

**Alcance.** Este documento cierra el Template Piloto Oficial de THÖREN (Serum Facial Premium, catálogo 2.1, `TEMPLATE_BATCH_02.md` Template 7), aprobado explícitamente para validar el recorrido completo de 11 pasos —de especificación en prosa a Project funcional, editable, guardable y exportable— antes de escalar a los 62 templates restantes. No es un documento de catálogo ni modifica ningún documento maestro de la Etapa 1; es el primer entregable de la Etapa 2 (Implementación, Integración y Validación). Cubre, en orden, los 10 puntos pedidos al aprobar el alcance ampliado del piloto.

---

## 1. El template completamente integrado en el software

Serum Facial Premium está integrado de punta a punta, sin ningún camino especial: aparece en la galería de "Nuevo proyecto" junto a los 3 tamaños en blanco (`apps/sticker-builder/src/newProjectDialog.ts`, sin cambios — la galería ya era genérica sobre cualquier `TemplateDescriptor`), se crea, edita (Capas + Inspector estándar), guarda (autosave real de Epic 8) y exporta (PNG y SVG, `@impulso/export-engine`) exactamente igual que cualquier proyecto creado desde cero o desde uno de los 3 built-in. La única pieza de código nueva es la fuente de contenido — el `Project` en sí y su siembra— no el flujo que lo consume.

Verificado en dos capas:
- **Unitaria (jsdom)**: `serumPilotFlow.test.ts` cubre los pasos 4-6 y 9 (aparece en galería sin botón de borrar, instanciación produce ids frescos, el objeto de texto instanciado es genuinamente mutable y sigue validando, `buildSvgDocument` real produce SVG correcto).
- **Navegador real (Chromium/Playwright)**: `e2e/template-catalog-pilot.spec.ts`, 2 escenarios, cubre los 11 pasos de punta a punta incluyendo exportación PNG con verificación de firma binaria real (`0x89 0x50 0x4e 0x47...`) y exportación SVG con verificación de contenido editado.

## 2. El `TemplateDescriptor` definitivo

```ts
{
  id: "catalog_serum-facial-premium",
  moduleId: "sticker-builder",
  name: "Serum Facial Premium",
  description: "Etiqueta minimalista de alta gama para frasco gotero, con espacio para % de activos.",
  tags: ["skincare", "serum", "premium", "minimal", "beauty"],
  builtIn: true,
  createdAt: <now>, updatedAt: <now>,
  category: "Cosmetics",
  shape: "circle",
  difficulty: "Intermedio",
  targetAudience: "Marcas de skincare independientes, cosmética natural premium",
  useCase: "Frasco gotero de serum de 30ml",
  suggestedColors: ["#23282B", "#EDEAE2", "#9C4E27"],
  authorId: "thoren",
}
```

Cada campo mapea 1:1 a una afirmación explícita del batch (categoría, dificultad de personalización, público, caso de uso, paleta) — ninguno es inventado para el piloto. `builtIn: true` porque el template viene con la app (no lo crea un usuario) y usa el mismo criterio que los 3 tamaños en blanco: sin botón de eliminar en la galería. `premium`, `packId`, `popularity` se dejan sin asignar deliberadamente — v1.1 no tiene todavía un consumidor real de Marketplace Ready (arquitectura §8); asignarles un valor ahora sería inventar dato donde el catálogo no lo especifica.

Esto requirió extender `TemplateDescriptor` (`packages/template-library/src/types.ts`) con 9 campos opcionales nuevos (`category`, `shape`, `difficulty`, `targetAudience`, `useCase`, `suggestedColors`, `premium`, `packId`, `authorId`, `popularity`) — todos aditivos: un descriptor guardado antes de esta extensión sigue leyéndose sin error ni migración (verificado con un test de contrato dedicado, ver §7). `TemplateStore.listDescriptors` se extendió en paralelo para filtrar por `category`/`shape` además de `moduleId` (AND lógico), para que la metadata extendida sea realmente consultable y no solo almacenamiento inerte — la UI de búsqueda/filtro de `UX_TEMPLATE_LIBRARY.md` sigue fuera de alcance de este piloto, solo se extendió el puerto.

## 3. El `Project` definitivo

Fuente completa: `apps/sticker-builder/src/catalogTemplates/serumFacialPremium.ts` (`createSerumFacialPremiumProject`). Resumen estructural:

- **Page**: círculo de 40mm × 40mm (`unit: "mm"`, tamaño real de troquel del batch), sin grid visible.
- **6 `SceneObject`s**, en este orden, cada uno con `metadata.role` explícito:
  1. `ellipse` — línea de corte (`role: "die-line"`), mismo patrón que los 3 built-in.
  2. `text` "TU MARCA" — wordmark, peso 300, centrado (`role: "wordmark"`).
  3. `text` "Serum Vitamina C" — nombre del producto, peso 400 (`role: "product-name"`).
  4. `rectangle` — línea divisoria, 45px de ancho (≈30% del diámetro, bajo el máximo del 40% del batch), opacidad 0.35 (`role: "divider"`).
  5. `text` "15%" — único uso del acento cobre, alineado a la derecha (`role: "active-percentage"`).
  6. `text` "30ml" — alineado a la izquierda, color carbón (`role: "volume"`).
- **`assets: []`** — el batch dice explícitamente "Ninguno" en la sección 5 (Assets necesarios); el piloto no toca `@impulso/asset-library` en absoluto.

Validado contra el schema Zod real de `@impulso/document-schema` (`ProjectSchema.parse`, no un mock) en `serumFacialPremium.test.ts` (10 tests) — confirma que "sigue el batch al pie de la letra" y "es un `Project` estructuralmente válido" son verificaciones independientes, ambas reales.

## 4. Toda la metadata utilizada

- **Del catálogo de contenido** (`TEMPLATE_BATCH_02.md`, Template 7): nombre, categoría (Cosmetics), forma (círculo), tamaño (40mm), paleta (`#23282B`/`#EDEAE2`/`#9C4E27`), tipografía primaria y su alternativa libre (Century Gothic / Poppins), jerarquía de 4 roles, proporción máxima de la línea divisoria (40%), público objetivo y caso de uso (Commercial Sheet, sección 11).
- **De `TEMPLATE_LIBRARY_ARCHITECTURE.md` §1.3**: la forma del `TemplateDescriptor` extendido en sí (qué campos existen, cuáles son opcionales).
- **Generada por el piloto, no citada de ningún documento**: los `role` de cada `SceneObject` (vocabulario nuevo, consistente con el `"die-line"` ya usado por `projectPresets.ts`), y las coordenadas exactas de layout (ver §5).

## 5. El proceso exacto de conversión: especificación → Project funcional

1. **Leer las secciones 2-4 del batch** (Dirección de Arte, Layout, Elementos) como la única fuente de verdad de diseño — nunca inventar contenido no descrito.
2. **Resolver toda ambigüedad de licencia/medida antes de escribir código**: el batch ofrece Century Gothic (comercial) o Poppins (libre) — se eligió Poppins porque el piloto es código que se distribuye, y el riesgo de licencia ya estaba señalado como abierto en el plan de integración previo a este piloto.
3. **Traducir unidades de diseño a píxeles vía la única función canónica** (`toPixels(40, "mm")`, `@impulso/document-schema`) — nunca un factor de conversión hardcodeado en el template.
4. **Reutilizar, no reinventar, el patrón de troquel existente**: la línea de corte circular se construye idéntica a `createProjectFromSize({shape:"circle"})` (`projectPresets.ts`) — mismo `role`, mismo estilo de trazo — para que el piloto no introduzca un segundo vocabulario de troquel en el código.
5. **Calcular el layout vertical programáticamente, no con coordenadas fijas a mano**: cada elemento de texto aporta una altura (`fontSize * 1.2`), se suman alturas + espacios fijos (4/8/8px, tomados de la proporción relativa descrita en el batch, no medidos del batch en px porque el batch no da píxeles), y el bloque completo se centra en el círculo (`blockTop = centerPx - totalBlockHeight / 2`). Esto es deliberado: si mañana cambia un tamaño de fuente, el layout se recalcula solo, no requiere retocar números mágicos.
6. **Resolver la restricción real del schema encontrada a mitad de la conversión**: el batch pide "% de activo + volumen en una sola línea pequeña" pero `Style.fill` es un color por objeto — no existe forma de colorear una parte de un string de texto distinto a otra. Se decidió partir esa línea en dos `TextObject`s adyacentes (`textAlign:"right"` / `"left"`, con un hueco fijo alrededor del centro horizontal) en vez de forzar un solo string con un color de compromiso. Esta es la decisión técnica más relevante del piloto (ver también §6).
7. **Validar contra el schema real, no contra una copia mental de él**, en cada test — `ProjectSchema.parse` real, no un stub.

## 6. Todas las decisiones técnicas tomadas

- **Poppins sobre Century Gothic** — evita reintroducir un riesgo de licencia comercial ya señalado como abierto; el batch mismo ofrece esta alternativa.
- **Dos `TextObject`s para "15%" / "30ml"** en vez de uno — impuesto por `Style.fill` siendo un color único por objeto (limitación real del schema, no del template).
- **Layout calculado, no hardcodeado** — apilado vertical programático con constantes de espaciado nombradas, centrado dinámico sobre el círculo.
- **Ancho de caja de texto fijo en 90px**, verificado manualmente por trigonometría contra el punto de mayor desplazamiento vertical del layout respecto al centro del círculo, en vez de calcular un ancho seguro por línea — una sola instancia de este cálculo no justifica una función trigonométrica genérica todavía (ver §9 sobre qué NO automatizar aún).
- **Reutilización exacta del patrón de die-line de `createProjectFromSize`** — mismo `role`, mismo estilo — en vez de un segundo mecanismo paralelo para representar troqueles circulares.
- **`assets: []` explícito** en vez de omitir el campo — refleja literalmente "Ninguno" del batch, y sirve como aserción de test (cero `ImageObject`s).
- **Extensión aditiva de `TemplateDescriptor`/`TemplateStore`** (9 campos opcionales, filtro combinable) en vez de una segunda interfaz paralela para templates "de catálogo" — un descriptor pre-existente sigue siendo válido sin migración.
- **`CatalogTemplateSeed` como estructura separada de `BuiltInTemplateSeed`** (`catalogTemplates/index.ts`) — un tamaño en blanco y un template de catálogo con contenido de diseño real son conceptualmente distintos (uno es una forma, el otro es un diseño), aunque ambos terminan como `TemplateDescriptor` con `builtIn: true`.

## 7. Todos los problemas encontrados

1. **jsdom no implementa `HTMLCanvasElement.prototype.toBlob`, y la promesa que lo envuelve nunca se rechaza — solo nunca se resuelve.** Al agregar `seedCatalogTemplates` al sembrado perezoso (`createLazyBuiltInTemplateSeeder`), se introdujo un 4º id sembrable que los helpers `preSeedBuiltIns` de `app.test.ts`/`workspace.test.ts` no conocían — como esos tests SÍ esperan a que termine el sembrado antes de interactuar con el diálogo "Nuevo proyecto", la promesa colgada bloqueaba la apertura del diálogo indefinidamente. Se manifestó como 3 fallos reales (`expected 'none' not to be 'none'`, un `TypeError` de click nulo) al correr la suite completa.
2. **Orden de filas en el panel de Capas no coincide con el orden de creación de objetos.** El primer intento de e2e asertaba el texto de `.layer-row` en el mismo orden en que se crean los objetos en el `Project`; el panel real los renderiza en orden inverso (tope de la pila primero) y cada fila incluye emojis de acción (👁🔓) pegados al nombre.
3. **Riesgo de licencia de fuente** (Century Gothic es comercial) — señalado en el plan de integración previo a este piloto, no descubierto durante la implementación, pero resuelto aquí como parte del piloto (ver §6).
4. **`Style.fill` de un solo color por objeto** frente al requisito de "%/ml en una sola línea" — descubierto al modelar los elementos 3 y 4 del batch (ver §5, punto 6).

## 8. Cómo se resolvieron

1. Se extendió el `preSeedBuiltIns` de ambos archivos de test para iterar también sobre `CATALOG_TEMPLATES` y pre-guardar cada uno con su propio `seed.buildProject(...)` — el mismo criterio que ya usaban para los 3 built-in (evitar que el thumbnail real, colgado en jsdom, bloquee el test). El fix vive enteramente en fixtures de test, sin tocar ningún camino de producción, y es genérico: itera `CATALOG_TEMPLATES` completo, así que no requiere ningún cambio adicional cuando se agreguen los 62 templates restantes.
2. Se cambió la aserción de e2e de "orden exacto" a "cada nombre de rol esperado aparece como substring de alguna fila" (`allTextContents()` + `.some(text => text.includes(...))`), correcta independientemente del orden de renderizado o de los emojis de acción.
3. Se usó la alternativa libre que el propio batch ya proponía (Poppins) — no requirió ninguna decisión nueva fuera del batch.
4. Se dividió la línea en dos `TextObject`s adyacentes con alineación opuesta — documentado como decisión técnica explícita, no como workaround silencioso.

## 9. Qué partes podrán automatizarse para los 62 templates restantes

- **El mecanismo de siembra** (`seedCatalogTemplates`, la iteración sobre `CATALOG_TEMPLATES`, el guardado idempotente por id) — ya es completamente genérico; agregar un template más es agregar una entrada a un arreglo, cero cambios al mecanismo.
- **El helper de test `preSeedBuiltIns`** — ya itera `CATALOG_TEMPLATES` en general, no el id del Serum en particular; cubre automáticamente cualquier template nuevo que se agregue.
- **El mapeo `CatalogTemplateSeed → TemplateDescriptor`** — mecánico y ya escrito de forma genérica en `seedCatalogTemplates`.
- **La validación estructural contra `ProjectSchema`** — el patrón de test (`ProjectSchema.parse`, conteo de objetos, verificación de `assets: []` cuando el batch dice "Ninguno") se replica sin cambios para cualquier template sin ilustración.
- **La conversión de unidades** (`toPixels`) y **el patrón de die-line reutilizable** (círculo, cuadrado, rectángulo) — ya existen y cubren la mayoría de formas del catálogo (ver `TemplateShape`; `"custom"` queda para troqueles no geométricos, ej. Jabón Artesanal en Barra, Template 9).

## 10. Qué seguirá requiriendo intervención manual

- **Traducir la prosa de Dirección de Arte/Layout de cada batch a coordenadas, tipografía y color exactos** — es juicio de diseño, no un dato estructurado; cada template requiere esta traducción una vez, a mano.
- **Decidir illustration vs. no-illustration** y, cuando aplique, producir o encargar los assets SVG descritos en la sección 5 de cada batch (`@impulso/asset-library`) — el piloto deliberadamente no cubrió este caso (Serum es "Ninguno").
- **Troqueles personalizados** (`shape: "custom"`, ej. fajas con muescas de plegado, formas no geométricas) — no existe todavía un generador reutilizable para esta clase, solo para círculo/cuadrado/rectángulo.
- **Resolver caso por caso cualquier restricción de schema análoga a la de `Style.fill`** — no toda restricción se puede prever de antemano; cada template nuevo puede exponer una limitación distinta del modelo de datos que requiera una decisión de diseño técnico documentada, como se hizo aquí.
- **Verificación e2e específica por template** (selectores de capas, contenido esperado en export) — el spec de Playwright de este piloto es un patrón a replicar, no algo que se generalice automáticamente sin revisión humana del layout de cada template.

---

## Verificación final ejecutada

- `npx turbo run typecheck` — 23/23 tareas exitosas.
- `npx turbo run test` — 23/23 tareas exitosas (`@impulso/template-library` 36/36, `@impulso/sticker-builder` 463/463).
- `npx vitest run --coverage` (`apps/sticker-builder` y `packages/template-library`) — umbrales cumplidos (sticker-builder: 97.53%/89.94%/92.46%/97.53% stmts/branch/funcs/lines; template-library: 100% en las 4 métricas). Un fallo puntual de `workspace.test.ts` bajo instrumentación de cobertura (`regresión RC1: importar un respaldo...`) se confirmó como flake de temporización preexistente y no relacionado — el test tiene una espera fija de 10ms para un macrotask de `FileReader` que la instrumentación de cobertura puede exceder bajo carga; se reprodujo en aislamiento (pasa) y se re-corrió la suite completa de cobertura, que pasó 33/33 archivos y 463/463 tests sin reintentos.
- `npx playwright test` (tras `vite build`) — suite completa de e2e, incluyendo los 2 escenarios nuevos de `template-catalog-pilot.spec.ts`, sin regresiones.

## Estado

**Piloto terminado, probado y listo para aprobación.** Por instrucción explícita, no se avanza con ningún otro template del catálogo hasta recibir esa aprobación.
