# Template Library — Arquitectura (Diseño, no implementación)

**Alcance de este documento: exclusivamente diseño.** No se escribió ni se modificó ningún componente, ningún archivo de `apps/sticker-builder/src`, ni ningún paquete. THÖREN Sticker Builder v1.0 permanece congelado tal como se entregó. Este documento describe cómo debería evolucionar la Template Library para sostener un catálogo profesional que crezca durante años — no autoriza ni inicia esa construcción.

Acompaña a `TEMPLATE_CATALOG_v1.md` (catálogo inicial propuesto), `UX_TEMPLATE_LIBRARY.md` (flujos y accesibilidad) y `ROADMAP_TEMPLATE_SYSTEM.md` (secuencia de versiones).

---

## 0. Punto de partida real (qué existe hoy, sin inventar nada)

Antes de diseñar hacia adelante, esto es lo que ya está construido y en producción (Epic 4, `packages/template-library`, ADR-0013):

- **Modelo de datos actual**: `TemplateDescriptor { id, moduleId, name, description?, tags: string[], builtIn: boolean, createdAt, updatedAt }` (ligero, siempre listable) + `TemplateContent { project: Project, thumbnail?: Blob }` (pesado, carga perezosa). Un Template **es** un `Project` completo de `@impulso/document-schema` más metadatos de catálogo — nunca un esquema paralelo con "placeholders".
- **`TemplateStore`**: `listDescriptors(filter?: {moduleId})`, `getDescriptor`, `getContent`, `save`, `delete`, `clear`. Sin operación de edición/versionado de un template ya guardado.
- **`tags: string[]` ya existe como campo**, pero hoy no filtra nada — es metadata muerta a la espera de una UI de búsqueda.
- **3 templates de fábrica** (`builtin_square-5x5`, `builtin_circle-5x5`, `builtin_rect-7x5`), sembrados de forma perezosa (primer clic en "Nuevo proyecto"), nunca de forma eager al arrancar la app.
- **Sin categorías, sin búsqueda** en la galería hoy — decisión explícita de ADR-0013 ("no es un problema todavía con pocos templates por módulo; revisar si el catálogo crece"). Este documento es exactamente esa revisión.
- **`template-library` depende únicamente de `document-schema` + `engine`** — nunca de `export-engine`/`renderer-konva`/Konva. La generación de miniaturas es responsabilidad exclusiva de la app (`app.ts`). Esta separación se **mantiene** en todo el diseño de abajo: nada aquí propone que el paquete `template-library` dependa de renderizado.
- **Modelo comercial ya existe** (`docs/platform/COMMERCIAL_PRODUCT_MODEL.md`): `CommercialProduct.productType` ya incluye `"template-pack"` como valor de primera clase, con una nota explícita de que el diseño de entitlements para packs de templates queda pendiente de una fase posterior. Este documento es esa fase.
- **Principio ya declarado** (`docs/product/02-Product-Principles.md`): "AI Provider Agnostic" — cualquier integración de IA debe vivir detrás de un adaptador, nunca acoplada a un proveedor concreto. El diseño de la sección 9 sigue este principio al pie de la letra.

Todo lo que sigue es una **extensión** de este modelo, no un reemplazo. `TemplateDescriptor` gana campos opcionales; `TemplateStore` gana capacidades de filtrado; nada de lo ya construido se rompe.

---

## 1. Arquitectura general

### 1.1 Principio rector

La Template Library es un **catálogo de puntos de partida**, no un editor ni un motor de render. Su única responsabilidad es: describir templates, almacenarlos, dejarlos buscar/filtrar/navegar, y entregar un `Project` clonado listo para editar. Todo lo demás (miniaturas, exportación, edición) sigue viviendo donde vive hoy.

### 1.2 Capas (de abajo hacia arriba)

```
┌─────────────────────────────────────────────────────────┐
│  UI (apps/sticker-builder)                               │
│  Gallery, Search Bar, Filters, Template Card, Detail Panel│
├─────────────────────────────────────────────────────────┤
│  Catalog Query Layer (nuevo, dentro de template-library)  │
│  índices en memoria: por categoría, tag, dificultad,       │
│  shape, premium — construidos sobre listDescriptors()      │
├─────────────────────────────────────────────────────────┤
│  TemplateStore (ya existe, se extiende)                   │
│  listDescriptors(filter ampliado), getDescriptor,          │
│  getContent, save, delete, clear                           │
├─────────────────────────────────────────────────────────┤
│  Persistencia (storage-kit, ya existe)                     │
│  IndexedDB local (hoy) → API remota (futuro, mismo         │
│  contrato TemplateStore, ver §1.5)                         │
└─────────────────────────────────────────────────────────┘
```

