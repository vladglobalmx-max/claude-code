# @impulso/sticker-builder

> EPIC 1 — Sticker Creation Experience + EPIC 2 — Asset Library de Impulso Platform. Primera experiencia de creación completa: crear un proyecto (eligiendo tamaño de canvas por preset), agregar texto e imágenes, mover/escalar/rotar/duplicar/eliminar objects, reordenar capas, agrupar/desagrupar, bloquear/ocultar, deshacer/rehacer, guardar/abrir, y administrar una biblioteca de assets real (subir, reutilizar sin re-subir, eliminar) — todo dentro del navegador, verificado en Chromium real sin errores de consola. Ver [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md)/[ADR-0011](../../docs/adr/0011-asset-library.md) para el razonamiento completo de cada decisión, y [ADR-0005](../../docs/adr/0005-canvas-runtime.md)/[ADR-0009](../../docs/adr/0009-local-persistence-alpha.md) para las bases (Canvas Runtime, Local Persistence) sobre las que se construyó.

**Estado:** experiencia de creación de stickers de punta a punta con Asset Library real, lista para pruebas manuales reales. Todo lo construido en Epic 1 vive en la capa de aplicación (`apps/sticker-builder`); Epic 2 agrega el paquete reutilizable `@impulso/asset-library` y rewira esta app sobre él. Cero cambios que rompan la API pública de `@impulso/document-schema`/`@impulso/engine`/`@impulso/renderer-konva` — ambas épicas ganaron extensiones aditivas documentadas en sus propios READMEs/CHANGELOGs. Explícitamente fuera de alcance todavía: IA, Exportación, Marketplace, Usuarios, Cloud, Plantillas, Mockups, Plugins, tipos de Asset más allá de `image`.

---

## 1. Qué es y qué no es

- **Sí hace:** Barra superior (Nuevo/Deshacer/Rehacer/Guardar/Abrir/Duplicar/Eliminar/Agrupar/Desagrupar), barra de herramientas (Texto/Imagen + Zoom), Sidebar izquierda con dos tabs — panel de Capas (reordenar por drag-and-drop, expandir/colapsar groups, renombrar, ocultar, bloquear) y panel de **Assets** (subir imágenes, verlas en una grilla con miniatura, insertarlas en el canvas sin volver a subirlas, eliminarlas de la biblioteca) —, Canvas central (con zoom CSS 25-200% + "Ajustar a pantalla" + rueda del mouse con Ctrl/Cmd), Sidebar derecha (Inspector: Transformar/Apariencia/Texto/Metadata, adaptado a la selección actual), diálogo de "Nuevo proyecto" (3 presets de sticker + tamaño personalizado), y un mapa completo de atajos de teclado. Todo el flujo (crear → diseñar → guardar → abrir → editar sin pérdida de información) funciona sin recargar ni perder estado salvo cuando el usuario lo pide explícitamente (Guardar/Abrir).
- **No hace:** no genera ningún archivo de salida (Exportación es una épica futura); no soporta múltiples Pages/Layers del Document Schema desde la UI (el panel de capas asume una sola Page/Layer); no tiene un modo de herramienta persistente tipo "lápiz armado" (Texto/Imagen insertan directamente, ver §3.4); no permite "entrar" a un Group para seleccionar un hijo individualmente (siempre se selecciona/edita como una unidad); no implementa ningún tipo de Asset más allá de `image` (la Asset Library ya admite extenderse, ver §3.9).

## 2. Árbol

