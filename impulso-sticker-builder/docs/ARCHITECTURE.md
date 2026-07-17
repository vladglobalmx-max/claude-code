# Impulso Sticker Builder — Arquitectura (Fase 0, v3)

> Estado: **diseño únicamente**. Ningún código de producto ha sido escrito todavía. Esta v3 introduce la regla arquitectónica más estricta hasta ahora: **Impulso Engine nunca depende directamente de Konva ni de ninguna librería de render.** Todo proyecto se representa en un **Document Schema** propio, y el renderer pasa de ser parte del Engine a ser un adaptador reemplazable. Flujo: `Document Schema → Engine → Renderer → Konva`.

## 0. Alcance y decisiones tomadas hasta ahora

| Pregunta | Decisión |
|---|---|
| Propósito del producto | Solo herramienta de diseño: editor visual que exporta el sticker listo para imprenta (PNG/SVG/PDF con línea de corte). Sin checkout, pagos ni fulfillment. |
| Usuarios (visión de producto, no de Fase 1) | B2C y B2B — pero la Fase 1 **no implementa cuentas ni organizaciones todavía**. |
| Repositorio | Nuevo, separado de este monorepo. Este documento vive aquí solo como registro de la fase de diseño. |
| Concepto arquitectónico central | **Impulso Engine**: núcleo reutilizable (Layers, Assets, Fonts, Export, History, Persistence, Plugins) del que Sticker Builder es el **primer módulo**, no el todo. |
| **Regla dura (nueva, v3)** | El Engine opera **exclusivamente** sobre un **Document Schema** propio, sin ninguna dependencia de una librería de render. El renderer (hoy Konva) es un **adaptador** intercambiable, no el núcleo. Ver §2. |
| Motor de canvas | **Konva.js + react-konva**, pero ahora encapsulado enteramente en `packages/renderer-konva` (ver §1 y §2.1). |
| Alcance técnico de Fase 1 | Editor 100% local, sin backend, sin auth, sin infraestructura distribuida. Persistencia del Document Schema en el navegador (IndexedDB / File System Access API). |
| Explícitamente diferido (no eliminado) | Auth/organizaciones, backend HTTP, base de datos relacional, cola de jobs distribuida, object storage remoto. Se incorporan cuando exista una necesidad real (ver §9). |

---

## 1. Motor de canvas: Fabric.js vs Konva.js

| Criterio | Fabric.js | Konva.js (+ react-konva) |
|---|---|---|
| Modelo de render | Canvas único y plano; cada objeto es un `fabric.Object` con caching interno | Grafo de escena real: `Stage > Layer > Group > Shape`, varios canvases compositados |
| Soporte vectorial/SVG | Nativo (`toSVG()`, import/export SVG de primera clase) | No nativo; las formas guardan su propia geometría, pero exportar a SVG requiere serialización propia |
| Integración con React | Imperativa/mutación directa; wrappers existen pero no son idiomáticos | `react-konva` declarativo y maduro — los nodos son componentes React reales |
| Edición de texto in-canvas | `IText`/`Textbox` editable de fábrica | `Konva.Text` no es editable in-canvas; se resuelve con un `<textarea>` HTML superpuesto |
| Rendimiento en escenas complejas | Un solo canvas — más redibujo del necesario con capas estáticas grandes | Layers independientes permiten aislar contenido estático de interactivo |
| Precedente del mismo tipo de producto | Editores de imagen genéricos | **Polotno SDK** (motor comercial para "construir productos tipo Canva") está construido sobre Konva |
| Encaje como núcleo multi-módulo | Orientado a "una app vectorial autocontenida" | Su modelo de nodos/capas generaliza mejor entre tipos de documento distintos |

**Decisión: Konva.js + react-konva** como implementación del **primer adaptador de Renderer**.

**Nota de alcance (v3):** con la separación Document Schema → Engine → Renderer, esta decisión deja de ser "qué librería usa el Engine" — el Engine no usa ninguna. Es estrictamente "con qué librería se construye `packages/renderer-konva`, el primer adaptador". El razonamiento de la tabla sigue siendo válido para esa elección puntual; lo que cambia es que ahora está formalmente aislada del núcleo (§2).