La **Catalog Query Layer** es la única pieza nueva de arquitectura real (no de UI): un módulo puro que recibe todos los `TemplateDescriptor` de `listDescriptors()` y construye índices en memoria para responder consultas de búsqueda/filtro sin tocar IndexedDB en cada tecla presionada. Vive dentro de `packages/template-library` (mantiene la regla de dependencias: sigue sin tocar `export-engine`/Konva), se recalcula solo cuando cambia el catálogo (evento `onCatalogChange`), y es descartable/reconstruible — no persiste nada por sí misma.

### 1.3 Extensión del modelo de datos

`TemplateDescriptor` gana campos **opcionales** (retrocompatibles — los 3 templates de fábrica actuales siguen siendo válidos sin modificarlos):

```
TemplateDescriptor {
  // ya existente, sin cambios:
  id, moduleId, name, description?, tags: string[], builtIn, createdAt, updatedAt

  // nuevo, opcional:
  category?: CategoryId          // ver §2 — un template pertenece a 0 o 1 categoría de industria
  shape?: ShapeId                 // round | square | rectangle | custom — facet independiente
  difficulty?: "basico" | "intermedio" | "avanzado"
  targetAudience?: string         // texto corto libre, ej. "Vendedores de Etsy"
  useCase?: string                // texto corto libre, ej. "Etiqueta de frasco de 250ml"
  suggestedColors?: string[]      // hex, para preview antes de abrir (ver §6)
  premium?: boolean               // ver §8 — false por defecto, nunca bloquea nada hoy
  packId?: string                 // ver §8 — a qué CommercialProduct pertenece, si aplica
  authorId?: string               // ver §8 — "thoren" por defecto para todo lo de fábrica
  popularity?: { usedCount: number, lastUsedAt?: string }  // ver §4, actualizado por el store
}
```

Ningún campo nuevo es obligatorio. Un template sin `category` simplemente no aparece en ningún filtro de categoría (pero sí en "Todos"), sin romper nada. Esto permite que el catálogo crezca de forma incremental: los 3 templates de fábrica actuales pueden recibir estos campos en un PR trivial cuando se decida construir esto, sin migración de datos compleja.

### 1.4 Navegación (mapa de pantallas, no de componentes)

```
Mis Proyectos
  └─ "Nuevo proyecto" ──► Template Gallery (pantalla nueva/expandida)
                            ├─ Barra de búsqueda (siempre visible, arriba)
                            ├─ Filtros de faceta (categoría / shape / dificultad / premium)
                            ├─ Tabs de vista: Todos | Recientes | Favoritos | Más usados | Colecciones
                            ├─ Grid de Template Cards (ver §5)
                            ├─ "Personalizado" (ya existe hoy, se mantiene como opción siempre visible)
                            └─ clic en card ──► Template Detail (ver §6) ──► "Usar este template" ──► Editor
```

La Template Gallery **reemplaza** la grilla plana de `newProjectDialog.ts` de hoy, no la elimina conceptualmente — es la misma pantalla, con más capacidad. El flujo de "Guardar como plantilla" no cambia de forma (sigue siendo: nombre + descripción → guardar), pero gana campos opcionales de categorización en el mismo formulario (ver UX_TEMPLATE_LIBRARY.md §1).

### 1.5 Escalabilidad

Tres preocupaciones de escalabilidad distintas, cada una con una respuesta concreta:

1. **Escalabilidad de datos** (¿qué pasa con 500 o 5,000 templates?): `listDescriptors()` ya devuelve solo descriptores ligeros (nunca el `Project` completo ni el thumbnail) — esto ya escala. La Catalog Query Layer (§1.2) mantiene los índices en memoria; con 5,000 descriptores ligeros esto son unos pocos MB, no un problema. El límite real es de **UI** (renderizar 5,000 cards), resuelto con virtualización de scroll (ver UX_TEMPLATE_LIBRARY.md §3) — nunca cargando todo el DOM a la vez.
2. **Escalabilidad de catálogo remoto** (¿qué pasa cuando el catálogo no vive solo en el IndexedDB local?): ADR-0013 ya anticipó esto — `TemplateStore` es una interfaz; una implementación remota (`remoteTemplateStore.ts`, API HTTP con paginación/cursor) puede coexistir con la local sin cambiar ni la Catalog Query Layer ni la UI, siempre que respete el mismo contrato. El diseño aquí asume que en algún punto habrá **dos stores activos simultáneos** — uno local (templates propios del usuario) y uno remoto (catálogo oficial + marketplace) — combinados en la capa de consulta, no mezclados en el mismo IndexedDB.
3. **Escalabilidad de categorías** (¿qué pasa si en 2 años hace falta una categoría nueva?): la taxonomía de categorías (§2) es una lista de datos, no un enum compilado en TypeScript con branching de código — agregar "Automotive" en v1.3 es agregar una fila a una tabla de configuración, no tocar componentes.

### 1.6 Rendimiento

- Ninguna consulta de búsqueda/filtro toca IndexedDB directamente — todo pasa por los índices en memoria de §1.2, reconstruidos solo al cambiar el catálogo.
- Los thumbnails siguen las mismas reglas de hoy (`Blob` lazy, cargado solo cuando la card entra al viewport — ver UX_TEMPLATE_LIBRARY.md §3 para el detalle de virtualización).
- `popularity.usedCount` (para "Más usados") se actualiza de forma asíncrona y no bloqueante en el momento de instanciar un template — nunca en el camino crítico de abrir el editor.

---

## 2. Categorías — arquitectura de la taxonomía (el catálogo con nombres vive en `TEMPLATE_CATALOG_v1.md`)

### 2.1 Decisión de diseño: dos facetas, no una lista plana

El listado de ejemplo del encargo mezcla dos cosas de naturaleza distinta: **industria/caso de uso** (Food & Beverage, Cosmetics, Wedding...) y **forma física** (Round, Square, Rectangle, Custom). Tratarlas como una sola lista plana obliga a decisiones arbitrarias ("¿un sticker redondo de café va en 'Food & Beverage' o en 'Round'?") y no escala — cada industria nueva multiplicaría por cada forma.

**Se diseñan como dos facetas independientes, combinables:**

- **Facet "Categoría"** (industria/caso de uso) — ver §2.2. Un template pertenece a 0 o 1 categoría.
- **Facet "Forma"** (`ShapeId`: `round | square | rectangle | custom`) — ya existe conceptualmente hoy vía `tags` (`["circle"]`, `["square"]`), se formaliza como campo propio.
- **Facet "Dificultad"** (`basico | intermedio | avanzado`).
- **Facet "Premium"** (booleano, ver §8).

La UI de filtros (§4) permite combinar facetas: "Food & Beverage + Round + Básico" es una consulta válida sin que exista una categoría "Food & Beverage Round Básico". Esto es exactamente el patrón de Canva/Figma Community (filtros combinables, no árbol de carpetas anidado) y es lo que permite crecer sin rediseñar la taxonomía.

### 2.2 Categorías de industria/caso de uso propuestas (con justificación)