```
apps/sticker-builder/
├── package.json / tsconfig.json / vite.config.ts / vitest.config.ts
├── index.html                    # layout completo: barra superior, tools-bar, capas | canvas | inspector
├── README.md / CHANGELOG.md
└── src/
    ├── main.ts                    # entry point real: DOM -> mountApp (sin lógica propia)
    ├── app.ts                     # orquestador central: cablea todos los módulos de abajo entre sí
    ├── bootstrap.ts                # mountCanvasRuntime(container, project?, options?) — pipeline Document Schema -> Engine -> Renderer -> Canvas
    ├── demoProject.ts              # Project de demostración (rectangle + ellipse + text)
    ├── persistence.ts              # guardar/cargar un Project en localStorage
    ├── projectPresets.ts           # 3 presets de tamaño de sticker + createProjectFromSize()
    ├── newProjectDialog.ts         # modal "Nuevo proyecto": presets + tamaño personalizado
    ├── assetResolution.ts          # ResolvedAssetCache: puente síncrono AssetBinaryStore (async) <-> resolveAssetSource (sync)
    ├── legacyMigration.ts          # migración de imágenes embebidas (Epic 1) al modelo de Asset Library
    ├── assetsPanel.ts              # Sidebar izquierda (tab Assets): grilla, subir, insertar, eliminar
    ├── tools.ts                    # acciones "Agregar texto"/"Agregar imagen"/subir e insertar Assets + botones de la tools-bar
    ├── zoom.ts                     # zoom vía CSS transform: presets, Ajustar a pantalla, rueda + Ctrl/Cmd
    ├── layersPanel.ts              # Sidebar izquierda (tab Capas): reordenar, expandir/colapsar, renombrar, ocultar, bloquear
    ├── inspector.ts                # Sidebar derecha: Transformar/Apariencia/Texto/Metadata según la selección
    ├── keyboardShortcuts.ts        # mapa de atajos -> acciones, desacoplado del Engine
    └── testing/
        └── fakeCanvasContext.ts    # stub de canvas 2D para tests (jsdom no implementa uno real)

    (186 tests, ~99.8%/94%/96%/~99.8% de cobertura — y verificado además en un Chromium real vía Playwright, ver §4)
```

## 3. Decisiones clave (ver ADR-0010/ADR-0011 para el detalle completo)

### 3.1 Orquestación: `app.ts` reemplaza a `toolbar.ts`
`app.ts` es el único módulo que conoce a todos los demás — cada módulo individual (`layersPanel.ts`, `inspector.ts`, `zoom.ts`, `tools.ts`, `keyboardShortcuts.ts`, `newProjectDialog.ts`) no conoce a ningún otro, solo al `Engine`. "Nuevo"/"Abrir" mantienen el patrón ya establecido en Milestone 1 (ADR-0009): destruir el `CanvasRuntime` completo y montar uno nuevo, extendido ahora con precarga asíncrona de imágenes embebidas antes del primer render.

### 3.2 Agrupar/desagrupar: solo hijos directos de una Layer
Igual que `reorderObjects` desde Foundation 2 — agrupar objects de Layers distintas o ya anidados en otro Group se rechaza explícitamente. Al desagrupar, el transform del Group se "hornea" en cada hijo (`composeChildTransformIntoParent`, en `@impulso/engine`) para que nada se mueva visualmente.

### 3.3 Un Group siempre se selecciona como una unidad
Ni el canvas (`NodeContext.interactive`, ver README de `@impulso/renderer-konva`) ni el panel de capas permiten seleccionar un hijo de un Group individualmente — las filas de hijos (mostradas solo al expandir) son informativas, sin click-to-select ni renombrado.

### 3.4 Insertar texto/imágenes centrado, no "colocar con un click"
"Texto"/"Imagen" insertan el object nuevo ya centrado en la página (con un pequeño desplazamiento en cascada entre inserciones consecutivas) en vez de armar un modo de herramienta que espere un click de colocación — evita traducir coordenadas de pantalla a través del zoom CSS hasta el espacio del Stage de Konva. El usuario arrastra el object a su posición final con la interacción de mover ya existente.

### 3.5 Imágenes sobre la Asset Library real (`@impulso/asset-library`, Epic 2)
El binario ya no se embebe en el documento: `tools.ts` sube el `File` a `AssetBinaryStore` (IndexedDB) vía `createImageAssetFromFile`, registra el `ImageAsset` resultante en `document.assets` (`addAsset`), y el `ImageObject` solo guarda su `assetId`. `assetResolution.ts` resuelve ese `assetId` hacia un `HTMLImageElement` en memoria (`ResolvedAssetCache`), conectado al `resolveAssetSource` que `@impulso/renderer-konva` expone desde Foundation 3. Al abrir/remontar, `preloadDocumentAssets` repuebla el cache antes del primer render. Ver ADR-0011 para el diseño completo del paquete.

### 3.6 Zoom vía CSS, no vía `stage.scale()`
El zoom es un `transform: scale(...)` CSS sobre el contenedor que envuelve el Stage — Document Schema, Engine y Konva no saben que el zoom existe. Verificado en un navegador real que arrastrar/redimensionar/rotar un object sigue funcionando correctamente con el canvas escaleado.