---

## 2. Impulso Engine y el límite Document Schema → Engine → Renderer

**Sticker Builder no es "el producto"; es el primer módulo construido sobre Impulso Engine.** Y el Engine, a su vez, no es "el editor" — es lógica pura sobre datos. Dibujar en pantalla es responsabilidad de una tercera pieza, el Renderer, que el Engine ni siquiera conoce por nombre.

### 2.1 Tres niveles, una sola dirección de dependencia

```
Document Schema   →   Engine   →   Renderer (adaptador)   →   Konva (hoy)
   (datos puros)      (lógica)         (traductor visual)        (librería concreta)
```

- **Document Schema** (`packages/document-schema`) — la única fuente de verdad de un proyecto. Tipos + validación (Zod), **cero dependencias de render, de React o de Konva**. Es literalmente lo que se guarda en IndexedDB o en un archivo `.impulso.json`, y lo que viaja entre Engine y cualquier Renderer.
- **Engine** (`packages/engine`) — opera exclusivamente sobre el Document Schema: capas, historial, assets, fuentes, exportación, plugins. **No sabe dibujar nada.** Define un contrato (`RendererAdapter`, §2.2) que cualquier motor de render debe cumplir, y solo habla con ese contrato — nunca con Konva directamente.
- **Renderer** (`packages/renderer-konva` hoy) — implementación concreta del contrato usando Konva/react-konva. Traduce el Document Schema (vía Engine) en nodos Konva reales, y traduce eventos de puntero/arrastre/redimensionado de vuelta en llamadas al Engine, que es quien realmente muta el documento (con historial incluido).

**Regla dura:** `packages/engine/package.json` **no tiene a Konva (ni ninguna librería de render) como dependencia.** Si mañana se agrega `renderer-pixi` o `renderer-svg`, el Engine no cambia una sola línea — solo se conecta un adaptador distinto.

### 2.2 El contrato `RendererAdapter` (boceto conceptual, no código final)

```
RendererAdapter {
  mount(container): void
  render(document: ImpulsoDocument, selection: string[]): void
  on(event: 'nodeTransformed' | 'nodeSelected' | 'pointerDown' | ..., handler): Unsubscribe
  destroy(): void
}
```

El Engine llama a `render(...)` cada vez que el Document Schema cambia. El Renderer nunca muta el documento por su cuenta: cuando el usuario arrastra o redimensiona algo, el Renderer traduce ese gesto en una llamada a un método del Engine (ej. `engine.transformLayer(id, patch)`), y es el Engine quien aplica el cambio al Document Schema y registra el paso en el historial. Esto centraliza undo/redo y validación de datos en un solo lugar, sin importar qué Renderer esté conectado.

### 2.3 Subsistemas, reasignados a su nivel correcto

| Subsistema | Vive en | Responsabilidad |
|---|---|---|
| Esquema y validación del documento | **Document Schema** | Tipos + reglas de forma válida; cero dependencias de render |
| Layers | **Engine** | Árbol de capas/grupos y operaciones (mover, agrupar, ordenar) sobre el Document Schema |
| Selección y comandos de transformación | **Engine** | Qué capas están seleccionadas, y comandos (`transformLayer`, `moveLayer`...) que mutan el documento con historial — sin dibujar nada |
| Assets | **Engine** | Import/almacenamiento local de imágenes/íconos, referenciados desde el Document Schema (no dibujados) |
| Fonts | **Engine** | Catálogo de tipografías disponibles/subidas |
| History | **Engine** | Undo/redo (patrón comando) sobre el Document Schema |
| Export (core) | **Engine** | Exportadores que leen el Document Schema directamente — **SVG/PDF no necesitan al Renderer en absoluto** (ver §2.5) |
| Persistence | **Engine** | `StorageProvider`: guardar/cargar el Document Schema |
| Registro de plugins | **Engine** | Qué tipos de forma/exportadores/paneles existen (ver §2.4) |
| Viewport (zoom/pan) | **Renderer** | Puramente visual — no es parte del documento |
| Dibujo de selección, asas de resize/rotate | **Renderer** | Interacción visual concreta con Konva |
| Mapeo nodo del Document Schema → nodo Konva | **Renderer** | Traducción; el tipo de dato en sí es agnóstico a Konva |

