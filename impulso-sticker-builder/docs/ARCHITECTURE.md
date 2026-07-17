# Impulso Sticker Builder — Arquitectura (Fase 0, v2)

> Estado: **diseño únicamente**. Ningún código de producto ha sido escrito todavía. Este documento reemplaza la v1 tras la ronda de ajustes de modularidad: introduce **Impulso Engine** como núcleo reutilizable, recorta la stack a lo estrictamente necesario para un editor local, y resuelve Canvas: Fabric.js vs Konva.js.

## 0. Alcance y decisiones tomadas hasta ahora

| Pregunta | Decisión |
|---|---|
| Propósito del producto | Solo herramienta de diseño: editor visual que exporta el sticker listo para imprenta (PNG/SVG/PDF con línea de corte). Sin checkout, pagos ni fulfillment. |
| Usuarios (visión de producto, no de Fase 1) | B2C y B2B — pero la Fase 1 **no implementa cuentas ni organizaciones todavía** (ver §2). |
| Repositorio | Nuevo, separado de este monorepo. Este documento vive aquí solo como registro de la fase de diseño. |
| **Concepto arquitectónico central (nuevo)** | **Impulso Engine**: un núcleo reutilizable (Canvas, Layers, Assets, Fonts, Export, History, Plugins) del que Sticker Builder es el **primer módulo**, no el todo. Módulos futuros (Planner Builder, Coloring Book Builder) se construyen sobre el mismo Engine sin duplicar lógica. |
| Motor de canvas | **Konva.js + react-konva** (ver §1 — comparación completa). |
| Alcance técnico de Fase 1 | **Editor 100% local**, sin backend, sin auth, sin infraestructura distribuida. Persistencia en el navegador (IndexedDB / File System Access API). |
| Explícitamente diferido (no eliminado) | Auth/organizaciones (Clerk o similar), backend HTTP (NestJS o similar), base de datos relacional (Postgres), cola de jobs distribuida (Redis/BullMQ), object storage remoto (S3/R2). Se incorporan **cuando exista una necesidad real** (ver §9). |

---

## 1. Motor de canvas: Fabric.js vs Konva.js

| Criterio | Fabric.js | Konva.js (+ react-konva) |
|---|---|---|
| Modelo de render | Canvas único y plano; cada objeto es un `fabric.Object` con caching interno | Grafo de escena real: `Stage > Layer > Group > Shape`, varios canvases compositados |
| Soporte vectorial/SVG | Nativo (`toSVG()`, import/export SVG de primera clase) | No nativo; las formas guardan su propia geometría (radio, puntos, `Konva.Path` con `data` SVG), pero exportar a SVG requiere serialización propia |
| Integración con React | Imperativa/mutación directa; wrappers existen pero no son idiomáticos | `react-konva` declarativo y maduro — los nodos son componentes React reales |
| Edición de texto in-canvas | `IText`/`Textbox` editable de fábrica | `Konva.Text` no es editable in-canvas; se resuelve con un `<textarea>` HTML superpuesto (patrón conocido, no trivial) |
| Rendimiento en escenas complejas | Un solo canvas — más redibujo del necesario con capas estáticas grandes | Layers independientes permiten aislar contenido estático de interactivo — mejor techo a futuro |
| Precedente del mismo tipo de producto | Editores de imagen genéricos | **Polotno SDK** (motor comercial para "construir productos tipo Canva", el mismo género que Impulso Engine) está construido sobre Konva |
| Encaje como núcleo multi-módulo | Orientado a "una app vectorial autocontenida" | Su modelo de nodos/capas generaliza mejor entre tipos de documento distintos (sticker, planner, coloring book) |

**Decisión: Konva.js + react-konva.**

La ventaja nativa de Fabric (export SVG) pesa menos de lo que parece porque el Engine posee su **propio esquema canónico de documento** (posiciones, geometría, estilos por capa), independiente del runtime de la librería de render — el exportador SVG/PDF siempre se construyó para leer ese esquema, no `canvas.toSVG()`. Elegir Konva no cambia el pipeline de exportación; solo confirma que el Engine no debe depender del formato nativo de ninguna librería.