| Categoría | Justificación |
|---|---|
| **Food & Beverage** | El caso de uso más grande y validado del mercado de stickers/etiquetas — cafeterías, cervecerías, conservas, panaderías. Alta intención de compra recurrente (etiquetas de lote). |
| **Cosmetics** | Etiquetas de producto (frascos, tubos, envases) — mercado con requisitos visuales específicos (elegancia, espacio para ingredientes/lote) distinto al de Beauty. |
| **Beauty** | Servicios y marca personal (salones, spas, marcas de estilista) — más lifestyle/branding que "etiqueta de envase"; se separa de Cosmetics porque el objeto físico y el mensaje son distintos (promoción de servicio vs. información de producto). |
| **Industrial** | Identificación de equipo, marca de empresa industrial — estética sobria, alto contraste, textos técnicos. |
| **Warning & Compliance Labels** | Distinta de Industrial: aquí el contenido está semi-normado (símbolos ISO/ANSI, texto de advertencia) — el usuario necesita plantillas que ya respeten convenciones, no solo estética industrial. |
| **Retail** | Stickers de punto de venta — precio, oferta, "nuevo", branding de tienda física. |
| **Product Labels** | Etiqueta de producto genérica, neutral, aplicable a cualquier industria no cubierta arriba — el "punto de partida en blanco pero no vacío" para quien vende algo sin categoría propia todavía. |
| **Packaging** | Sellos de cierre, cintas decorativas, stickers que acompañan el empaque (no la etiqueta principal del producto). |
| **Shipping** | "Frágil", "Este lado arriba", agradecimientos de envío — volumen alto, diseño simple, para quienes venden online. |
| **Business** | Tarjetas/branding corporativo en formato sticker — logos, sellos de "gracias por tu compra", membretes adhesivos. |
| **Events** | Marca temporal de un evento (conferencia, lanzamiento) — vida corta, alta personalización de fecha/nombre. |
| **Wedding** | Volumen y búsqueda comprobada en marketplaces de plantillas (Etsy, Canva) — invitaciones, favores, sellos de sobre. Se separa de Events por ser el caso de uso individual más grande dentro de "eventos". |
| **Crafts** | Hobbistas y makers — decoración de manualidades, no venta comercial necesariamente. |
| **Etsy Sellers** | No es una industria sino una **persona de vendedor**: alguien que vende artículos hechos a mano/vintage en Etsy y necesita un estilo consistente (kraft, hecho a mano, orgánico) sin importar qué vende. Se justifica como categoría propia por señal de búsqueda directa (el usuario típico literalmente busca "etsy" al buscar plantillas) — precedente: Canva y Creative Market tienen categorías por plataforma de venta. |
| **Kids** | Estética y contenido distintos (colores, personajes genéricos, formas redondeadas) — audiencia y tono claramente diferenciados del resto. |
| **Education** | Escuelas, maestros, materiales educativos — sellos de "buen trabajo", horarios, etiquetas de útiles escolares. |
| **Holiday** | Fechas fijas de alta estacionalidad (Navidad, Día de Muertos, Año Nuevo) — picos de demanda predecibles por calendario. |
| **Seasonal** | Distinta de Holiday: temporadas sin fecha fija de celebración (verano, otoño, "back to school") — permite estacionalidad sin atarse a una festividad específica. |
| **QR & Smart Labels** | Categoría orientada a función, no a industria — cualquier sticker con un código QR/data matrix integrado en el diseño. Crece con la adopción de menús/enlaces por QR. |

Total: 19 categorías de industria/caso de uso + 4 formas + 3 dificultades + premium como facetas cruzadas. Deliberadamente **no** se incluye "Round/Square/Rectangle/Custom" en esta tabla — son la otra faceta (§2.1).

---

## 3. Template Catalog

El catálogo inicial concreto (60 templates, con los 10 campos pedidos por cada uno) vive en **`TEMPLATE_CATALOG_v1.md`** para no duplicar contenido entre documentos. Este documento define únicamente la **estructura** que cada entrada del catálogo debe seguir — que es exactamente la extensión de `TemplateDescriptor` de §1.3:

```
Nombre comercial     → TemplateDescriptor.name
Categoría            → TemplateDescriptor.category
Descripción corta    → TemplateDescriptor.description
Caso de uso          → TemplateDescriptor.useCase
Público objetivo     → TemplateDescriptor.targetAudience
Nivel de dificultad  → TemplateDescriptor.difficulty
Tags                 → TemplateDescriptor.tags
Preview sugerido     → dirección de arte para el thumbnail (no un campo persistido — instrucción para quien diseñe el asset real)
Mockup recomendado   → qué producto físico mostrar en el Template Detail (§6) — tampoco persistido, es dirección de arte
Colores sugeridos     → TemplateDescriptor.suggestedColors
```

"Preview sugerido" y "Mockup recomendado" son **dirección creativa para producción de assets**, no datos que vivan en el modelo — se documentan en el catálogo para que quien diseñe los thumbnails reales tenga contexto, igual que el brief de fotografía de Fase 5 fue dirección de arte sin ser parte del código.

---

## 4. Búsqueda

### 4.1 Arquitectura de búsqueda (texto libre)

Búsqueda por texto libre sobre `name`, `description`, `tags`, `useCase` — coincidencia por substring, sin distinción de mayúsculas/acentos (normalización simple), ejecutada 100% en memoria contra los índices de §1.2. **No requiere backend ni servicio de búsqueda externo** para el volumen esperado (cientos a pocos miles de templates) — un motor de búsqueda dedicado (Algolia, Meilisearch) solo se justificaría si el catálogo remoto de marketplace (§8) crece a decenas de miles de entradas, y quedaría detrás de la misma interfaz de consulta, sin cambiar la UI.