### 3.7 Duplicar sin un comando nuevo en el Engine
`cloneSceneObjectWithNewIds` (función pura, no un comando — el Engine nunca inventa identidad) clona recursivamente con ids frescos; la app combina esa clonación con el comando `addObject` ya existente.

### 3.8 Bug encontrado y corregido durante la verificación en navegador: el panel de capas rompía el renombrado por doble-click
La primera implementación reconstruía el DOM completo del panel en cada cambio de selección — esto (verificado en Chromium real, no detectado por jsdom) impedía que el navegador reconociera dos clicks consecutivos como un doble-click, porque el primer click ya había reemplazado el elemento antes de que llegara el segundo. Corregido separando reconstrucción completa (`projectChanged`) de una actualización liviana que solo alterna la clase `.selected` sobre las filas existentes (`selectionChanged`), preservando la identidad de los nodos DOM. Ver ADR-0010 para el detalle.

### 3.9 Migración transparente de proyectos guardados en formato Epic 1
Un proyecto guardado antes de esta épica tiene sus imágenes embebidas como data URL (`customProperties.impulsoImageDataUrl`). `legacyMigration.ts` detecta ese formato al "Abrir", convierte cada data URL a `Blob`, lo sube al `AssetBinaryStore`, crea el `ImageAsset` real, limpia la `customProperty` legada, y reporta cuántas imágenes se migraron en el mensaje de estado. `doOpen()` vuelve a guardar tras migrar, así que la migración solo ocurre una vez por proyecto.

### 3.10 Bug de contaminación entre tests corregido con una dependencia inyectable, no con un workaround
Instancias de `App` nunca destruidas entre tests quedaban suscritas a `window`'s `keydown`; un `dispatchEvent` en un test tardío disparaba `doOpen()` en instancias de tests ya completados, con sus stubs de `URL`/`Image` ya revertidos, causando un rechazo no manejado. Se corrigió agregando `keyboardTarget` como dependencia inyectable de `App` (default a `window` en producción vía el fallback ya existente en `keyboardShortcuts.ts`), permitiendo que cada test aísle sus atajos en un `EventTarget` propio.

## 4. Cómo se verificó (no solo tests unitarios)

Además de los 186 tests (jsdom + stub de canvas), se hizo el build de producción (`vite build`) y se ejecutó el flujo COMPLETO en un **Chromium real** (Playwright) contra ese build:

- Crear un proyecto nuevo desde el diálogo (preset y personalizado), agregar texto e imagen (PNG), moverlos/escalarlos/rotarlos sobre el canvas real (confirmado en el Inspector), duplicar, eliminar, reordenar por drag-and-drop, agrupar/desagrupar, ocultar/bloquear desde el panel de capas, deshacer/rehacer, hacer zoom (presets y "Ajustar a pantalla").
- Guardar → recargar la página completa (no solo en memoria) → Abrir → el `Project` restaurado, incluidas las imágenes embebidas, es exactamente el guardado.
- Renombrado inline por doble-click en el panel de capas (el bug de §3.8, reproducido y luego confirmado corregido).
- **Cero errores de consola** en todo el flujo.

## 5. Desarrollo

```bash
pnpm --filter @impulso/sticker-builder dev       # servidor de desarrollo
pnpm --filter @impulso/sticker-builder build      # build de producción
pnpm --filter @impulso/sticker-builder preview    # sirve el build de producción
pnpm --filter @impulso/sticker-builder test        # tests
pnpm --filter @impulso/sticker-builder typecheck   # tsc --noEmit
```

## 6. UX (regla permanente "UX First")