Lo que sí inclina la balanza: Konva generaliza mejor como *scene graph* reutilizable entre módulos futuros, `react-konva` combina mejor con una arquitectura de componentes/plugins, y Polotno es un precedente comercial directo del mismo tipo de producto. El costo aceptado (texto in-canvas y export SVG requieren capa propia) es trabajo que el Engine ya iba a construir de todas formas.

---

## 2. Impulso Engine — el concepto central

**Sticker Builder no es "el producto"; es el primer módulo construido sobre Impulso Engine.** Esta distinción es la que más condiciona la carpeta, el empaquetado y casi todas las decisiones de abajo.

El Engine contiene **toda la lógica de editor que no es específica de un tipo de documento**:

| Subsistema del Engine | Responsabilidad | Ejemplo de lo que NO va aquí |
|---|---|---|
| **Canvas** | Wrapper sobre Konva: Stage, viewport (zoom/pan), selección, transformador (resize/rotate) | La forma "die-cut" en sí — eso es específico de Sticker Builder |
| **Layers** | Esquema canónico del documento (árbol de capas/grupos), independiente del runtime de Konva; operaciones de mover/agrupar/ordenar | Reglas de negocio de un módulo (ej. tamaños de sticker estándar) |
| **Assets** | Import, almacenamiento local y miniaturas de imágenes/íconos subidos por el usuario | Biblioteca de clipart curada de un módulo específico |
| **Fonts** | Carga y gestión de tipografías (web fonts + fuentes subidas vía `FontFace` API) | — |
| **History** | Undo/redo genérico (patrón comando sobre el documento de `Layers`) | — |
| **Export** | Pipeline de exportación pluggable (PNG/SVG por defecto); cada módulo registra sus propios exportadores especializados | El exportador de PDF con línea de corte (die-line) — eso lo registra el **módulo** Sticker Builder, no el Engine |
| **Persistence** | Interfaz `StorageProvider` (guardar/cargar/listar proyectos) con implementación local (IndexedDB) hoy; una futura `RemoteApiProvider` implementará la misma interfaz sin tocar el resto del Engine | Concepto de "organización" o "usuario" — eso vendrá con el provider remoto, no antes |
| **Plugins** | Mecanismo de registro para que cada módulo extienda el Engine sin modificarlo: tipos de forma, exportadores, paneles de herramientas, proveedores de assets | — |

### Contrato de plugin (boceto conceptual, no código final)

```
ImpulsoPlugin {
  id: string
  registerShapeTypes?(registry)      // ej. Sticker Builder registra "die-cut-shape"
  registerExporters?(registry)       // ej. Sticker Builder registra "print-ready-pdf"
  registerToolPanels?(registry)      // ej. panel de "tamaños de sticker"
  registerAssetProviders?(registry)  // ej. biblioteca de plantillas de sticker
}
```

Sticker Builder se implementa como **un plugin que consume el Engine**, no como código mezclado con él. Un futuro Planner Builder o Coloring Book Builder sería otro plugin distinto, reutilizando Canvas/Layers/Assets/Fonts/History/Export/Persistence tal cual.

### Por qué esta separación importa desde ya (y no "cuando haga falta")

Retrasar la separación Engine/módulo sería más caro que adelantarla: la línea entre "qué es genérico" y "qué es de sticker" hay que trazarla *mientras se escribe* cada subsistema (Canvas, Layers, Export...), no después por refactor. Construir directamente sobre `packages/engine` desde la Fase 1, aunque hoy solo exista un módulo, evita reescribir el 80% del editor cuando llegue el segundo.

---

## 3. Tecnologías — Fase 1 (editor local, sin infraestructura de servidor)