### 2.4 Plugins: dos mitades, no una

Un plugin de módulo (ej. Sticker Builder) ya no se registra en un solo lugar — se registra en el nivel que le corresponde:

```
ImpulsoPlugin {
  id: string
  registerShapeTypes?(schemaRegistry)     // Engine: esquema/validación/valores por defecto
  registerExporters?(exportRegistry)      // Engine: lee el Document Schema directamente
  registerToolPanels?(uiRegistry)         // App: UI específica del módulo
  registerRendererBindings?(rendererRegistry, rendererId)
    // SOLO si el tipo de forma no puede expresarse con los nodos primitivos
    // que todo Renderer ya soporta (rect, ellipse, path, text, image, group)
}
```

**Ejemplo concreto — la forma "die-cut" de Sticker Builder:** a nivel de Document Schema es, en realidad, un nodo `path` cerrado con un metadato `role: 'die-line'`. Cualquier Renderer que ya sepa dibujar un `path` con trazo punteado puede renderizarla **sin ningún binding específico**. Solo se necesitaría `registerRendererBindings` si un plugin futuro inventara un comportamiento visual genuinamente nuevo que ningún nodo primitivo pueda expresar — el caso excepcional, no la regla. Esto es lo que mantiene honesta la promesa de "cambiar el renderer sin romper proyectos": la mayoría de los plugins nunca tocan código específico de Konva.

### 2.5 Por qué la exportación casi nunca necesita al Renderer

- **SVG y PDF** (el caso que más importa para impresión) se generan leyendo el Document Schema directamente en el Engine y serializando a paths/vectores — nunca pasan por Konva. Esto es, de hecho, la prueba de que la separación funciona: si el exportador vectorial dependiera de `canvas.toSVG()` o de cualquier API de una librería de render, el Document Schema no sería realmente la fuente de verdad.
- **PNG** (raster) es la única excepción real: para producir píxeles hace falta pedirle al Renderer actualmente conectado que rasterice el documento (ej. `konvaRenderer.renderToImage()`). Sigue pasando por el contrato `RendererAdapter`, no por un acceso directo a Konva desde el Engine.

### Por qué esta separación importa desde ya (y no "cuando haga falta")

Trazar la línea Document Schema / Engine / Renderer es mucho más caro como refactor que como diseño inicial: en cuanto se escribe la primera línea de `packages/engine` importando algo de Konva "solo para esta vez", la separación deja de ser real. Definir el contrato `RendererAdapter` antes de escribir código de Fase 1 es precisamente lo que permite construir el editor ya, sin pagar ese costo después.

---

## 3. Tecnologías — Fase 1 (editor local, sin infraestructura de servidor)

### Frontend
- **React 18 + TypeScript**
- **Vite**: sin backend, sin auth, sin páginas de marketing que necesiten SSR/SEO en esta fase, un SPA con Vite da un loop de desarrollo más simple para un editor de canvas.
- **Konva.js + react-konva** — usados **únicamente dentro de `packages/renderer-konva`**; ningún otro paquete los importa (ver §2).
- **Zustand + Immer** dentro del Engine, para el estado del Document Schema y el historial undo/redo.
- **Tailwind CSS** para la UI de paneles/toolbars (capa de aplicación, no el Engine ni el Renderer).
- **Radix UI** (headless) para primitivos accesibles: menús, popovers, sliders de color.

### Persistencia (100% local, sin backend)
- **IndexedDB** (via `idb`) detrás de la interfaz `StorageProvider` del Engine — guarda el Document Schema, assets (blobs) y fuentes subidas.
- **File System Access API** (con fallback a descarga): "Guardar como..." / "Abrir..." un archivo `.impulso.json` (el Document Schema serializado) en disco.