### 4.2 Filtros (facetas combinables, ver §2.1)

- Categoría (selección múltiple)
- Forma (selección múltiple)
- Dificultad (selección múltiple)
- Premium / Gratis (toggle)
- Tags (selección múltiple, alimentado por los tags reales presentes en el catálogo — nunca una lista fija hardcodeada)

Los filtros se combinan con AND entre facetas distintas, OR dentro de la misma faceta (ej.: "(Food & Beverage O Cosmetics) Y Redondo Y Gratis").

### 4.3 Vistas (tabs, no filtros)

- **Recientes**: templates usados por el usuario en las últimas N sesiones — requiere el campo `popularity.lastUsedAt` (§1.3), ordenado descendente, solo lectura, sin persistencia adicional más allá de ese campo.
- **Favoritos**: requiere un campo nuevo `favoritedBy: Set<userId>` o, en V1 sin cuentas de usuario, simplemente `favorited: boolean` local al dispositivo (consistente con que hoy no hay concepto de cuenta en el producto — ver `docs/platform/COMMERCIAL_PRODUCT_MODEL.md`). Se re-evalúa cuando exista sistema de cuentas.
- **Más usados**: ordenado por `popularity.usedCount` descendente — agregado global si el catálogo es remoto/compartido, o local si es solo el store del dispositivo.
- **Newest**: ordenado por `createdAt` descendente — trivial, ya disponible hoy.
- **Colecciones**: agrupaciones curadas editorialmente (ej. "Lanzamiento de verano 2026"), modeladas como una entidad nueva y pequeña `Collection { id, name, templateIds: string[] }`, independiente de `TemplateDescriptor` — un template puede estar en 0 o varias colecciones sin que eso viva en su propio descriptor (evita que cada template cargue una lista de "en qué colecciones estoy").
- **Premium**: no es una vista sino el filtro de §4.2 aplicado por defecto — se documenta aquí porque el encargo la lista junto a las vistas; arquitectónicamente es un filtro, no una fuente de datos distinta.

---

## 5. Template Card

Información que la card debe mostrar, en orden de prioridad visual (de más a menos prominente):

1. **Preview** (thumbnail) — dominante, ocupa la mayor parte de la card. Reutiliza el mecanismo de thumbnail `Blob` que ya existe hoy (`TemplateContent.thumbnail`), generado por la app, nunca por `template-library`.
2. **Nombre** — bajo el preview, una línea, truncado con ellipsis si excede el ancho.
3. **Badges** (esquina superior del preview, superpuestos, no en su propia fila — para no gastar altura de card): "Premium" (si `premium: true`), "Nuevo" (si `createdAt` cae dentro de una ventana reciente, ej. 30 días), "Popular" (si `popularity.usedCount` supera un umbral relativo al resto del catálogo). Máximo 2 badges simultáneos visibles — si califica para más, se prioriza Premium > Nuevo > Popular.
4. **Categoría** — texto pequeño, bajo el nombre, en el color/estilo secundario ya establecido por el sistema de diseño de THÖREN (Fjord/gris, no Ember — Ember queda reservado para acciones, no para metadata).
5. **Nivel** (dificultad) — junto a la categoría, como texto o un indicador visual mínimo (no un badge separado, para no competir con los badges de esquina).
6. **Acciones** — visibles solo en hover/foco (no permanentes, para no saturar el grid): "Usar" (acción primaria, abre el editor directo — atajo a lo que hoy hace seleccionar+"Crear"), "Vista previa" (abre Template Detail, §6), "Favorito" (icono de estrella/corazón, toggle inmediato sin confirmación). En touch (sin hover), estas acciones aparecen siempre visibles pero con menor peso visual, consistente con el patrón ya usado en el resto de la app para controles secundarios.
7. **Selección** — al hacer clic en la card (no en una acción específica) se abre el Template Detail, nunca se crea el proyecto directamente sin pasar por ahí — evita creaciones accidentales de un vistazo mal calculado. La única forma de crear sin pasar por Detail es el botón "Usar" explícito del punto 6.
8. **Estado hover/focus**: elevación sutil (sombra, igual que las cards ya usadas en Mis Proyectos) + aparición de las acciones del punto 6. Focus (teclado) debe ser visualmente indistinguible de hover en términos de qué se revela — ver UX_TEMPLATE_LIBRARY.md §2 para el detalle de accesibilidad.