### Frontend
- **React 18 + TypeScript**
- **Vite** (no Next.js todavía): sin backend, sin auth, sin páginas de marketing que necesiten SSR/SEO en esta fase, un SPA con Vite da un loop de desarrollo más simple y rápido para un editor de canvas. Next.js puede reintroducirse más adelante *solo* para el sitio de marketing, sin forzarlo hoy sobre el editor.
- **Konva.js + react-konva** (ver §1).
- **Zustand + Immer** para el estado del documento y el historial undo/redo.
- **Tailwind CSS** para la UI de paneles/toolbars (no para el canvas).
- **Radix UI** (headless) para primitivos accesibles: menús, popovers, sliders de color.

### Persistencia (100% local, sin backend)
- **IndexedDB** (via `idb`) detrás de la interfaz `StorageProvider` del Engine — guarda proyectos, assets (como blobs) y fuentes subidas, todo en el navegador.
- **File System Access API** (donde el navegador lo soporte, con fallback a descarga de archivo): permite "Guardar como..." / "Abrir..." un archivo `.impulso.json` en disco, dando sensación de app de escritorio sin dejar de ser una web app.

### Procesamiento gráfico (100% cliente, sin servidor)
- **Web Worker nativo del navegador** (no cola distribuida) para no bloquear el hilo de UI durante cómputos pesados: tracing de imágenes y ensamblado de PDF.
- **imagetracerjs**: tracing raster → vector en el navegador (alternativa a potrace, que es Node-oriented).
- **js-angusj-clipper** (Clipper compilado a WASM): offsetting de polígonos para generar la línea de corte — vive dentro del **plugin de Sticker Builder**, no en el Engine (solo stickers necesitan die-cut).
- **pdf-lib**: ensamblado del PDF final en el navegador (capas de arte + línea de corte, fuentes embebidas).

### Calidad y CI
- **Vitest + Testing Library**.
- **Playwright** para e2e del editor (arrastrar, redimensionar, exportar).
- **GitHub Actions** para CI. Deploy: sitio estático (Vercel/Netlify/Cloudflare Pages) — no hay nada que corra en servidor todavía.

### Explícitamente diferido (no se instala en Fase 1)
Clerk/Auth.js, NestJS, Prisma, PostgreSQL, Redis, BullMQ, S3/R2, Sentry/PostHog server-side. Se incorporan cuando exista una necesidad real de sincronizar entre dispositivos, colaborar en equipo o vender — no antes (ver §9).

---

## 4. Estructura de carpetas

```
impulso-engine/                       # nombre tentativo del repo real (a definir)
├── apps/
│   └── sticker-builder/              # primer módulo — consume packages/engine
│       └── src/
│           ├── main.tsx              # entrypoint Vite
│           ├── app/                  # shell de la app (toolbar, paneles, layout)
│           └── plugin/               # el plugin "sticker-builder" en sí
│               ├── shapes/           # die-cut shape type
│               ├── exporters/        # print-ready-pdf exporter (usa clipper + pdf-lib)
│               └── panels/           # panel de tamaños/materiales de sticker
├── packages/
│   ├── engine/                       # ← Impulso Engine
│   │   └── src/
│   │       ├── canvas/               # wrapper sobre Konva: Stage, viewport, selección
│   │       ├── layers/               # esquema canónico del documento + operaciones
│   │       ├── assets/               # import/gestión de assets (IndexedDB-backed)
│   │       ├── fonts/                # carga/gestión de tipografías
│   │       ├── history/              # undo/redo (patrón comando)
│   │       ├── export/               # pipeline de exportación, extensible por plugin
│   │       ├── persistence/          # StorageProvider (interfaz) + IndexedDBProvider
│   │       ├── plugins/              # sistema de registro de plugins
│   │       └── types/                # tipos/esquemas compartidos del documento
│   ├── ui/                           # design system compartido entre módulos futuros
│   └── config/                       # eslint/tsconfig/tailwind compartidos
├── docs/
│   └── ARCHITECTURE.md
├── turbo.json
└── pnpm-workspace.yaml
```