### Procesamiento gráfico (100% cliente, sin servidor)
- **Web Worker nativo del navegador** para no bloquear la UI durante cómputos pesados: tracing de imágenes y ensamblado de PDF.
- **imagetracerjs**: tracing raster → vector en el navegador.
- **js-angusj-clipper** (Clipper a WASM): offsetting de polígonos para la línea de corte — vive en el **plugin de Sticker Builder**, opera sobre el Document Schema, no sobre Konva.
- **pdf-lib**: ensamblado del PDF final en el navegador, leyendo el Document Schema directamente.

### Calidad y CI
- **Vitest + Testing Library** — el Engine y el Document Schema, al no depender de render, son trivialmente testeables sin un DOM/canvas real.
- **Playwright** para e2e del editor completo (Engine + Renderer + UI).
- **GitHub Actions** para CI. Deploy: sitio estático — no hay nada que corra en servidor todavía.

### Explícitamente diferido (no se instala en Fase 1)
Clerk/Auth.js, NestJS, Prisma, PostgreSQL, Redis, BullMQ, S3/R2, Sentry/PostHog server-side (ver §9).

---

## 4. Estructura de carpetas

```
impulso-engine/                       # nombre tentativo del repo real (a definir)
├── apps/
│   └── sticker-builder/              # primer módulo — compone engine + renderer-konva
│       └── src/
│           ├── main.tsx              # entrypoint Vite
│           ├── app/                  # shell de la app (toolbar, paneles, layout)
│           └── plugin/                # el plugin "sticker-builder"
│               ├── shapes/            # definición a nivel Document Schema (die-cut)
│               ├── exporters/         # print-ready-pdf: lee el Document Schema directamente
│               └── panels/            # tamaños/materiales de sticker (UI)
├── packages/
│   ├── document-schema/              # ← fuente de verdad, sin dependencias de render
│   │   └── src/
│   │       ├── types/                 # ImpulsoDocument, Layer, geometry, estilos
│   │       ├── validation/            # esquemas Zod
│   │       └── migrations/            # versionado del schema entre releases
│   ├── engine/                        # ← Impulso Engine — sin Konva en package.json
│   │   └── src/
│   │       ├── layers/                # operaciones sobre el árbol de capas
│   │       ├── selection/             # selección + comandos de transformación
│   │       ├── history/               # undo/redo (patrón comando)
│   │       ├── assets/                # import/gestión de assets
│   │       ├── fonts/                 # carga/gestión de tipografías
│   │       ├── export/                # exportadores core (PNG/SVG), extensibles por plugin
│   │       ├── persistence/           # StorageProvider (interfaz) + IndexedDBProvider
│   │       ├── plugins/               # registro de plugins (mitad Engine, ver §2.4)
│   │       └── renderer-contract/     # el tipo `RendererAdapter` — el único "puente" definido
│   ├── renderer-konva/                # ← el ÚNICO paquete que importa Konva/react-konva
│   │   └── src/
│   │       ├── adapter.ts             # implementa RendererAdapter
│   │       ├── nodes/                 # mapeo Document Schema node → nodo Konva por tipo
│   │       └── interactions/          # viewport, selección visual, transformer
│   ├── ui/                            # design system compartido entre módulos futuros
│   └── config/                        # eslint/tsconfig/tailwind compartidos
├── docs/
│   └── ARCHITECTURE.md
├── turbo.json
└── pnpm-workspace.yaml
```

Se conserva pnpm workspaces + Turborepo. La novedad de v3 es la separación física `document-schema` / `engine` / `renderer-konva` en tres paquetes — no dos —, precisamente para que un `import` accidental de Konva dentro de `engine` sea un error de build (paquete no declarado), no solo una convención de nombres.

---

## 5. Componentes principales

### Document Schema (dato puro)
- Tipos de `ImpulsoDocument`, `Layer` y geometría/estilo asociados.
- Validación (Zod) y migraciones de versión del schema.

### Engine (lógica, sin render)
- **Layers** — árbol de capas/grupos y sus operaciones.
- **Selection & Transform commands** — qué está seleccionado y comandos de transformación con historial.
- **Assets** — biblioteca de imágenes/íconos subidos, referenciados por el documento.
- **Fonts** — catálogo de tipografías.
- **History** — undo/redo persistido en memoria durante la sesión.
- **Export (core)** — exportadores que leen el Document Schema (PNG vía Renderer, SVG directo).
- **Persistence** — `StorageProvider` (IndexedDB hoy).
- **Registro de plugins y del contrato `RendererAdapter`.**

