# @impulso/sticker-builder — Impulso Alpha

> EDITOR 1 (Canvas Runtime) + MILESTONE 1 (Impulso Alpha) de Impulso Builder Platform. Primera versión funcional de principio a fin: crear un documento, verlo en el canvas, seleccionar/mover/redimensionar/rotar sus objects, deshacer/rehacer, guardar localmente y volver a abrirlo. Ver [ADR-0005](../../docs/adr/0005-canvas-runtime.md) (integración original del pipeline) y [ADR-0009](../../docs/adr/0009-local-persistence-alpha.md) (persistencia local) para el razonamiento completo.

**Estado:** primera versión ejecutable de punta a punta para pruebas manuales. Toda la edición (selección, movimiento, resize, rotación) ya existía como capacidad de `@impulso/renderer-konva` desde Editor 2/3/Epic 1 y se hereda sin código adicional aquí; lo nuevo de este milestone es una UI mínima de 5 botones (Nuevo/Deshacer/Rehacer/Guardar/Abrir) y persistencia en `localStorage`. **No es una interfaz final** — sin Toolbar/Sidebar/Inspector/Layers Panel con diseño real, sin Zoom/Pan, sin Exportaciones, sin gestión de Assets. Ver §6 "Riesgos y limitaciones conocidas" y [`docs/MILESTONE_1_ALPHA.md`](../../docs/MILESTONE_1_ALPHA.md) para el detalle completo y el script de pruebas manuales.

---

## 1. Qué es y qué no es

- **Sí hace:** monta un `<canvas>` visible con una barra de 5 botones sobre él; un `Project` (Document Schema) fluye, sin atajos, a través de `@impulso/engine` y `@impulso/renderer-konva` hasta convertirse en píxeles reales en el navegador; el usuario puede crear un documento nuevo, editarlo (seleccionar/mover/redimensionar/rotar sus objects), deshacer/rehacer esos cambios, guardarlo en `localStorage` y volver a abrirlo — incluso después de recargar la página o cerrar el navegador.
- **No hace:** no tiene una interfaz de edición "real" — los 5 botones son HTML plano, sin diseño; no hay forma de agregar/eliminar objects desde la UI (el único contenido posible es el `Project` de demostración, tanto al cargar como al pulsar "Nuevo"); no hay Zoom/Pan/Toolbar/Sidebar/Inspector/Layers Panel/Exportaciones; solo guarda UN documento a la vez (sin lista, sin nombre, sin "guardar como").

## 2. Árbol

```
apps/sticker-builder/
├── package.json / tsconfig.json / vite.config.ts / vitest.config.ts
├── index.html                 # canvas + barra de 5 botones (Nuevo/Deshacer/Rehacer/Guardar/Abrir)
├── README.md / CHANGELOG.md
└── src/
    ├── main.ts                 # entry point real: DOM -> mountToolbar (sin lógica propia)
    ├── toolbar.ts               # cablea los 5 botones sobre un CanvasRuntime; Nuevo/Abrir remontan el runtime
    ├── persistence.ts           # guardar/cargar un Project en localStorage (serializeProject/deserializeProject)
    ├── bootstrap.ts             # mountCanvasRuntime(container, project?) — testable, el cableado del pipeline
    ├── demoProject.ts           # Project de demostración (rectangle + ellipse + text)
    └── testing/
        └── fakeCanvasContext.ts # stub de canvas 2D para tests (jsdom no implementa uno real)

    (30 tests, 100% de cobertura — y verificado además en un navegador real, ver §4)
```

## 3. El flujo unidireccional

```
demoProject (o un Project cargado de localStorage)
     │
     ▼
createEngine(project)              -- @impulso/engine
     │
     ▼
createKonvaRenderer(engine)        -- @impulso/renderer-konva
     │
     ▼
renderer.mount(container)          -- Canvas real en el DOM
```

`bootstrap.ts` es el único lugar que conecta Engine + Renderer, exclusivamente a través de sus APIs públicas ya existentes. `toolbar.ts` es la nueva capa de orquestación de Milestone 1: cablea los 5 botones sobre el `CanvasRuntime` que `bootstrap.ts` produce, sin tocar la API pública de `@impulso/engine` ni de `@impulso/renderer-konva`. `main.ts` sigue siendo la única pieza con efectos de módulo (contra el DOM real de `index.html`); todo lo demás es testable sin un navegador.

### 3.1 Los 5 botones

| Botón | Qué hace | Cómo |
|---|---|---|
| **Nuevo** | Crea un documento nuevo | Destruye el `RendererAdapter` actual y monta uno nuevo (`mountCanvasRuntime`) con un `createDemoProject()` fresco — el Engine no tiene (ni necesita) una API de "vaciar" su Project actual |
| **Deshacer** | Revierte el último cambio de contenido | `engine.undo()` (ya existe desde Foundation 2) — deshabilitado cuando `!engine.canUndo()` |
| **Rehacer** | Vuelve a aplicar un cambio deshecho | `engine.redo()` — deshabilitado cuando `!engine.canRedo()` |
| **Guardar** | Persiste el Project actual | `saveProjectLocally(engine.getProject())` → `localStorage`, un único slot (ver ADR-0009) |
| **Abrir** | Carga el último Project guardado | `loadProjectLocally()` + remonta el runtime, igual que "Nuevo" pero con el Project cargado |