Se conserva el monorepo con **pnpm workspaces + Turborepo** ya decidido en v1 — sigue siendo la pieza correcta para que `packages/engine` quede aislado desde el día uno, incluso con un único módulo (`apps/sticker-builder`) consumiéndolo.

---

## 5. Componentes principales

Reorganizados por dónde viven (Engine vs módulo Sticker Builder):

### Del Engine (reutilizable, sin conocimiento de "sticker")
- **Canvas** — superficie interactiva: selección, transformar, zoom/pan.
- **Layers** — árbol de capas/grupos y sus operaciones (mover, agrupar, ordenar, alinear).
- **Assets** — biblioteca de imágenes/íconos subidos, con miniaturas.
- **Fonts** — catálogo de tipografías disponibles y subidas por el usuario.
- **History** — undo/redo persistido en memoria durante la sesión.
- **Export (core)** — exportadores genéricos: PNG, SVG plano.
- **Persistence** — guardar/cargar proyectos localmente (IndexedDB + archivo local opcional).
- **Plugins** — registro de extensiones de módulo.

### Del módulo Sticker Builder (plugin sobre el Engine)
- **Die-cut shape type** — forma con contorno de corte (auto por offset, o editable a mano).
- **Print-ready PDF exporter** — combina el documento del Engine + la línea de corte del plugin en un PDF listo para imprenta.
- **Panel de especificación de sticker** — tamaño físico, forma, sangrado, material (metadatos que no le importan al Engine).

---

## 6. Flujo del usuario (Fase 1 — sin cuentas)

Sin login ni organizaciones todavía: el "workspace" es implícito y local al navegador/dispositivo.

**Flujo único (Fase 1):**
Abrir la app → elegir plantilla o lienzo en blanco → definir tamaño/forma del sticker → diseñar (formas/texto/imágenes) → previsualizar con guías de sangrado y línea de corte → exportar (PNG/SVG/PDF) → el proyecto queda guardado automáticamente en el navegador (IndexedDB); opcionalmente "Guardar como..." a un archivo local.

**Usuario recurrente (mismo dispositivo/navegador):**
Abrir la app → lista de proyectos guardados localmente → continuar editando → exportar de nuevo.

Los flujos B2C/B2B "con cuenta" descritos en v1 siguen siendo la visión de producto, pero **no se implementan hasta que exista un `RemoteApiProvider`** para `Persistence` (ver §9) — hasta entonces no hay nada que distinga a un usuario B2C de uno B2B a nivel de sistema.

---

## 7. Modelo de datos (Fase 1 — local, sin servidor)

Todo vive en **IndexedDB del navegador**, detrás de la interfaz `StorageProvider` del Engine. Sin `User`, sin `Organization`, sin tablas relacionales — son conceptos que llegan con el futuro `RemoteApiProvider`, no antes.

```
Project
  id, name, moduleId ('sticker-builder'), createdAt, updatedAt,
  document (LayersDocument), thumbnailDataUrl

LayersDocument
  canvasSize { width, height, unit },
  layers: Layer[]

Layer
  id, type ('shape' | 'text' | 'image' | 'group' | 'sticker-die-cut'),
  geometry, style, children?  # children solo si type === 'group'

Asset
  id, name, blob, mimeType, width, height

FontAsset
  id, family, source ('system' | 'uploaded'), blob?

StickerSpec                    # metadatos del plugin, no del Engine
  projectId, shape ('circle'|'rect'|'custom'),
  widthMm, heightMm, bleedMm, dieLineSvg, material
```

**Por qué la interfaz `StorageProvider` en vez de código de IndexedDB disperso:** el día que se necesite sincronizar entre dispositivos o colaborar en equipo, se implementa un `RemoteApiProvider` que cumple la misma interfaz — el Engine y el módulo Sticker Builder no se enteran de dónde vive el dato. Esto evita que "no tener backend hoy" se convierta en una migración dolorosa mañana.

---