### Renderer (adaptador, hoy Konva)
- Mapeo de nodos primitivos del Document Schema a nodos Konva.
- Viewport (zoom/pan), dibujo de selección, asas de transformación.
- Traducción de eventos de puntero a llamadas al Engine.

### Sticker Builder (plugin sobre el Engine)
- **Die-cut shape** — definida a nivel Document Schema (path + `role: 'die-line'`); no requiere binding de Renderer (§2.4).
- **Print-ready PDF exporter** — lee el Document Schema, calcula el offset (Clipper) y ensambla el PDF (pdf-lib).
- **Panel de especificación de sticker** — tamaño físico, forma, sangrado, material.

---

## 6. Flujo del usuario (Fase 1 — sin cuentas)

Sin login ni organizaciones todavía: el "workspace" es implícito y local al navegador/dispositivo.

**Flujo único (Fase 1):**
Abrir la app → elegir plantilla o lienzo en blanco → definir tamaño/forma del sticker → diseñar (formas/texto/imágenes) → previsualizar con guías de sangrado y línea de corte → exportar (PNG/SVG/PDF) → el proyecto (Document Schema) queda guardado automáticamente en IndexedDB; opcionalmente "Guardar como..." a un archivo local.

**Usuario recurrente (mismo dispositivo/navegador):**
Abrir la app → lista de proyectos guardados localmente → continuar editando → exportar de nuevo.

Los flujos B2C/B2B "con cuenta" siguen siendo la visión de producto, pero no se implementan hasta que exista un `RemoteApiProvider` para `Persistence` (§9).

---

## 7. Modelo de datos — el Document Schema (Fase 1, local)

Todo vive en **IndexedDB del navegador**, detrás de `StorageProvider`. El Document Schema es el mismo dato sin importar qué Renderer esté conectado.

```
Project
  id, name, moduleId ('sticker-builder'), createdAt, updatedAt,
  document (ImpulsoDocument), thumbnailDataUrl

ImpulsoDocument                  # el "Document Schema" propiamente dicho
  schemaVersion,
  canvasSize { width, height, unit },
  layers: Layer[]

Layer
  id, type ('rect' | 'ellipse' | 'path' | 'text' | 'image' | 'group'),
  role?,                         # ej. 'die-line' — metadato de plugin, no un tipo de nodo nuevo
  geometry, style, children?     # children solo si type === 'group'

Asset
  id, name, blob, mimeType, width, height

FontAsset
  id, family, source ('system' | 'uploaded'), blob?

StickerSpec                      # metadatos del plugin, no del Engine ni del Document Schema base
  projectId, shape ('circle'|'rect'|'custom'),
  widthMm, heightMm, bleedMm, dieLineLayerId, material
```

**Nota clave (v3):** `Layer.type` se restringe a un set pequeño y genérico de primitivas (`rect`, `ellipse`, `path`, `text`, `image`, `group`) que **cualquier** Renderer debe saber dibujar. Comportamientos específicos de módulo (como "esta capa es la línea de corte") se expresan con el campo `role`, no inventando tipos de nodo nuevos por módulo — así el Document Schema sigue siendo universal entre Sticker Builder, Planner Builder, etc.

**Por qué `StorageProvider` como interfaz:** el día que se necesite sincronizar entre dispositivos, se implementa un `RemoteApiProvider` que guarda/lee el mismo `ImpulsoDocument` — el Engine no cambia.

---

## 8. Explicación técnica — decisiones clave y su porqué

1. **Document Schema → Engine → Renderer → Konva, con dependencia en una sola dirección.** Es la aplicación de un patrón de puertos y adaptadores (arquitectura hexagonal) al problema específico de "¿qué pasa si mañana cambiamos de librería de canvas?". El Engine define el puerto (`RendererAdapter`); Konva es el primer adaptador, no una parte del núcleo. El costo es escribir un contrato explícito antes de tener una sola pantalla funcionando; el beneficio es que un cambio de librería de render — o agregar un renderer alterno para un caso especial (ej. exportar headless en un entorno sin DOM) — no toca `packages/engine` ni invalida proyectos guardados.