Selección, movimiento, resize y rotación NO tienen botón — se activan directamente sobre el canvas (click, arrastre, handles), heredados sin cambios de `@impulso/renderer-konva`.

## 4. Cómo se verificó (no solo tests unitarios)

Además de los tests (jsdom + stub de canvas), se hizo el build de producción (`vite build`) y se ejecutó el flujo COMPLETO en un **Chromium real** (Playwright), incluyendo una recarga real de página (no solo en memoria) entre "Guardar" y "Abrir":

- Seleccionar, mover, redimensionar y rotar objects distintos del documento de demostración — confirmado leyendo `transform` resultante en cada paso.
- Deshacer/Rehacer reflejados correctamente en el estado del Engine y en los botones (`disabled`).
- Guardar → recargar la página completa (`localStorage` persiste across reload, a diferencia del estado en memoria) → Abrir → el `Project` restaurado es exactamente el guardado (mismas transformaciones de resize/rotación/movimiento).
- Nuevo → runtime fresco, sin selección ni historial de undo/redo previos.

Ver [`docs/MILESTONE_1_ALPHA.md`](../../docs/MILESTONE_1_ALPHA.md) para el script de verificación completo (reproducible manualmente) y el detalle de cada paso.

## 5. Desarrollo

```bash
pnpm --filter @impulso/sticker-builder dev      # servidor de desarrollo
pnpm --filter @impulso/sticker-builder build     # build de producción
pnpm --filter @impulso/sticker-builder preview   # sirve el build de producción (para probar el Alpha)
pnpm --filter @impulso/sticker-builder test       # tests
```

## 6. UX (regla permanente "UX First")

### Flujo del usuario
1. Al abrir la app, se ve el documento de demostración ya renderizado, con la barra de 5 botones arriba.
2. Seleccionar/mover/redimensionar/rotar cualquier object funciona exactamente como en Editor 2/3/Epic 1 (click, arrastre, handles) — sin ningún paso adicional.
3. "Deshacer"/"Rehacer" están deshabilitados (grises, sin cursor de mano) cuando no hay nada que deshacer/rehacer respectivamente — se habilitan/deshabilitan automáticamente según el estado real del Engine.
4. "Guardar" persiste el documento actual; un mensaje de estado junto a los botones confirma qué pasó ("Documento guardado localmente.", "Documento cargado.", etc.).
5. "Abrir" reemplaza lo que se ve por el último documento guardado — incluso después de cerrar y volver a abrir el navegador.
6. "Nuevo" reemplaza lo que se ve por un documento de demostración fresco, con su propio historial de undo/redo vacío.

### Consistencia de interacción
Los 5 botones siguen el vocabulario estándar de cualquier editor de documentos (Nuevo/Deshacer/Rehacer/Guardar/Abrir) — sin sorpresas de nomenclatura ni de ubicación (una barra fija arriba del canvas).

### Accesibilidad
**Limitación real, no resuelta en este milestone:** los 5 botones SÍ son elementos `<button>` HTML reales (navegables por teclado, con estado `disabled` nativo), a diferencia de la edición dentro del canvas (que sigue siendo exclusivamente por puntero, ver el README de `@impulso/renderer-konva`). El mensaje de estado (`#toolbar-status`) es texto plano sin `aria-live`, así que un lector de pantalla no lo anuncia automáticamente al cambiar — solo lo vería si navega explícitamente hasta ese elemento.

### Mejoras futuras
- `aria-live="polite"` en el mensaje de estado, para que lectores de pantalla anuncien confirmaciones/errores sin que el usuario tenga que buscarlas.
- Confirmación antes de "Nuevo"/"Abrir" si hay cambios sin guardar (hoy se pierden silenciosamente).
- Guardar/abrir múltiples documentos con nombre, no un único slot fijo.
- Atajos de teclado (Ctrl+Z/Ctrl+Y/Ctrl+S) además de los botones.

## 7. Riesgos y limitaciones conocidas

Ver [ADR-0005](../../docs/adr/0005-canvas-runtime.md) y [ADR-0009](../../docs/adr/0009-local-persistence-alpha.md) para el detalle completo. En resumen:

- El único contenido posible (al cargar, o al pulsar "Nuevo") es el `Project` de demostración — no hay UI para crear objects desde cero ni para importar contenido externo.
- Un solo slot de guardado en `localStorage`: cada "Guardar" sobrescribe el anterior sin aviso ni confirmación; no hay lista de documentos.
- El historial de undo/redo NO sobrevive a "Guardar" + recargar + "Abrir", ni a "Nuevo" — cada `Engine` empieza con su historial vacío; es el comportamiento esperado (el historial en memoria siempre fue efímero, desde Foundation 2), pero vale la pena saberlo antes de probar el Alpha para no reportarlo como bug.
- Sin manejo de cuota de `localStorage` — un documento que excediera el límite del navegador haría fallar "Guardar" sin un mensaje amigable específico para ese caso.
- Sin Zoom/Pan: un documento más grande que el Stage se corta.
- El handle de rotación puede quedar fuera del área visible del Stage para un object muy cerca del borde superior de la página (ver ADR-0008) — es una limitación ya conocida del sistema de manipulación, no nueva de este milestone.