## 8. Explicación técnica — decisiones clave y su porqué

1. **Impulso Engine como núcleo, Sticker Builder como plugin.** Es la decisión que más impacta el resto: obliga a que Canvas/Layers/Assets/Fonts/History/Export/Persistence se diseñen sin conocimiento de "qué es un sticker", y que todo lo específico (die-cut, tamaños físicos, exportador PDF de impresión) viva detrás de un contrato de plugin. El costo es algo más de disciplina arquitectónica desde ya; el beneficio es que Planner Builder o Coloring Book Builder no requieren reescribir el editor.

2. **Konva.js sobre Fabric.js** — ver razonamiento completo en §1. Resumen: mejor generalización como *scene graph* reutilizable entre módulos, mejores bindings de React, precedente comercial directo (Polotno) en el mismo género de producto.

3. **Vite en vez de Next.js para Fase 1.** Next.js se justificaba en v1 por SSR de marketing/auth — ninguno de los dos existe todavía. Un SPA con Vite es más simple y rápido de iterar para un editor de canvas puro. No es una decisión permanente: Next.js puede volver para el sitio de marketing cuando exista, sin tocar el editor.

4. **Todo el pipeline de exportación corre en el navegador (Web Worker), no en un servidor.** Al eliminar backend/cola/worker distribuido de esta fase, el cómputo pesado (tracing, offset, ensamblado de PDF) se mueve a un Web Worker nativo del navegador — suficiente para mantener la UI responsiva sin necesitar infraestructura alguna. Esto es una app 100% estática desplegable en cualquier CDN.

5. **`StorageProvider` como abstracción desde ya, aunque hoy solo tenga una implementación local.** Es la única pieza de "preparación para el futuro" que se justifica mantener en Fase 1: no añade infraestructura hoy, pero evita que auth/organizaciones/sync (diferidos en §9) obliguen a reescribir cómo el Engine guarda y lee proyectos.

6. **Vector-first se mantiene sin cambios respecto a v1.** Un sticker físico necesita una línea de corte geométricamente exacta; por eso el Engine trabaja sobre un esquema canónico de capas (no píxeles) y el plugin de Sticker Builder construye el die-line sobre ese esquema, no sobre una reconstrucción posterior de un canvas raster.

---

## 9. Diferido (no eliminado) — se incorpora cuando haya una necesidad real

| Tecnología/capacidad | Se incorpora cuando... |
|---|---|
| Auth (Clerk/Auth.js) | Se necesite identificar usuarios entre sesiones/dispositivos — ej. para sincronizar proyectos. |
| Organizaciones/equipos | Exista un caso de uso B2B real de colaboración (no solo "lo pidió el roadmap"). |
| Backend HTTP (NestJS o similar) | El `RemoteApiProvider` de `Persistence` necesite un servidor real detrás. |
| PostgreSQL | Exista almacenamiento server-side (viene junto con el backend HTTP). |
| Redis + BullMQ | El export deje de poder resolverse en un Web Worker del navegador (ej. renders batch server-side para cuentas de equipo). |
| S3/R2 | Los assets/exports necesiten vivir fuera del navegador del usuario. |
| Checkout, fulfillment, white-label | Sin cambios respecto a v1 — fuera de alcance de este módulo. |

---

## 10. Explícitamente fuera de alcance de este módulo

- Checkout, pagos, carritos de compra.
- Integración con proveedores de impresión / fulfillment.
- Modo embebido / white-label para terceros.
- Cualquier módulo de "Impulso Builder Platform" distinto a Sticker Builder.
- Todo lo listado en §9, hasta que exista necesidad real.

---

## 11. Siguiente paso

Este documento (v2) cierra la ronda de ajustes de Fase 0. La **Fase 1** — construir el Engine mínimo (`packages/engine`: Canvas + Layers + History) y el primer recorrido funcional de Sticker Builder sobre él — no comienza automáticamente; se espera confirmación explícita antes de escribir la primera línea de código.