### Flujo del usuario
1. Al abrir la app, se ve un documento de demostración ya renderizado.
2. "Nuevo" abre un diálogo con 3 tamaños de sticker curados (cuadrado, circular, rectangular) + una opción "Personalizado" (ancho/alto en mm).
3. "Texto"/"Imagen" en la barra de herramientas insertan un object nuevo centrado en la página, listo para arrastrar a su posición final.
4. Cualquier object se selecciona con click (Shift-click para selección múltiple) tanto en el canvas como en el panel de capas; el Inspector se adapta automáticamente a la selección (0/1/2+ objects).
5. Duplicar/Eliminar/Agrupar/Desagrupar están disponibles como botones (deshabilitados cuando no aplican a la selección actual) y como atajos de teclado.
6. El panel de capas permite reordenar arrastrando filas, expandir un Group para ver (no seleccionar) sus hijos, renombrar con doble-click, y ocultar/bloquear con un ícono por fila.
7. El tab "Assets" del Sidebar izquierdo permite subir una imagen a la biblioteca sin insertarla, ver todas las imágenes subidas en una grilla con miniatura, insertar cualquiera de ellas en el canvas con un click (sin volver a subirla), y eliminarlas de la biblioteca.
8. El zoom (25/50/100/200%, "Ajustar a pantalla", rueda + Ctrl/Cmd) es puramente visual — nunca afecta las medidas reales del documento.
9. "Guardar"/"Abrir" persisten y restauran el proyecto completo, incluidos los Assets; "Abrir" migra automáticamente proyectos guardados en el formato anterior (imágenes embebidas) al nuevo modelo de Asset Library. "Deshacer"/"Rehacer" reflejan el estado real del Engine en los botones.

### Consistencia de interacción
Vocabulario y atajos estándar de cualquier editor de diseño (Ctrl/Cmd+D duplicar, Ctrl/Cmd+G agrupar, Ctrl/Cmd+Z/Shift+Z deshacer/rehacer, flechas para mover 1px/10px con Shift, etc.) — sin inventar convenciones propias donde ya existe una esperada.

### Accesibilidad
Todos los controles de la barra superior/herramientas son elementos `<button>`/`<input>` HTML reales, navegables por teclado, con estado `disabled` nativo reflejando cuándo una acción no aplica. **Limitación conocida:** el mensaje de estado (`#toolbar-status`) no tiene `aria-live`, y la edición dentro del canvas (mover/escalar/rotar/agregar) sigue siendo exclusivamente por puntero.

### Mejoras futuras
- `aria-live="polite"` en el mensaje de estado.
- Confirmación antes de "Nuevo"/"Abrir" si hay cambios sin guardar.
- Guardar/abrir múltiples documentos con nombre, no un único slot fijo.
- Un modo de "entrar" a un Group para seleccionar un hijo individualmente.
- Menú contextual (click derecho) como alternativa descubrible a los atajos de teclado.

## 7. Riesgos y limitaciones conocidas

Ver [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md)/[ADR-0011](../../docs/adr/0011-asset-library.md) para el detalle completo. En resumen:

- **Sin deduplicación ni compresión de Assets**: subir la misma imagen dos veces crea dos entradas independientes en la biblioteca.
- **`preloadDocumentAssets` resuelve todos los Assets del documento al abrir/remontar**: no hay carga perezosa — documentos con muchas imágenes grandes pagan ese costo por adelantado (ver `docs/PERFORMANCE_BUDGET.md`).
- **Sin validación de Assets huérfanos**: eliminar un Asset de la biblioteca no valida si algún `ImageObject` todavía lo referencia (el Renderer degrada a un placeholder ante un `assetId` sin resolver).
- **Solo el tipo `image` implementado**: el modelo (`@impulso/document-schema`, `@impulso/asset-library`) ya admite extenderse a fuentes/plantillas/íconos/etc., pero ninguno tiene todavía un ingestion helper ni UI.
- **Agrupar/desagrupar de un solo nivel**: solo opera sobre hijos directos de una Layer, igual que `reorderObjects`.
- **Sin "entrar" a un Group**: siempre se selecciona/edita como una unidad completa.
- **El `<textarea>` de edición de texto in-canvas** no garantiza pixel-match exacto con el `Konva.Text` renderizado (diferencias de fuente/kerning entre el navegador y Konva).
- **Sin modo de herramienta persistente**: Texto/Imagen insertan de inmediato, no "arman" un modo de colocación.
- **Un solo slot de guardado en `localStorage`** (heredado de Milestone 1/ADR-0009): cada "Guardar" sobrescribe el anterior sin aviso.
- **El historial de undo/redo no sobrevive a Guardar/Abrir/recargar** (heredado de ADR-0009).
- **La UI asume una sola Page/Layer**: el Document Schema soporta múltiples, pero el panel de capas y el Inspector no las exponen todavía.