2. **Konva.js como implementación del primer adaptador** — ver razonamiento completo en §1, ahora explícitamente acotado a `packages/renderer-konva`.

3. **Los tipos de nodo del Document Schema son deliberadamente pocos y genéricos** (rect/ellipse/path/text/image/group), y lo específico de un módulo se modela con metadatos (`role`) sobre esos tipos, no con tipos nuevos. Esto es lo que hace que la mayoría de los plugins no necesiten un binding de Renderer (§2.4) y que el mismo Document Schema sirva para Sticker Builder, Planner Builder o Coloring Book Builder sin ramificarse.

4. **La exportación vectorial (SVG/PDF) lee el Document Schema directamente, nunca Konva.** Es la prueba de que la separación es real y no solo documental: si el exportador dependiera de una API de la librería de render, el Document Schema no sería la fuente de verdad. Solo el export raster (PNG) pasa por el Renderer, y lo hace a través del mismo contrato `RendererAdapter`, no por acceso directo a Konva desde el Engine.

5. **Impulso Engine como núcleo, Sticker Builder como plugin.** Obliga a que Layers/Assets/Fonts/History/Export/Persistence se diseñen sin conocimiento de "qué es un sticker". El beneficio es que Planner Builder o Coloring Book Builder no requieren reescribir el editor — solo agregan otro plugin.

6. **Vite en vez de Next.js para Fase 1.** Sin backend ni auth que justifiquen SSR, un SPA con Vite es más simple de iterar. Next.js puede volver para marketing más adelante, sin tocar el editor.

7. **Todo el pipeline de exportación corre en el navegador (Web Worker), no en un servidor.** El cómputo pesado (tracing, offset, ensamblado de PDF) se mueve a un Web Worker nativo — suficiente para mantener la UI responsiva sin infraestructura alguna.

8. **`StorageProvider` como abstracción desde ya:** no añade infraestructura hoy, pero evita que auth/sync (diferidos en §9) obliguen a reescribir cómo el Engine guarda y lee el Document Schema.

---

## 9. Diferido (no eliminado) — se incorpora cuando haya una necesidad real

| Tecnología/capacidad | Se incorpora cuando... |
|---|---|
| Auth (Clerk/Auth.js) | Se necesite identificar usuarios entre sesiones/dispositivos. |
| Organizaciones/equipos | Exista un caso de uso B2B real de colaboración. |
| Backend HTTP | El `RemoteApiProvider` de `Persistence` necesite un servidor real detrás. |
| PostgreSQL | Exista almacenamiento server-side (viene junto con el backend HTTP). |
| Redis + BullMQ | El export deje de poder resolverse en un Web Worker del navegador. |
| S3/R2 | Los assets/exports necesiten vivir fuera del navegador del usuario. |
| Renderers adicionales (Pixi, SVG-only, headless...) | Exista un caso de uso concreto (ej. export headless en servidor, o necesidad real de performance) — el contrato `RendererAdapter` ya lo permite sin rediseño, pero no se construye especulativamente. |
| Checkout, fulfillment, white-label | Sin cambios — fuera de alcance de este módulo. |

---

## 10. Explícitamente fuera de alcance de este módulo

- Checkout, pagos, carritos de compra.
- Integración con proveedores de impresión / fulfillment.
- Modo embebido / white-label para terceros.
- Cualquier módulo de "Impulso Builder Platform" distinto a Sticker Builder.
- Un segundo Renderer real (Pixi, SVG-only, etc.) — el contrato lo permite, pero no se construye en Fase 1.
- Todo lo listado en §9, hasta que exista necesidad real.

---

## 11. Siguiente paso

Este documento (v3) cierra la ronda de ajustes de Fase 0. La **Fase 1** — `packages/document-schema` mínimo, `packages/engine` mínimo (Layers + Selection + History detrás del contrato `RendererAdapter`), `packages/renderer-konva` como primer adaptador, y el primer recorrido funcional de Sticker Builder sobre esa base — no comienza automáticamente; se espera confirmación explícita antes de escribir la primera línea de código.