---

## 6. Template Detail

Antes de abrir un template en el editor, el usuario debe poder ver, en una vista dedicada (panel lateral o modal, decisión de UX en `UX_TEMPLATE_LIBRARY.md`):

- Preview grande (no el thumbnail pequeño de la card — una versión de mayor resolución del mismo asset).
- Nombre completo + categoría + nivel.
- Descripción corta y caso de uso (ambos campos ya definidos en §1.3/§3).
- Público objetivo (ayuda a decidir "es para mí" antes de invertir tiempo editando).
- Tamaño físico real del template (ancho × alto + unidad — dato que YA vive en el `Project.document.pages[0].size`, se lee, no se duplica).
- Tags (clicables — clicar un tag filtra la galería por ese tag, patrón estándar de descubrimiento).
- Mockup recomendado (§3) si existe un asset de mockup asociado — muestra el sticker aplicado a un producto real/ilustrado, no solo el diseño plano, para comunicar "así se va a ver en el mundo real" (mismo principio que ya guio las decisiones de la Hero de marca de Fase 4-5: producto real > diseño plano).
- Si `premium: true`: precio o indicación de qué `CommercialProduct`/pack lo incluye (§8), y el estado de entitlement del usuario (ya tiene acceso / no tiene acceso) — reutilizando el Capabilities layer ya existente, nunca una comprobación ad-hoc nueva.
- Acción primaria: "Usar este template" (mismo efecto que "Usar" en la card).
- Acción secundaria: cerrar/volver a la galería sin perder los filtros/búsqueda activos (el estado de búsqueda no se resetea al abrir y cerrar un Detail).

---

## 7. UX

Cubierto en profundidad en `UX_TEMPLATE_LIBRARY.md`. Resumen de los principios que ese documento desarrolla, para que este documento de arquitectura quede completo por sí mismo:

- **Flujo**: nunca más de 2 clics entre "Nuevo proyecto" y estar editando un template conocido (galería → card → "Usar"), 3 si se pasa por Detail.
- **Velocidad**: ninguna interacción de búsqueda/filtro depende de red o de IndexedDB síncrono — todo contra los índices en memoria de §1.2.
- **Accesibilidad**: cards son elementos de teclado navegables (`tabindex`, `role="button"` o `<button>` real), acciones de hover tienen equivalente por teclado, contraste de badges y texto de categoría cumple WCAG AA sobre el fondo Stone/Paper ya establecido.
- **Consistencia**: la Template Gallery reutiliza los mismos tokens visuales (color, tipografía, espaciado) que el resto de THÖREN — no introduce un lenguaje visual nuevo solo porque el catálogo crece.
- **Escalabilidad de UX**: virtualización de grid desde el día en que el catálogo supere ~100 templates (umbral exacto y técnica en UX_TEMPLATE_LIBRARY.md §3).

---

## 8. Marketplace Ready

**No se construye marketplace ahora** (`docs/product/PRODUCT_BACKLOG.md` ya fija esto como prioridad Baja, condicionado a evidencia real de demanda — este documento no contradice esa decisión). Lo que sí se diseña: que la arquitectura de catálogo de arriba **no tenga que rediseñarse** cuando llegue ese momento.

### 8.1 Reutilización del modelo comercial ya existente

`docs/platform/COMMERCIAL_PRODUCT_MODEL.md` ya define `CommercialProduct.productType: "template-pack"` como valor de primera clase, con la nota de que el diseño de entitlements queda para una fase posterior. Esta es esa fase:

- Un **pack** de templates = un `CommercialProduct` con `productType: "template-pack"`, cuyo `entitlementRequirements` puede exigir (a) poseer el módulo base (Sticker Builder) como precondición, y/o (b) haber comprado ese pack específico.
- Cada `TemplateDescriptor` premium lleva `packId` (§1.3) apuntando al `CommercialProduct` que lo incluye — la relación vive en el descriptor del template, no al revés (un pack no necesita una lista de templates embebida, se deriva consultando qué descriptores apuntan a él).
- La verificación de acceso reutiliza el **Capabilities layer** ya existente (la misma capa que hoy decide si `print.professional` está habilitado) — nunca una comprobación de licencia nueva y paralela. Un template premium sin entitlement se muestra en el catálogo (descubrible, genera deseo de compra) pero "Usar" lleva a una pantalla de compra en vez de al editor — mismo patrón que cualquier `Feature` bloqueada hoy.

### 8.2 Autores

`authorId` (§1.3) — `"thoren"` para todo lo construido internamente. Diseñado desde ahora como string libre (no un enum) para que, cuando exista un programa de autores externos, no haga falta migrar el campo — solo empezar a poblarlo con otros valores. Un `Author` como entidad propia (`{ id, displayName, bio?, verified: boolean }`) se introduce en la fase en que existan autores reales, no antes (yagni deliberado, consistente con `docs/product/02-Product-Principles.md`).

### 8.3 Ratings, descargas, actualizaciones, versiones

- **Ratings**: agregado numérico por template (`{ average: number, count: number }`), calculado server-side cuando exista un backend de marketplace — nunca calculado ni confiado desde el cliente.
- **Descargas**: se deriva de `popularity.usedCount` ya diseñado en §1.3 — no hace falta un contador nuevo, es la misma métrica vista desde el ángulo de "cuántos lo usaron" en vez de "qué tan popular es en la galería".
- **Versiones de un template**: cuando un autor publica una actualización de un template ya comprado por usuarios, el `Project` que ya usaron esos usuarios **nunca cambia retroactivamente** (mismo principio que rige actualizaciones de la app: nunca se revoca ni se altera lo que el usuario ya tiene — ver `docs/platform/LICENSING_THREAT_MODEL.md`). Una nueva versión es un nuevo `TemplateDescriptor` con `previousVersionId` opcional, no una mutación del existente.
- **Licencia de uso del template**: se resuelve con el mismo modelo de `License`/`Channel` ya diseñado para módulos — un template premium no necesita un sistema de licenciamiento paralelo.

---

## 9. IA (arquitectura, no implementación)

Sin implementar nada, y siguiendo el principio ya declarado de "AI Provider Agnostic": cualquier capacidad de IA relacionada con templates vive detrás de un puerto/adaptador, nunca acoplada a un proveedor.

Puntos de extensión identificados (todos opcionales, todos apagables sin afectar el resto del sistema):

1. **Sugerencia de templates por texto libre** ("quiero una etiqueta para mi cerveza artesanal") — un adaptador que traduce lenguaje natural a una consulta de filtros de §4 (categoría + tags), NO un generador de diseño nuevo. Bajo riesgo, alto valor: reutiliza el catálogo existente en vez de generar contenido nuevo no curado.
2. **Autocompletado de metadata al guardar un template propio** ("Guardar como plantilla") — sugerir `category`/`tags`/`difficulty` a partir del contenido del `Project` (analizando texto/colores/forma), presentado siempre como sugerencia editable, nunca aplicado sin confirmación del usuario.
3. **Generación de variaciones de color** de un template existente — un adaptador que, dado un `Project` y una paleta objetivo, produce un `Project` derivado con los mismos elementos pero colores nuevos. Este es el punto de integración más delicado porque toca contenido, no solo metadata — se diseña como una acción explícita del usuario ("Generar variación"), nunca automática.
4. **Ranking de "más relevante para ti"** dentro de una vista existente (no una vista nueva) — reordena `listDescriptors()` según señales de uso pasado; es una capa de scoring sobre datos que ya existen (§1.3 `popularity`), no requiere nuevos datos ni nueva UI.

Ninguno de estos puntos requiere cambios en `document-schema`, `engine` ni en el store — todos son capas que consumen `TemplateDescriptor`/`Project` ya definidos, consistente con la regla de que `template-library` nunca depende de un proveedor de IA ni de renderizado.

---

## 10. Roadmap

Desarrollado en profundidad en `ROADMAP_TEMPLATE_SYSTEM.md`. Resumen de una línea por versión:

- **v1.1**: catálogo ampliado (§3) + facetas de categoría/forma/dificultad + búsqueda y filtros (§4) — sin marketplace, sin IA, sin cuentas.
- **v1.2**: favoritos/recientes/más usados con persistencia real, colecciones curadas, primer template premium de prueba (validando el modelo de §8 con un solo pack, no un catálogo completo).
- **v2.0**: marketplace real (autores externos, ratings, checkout) + primera integración de IA (punto 1 de §9) — condicionado, como ya lo establece `docs/product/PRODUCT_BACKLOG.md`, a evidencia real de demanda y base de usuarios, no a una fecha de calendario.
