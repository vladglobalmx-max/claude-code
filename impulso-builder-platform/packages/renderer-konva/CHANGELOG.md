# Changelog — @impulso/renderer-konva

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Foundation 3

### Agregado
- `createKonvaRenderer(engine, options)`: primer `RendererAdapter` concreto — `mount(container)`, `destroy()`, `getStage()`.
- Mapeo completo de los 6 tipos de `SceneObject` (Rectangle, Ellipse, Path, Image, Text, Group recursivo) a nodos Konva.
- Traducción de `PathSegment[]` (formato propio del Document Schema) a sintaxis de path SVG que Konva consume.
- Traducción del único gesto de interacción de este Foundation — arrastrar (`dragend`) — en `engine.dispatch({type: "updateObjectTransform", ...})`, con reversión visual si el Engine rechaza el cambio.
- Un único `Konva.Layer` por Stage; cada Layer del Document Schema se mapea a un `Konva.Group` (evita el antipatrón de "muchos canvases").
- Conversión de unidades físicas (mm/in) a píxeles de Stage, y de coordenadas Document Schema ↔ Konva (la única asimetría: `Konva.Ellipse` se posiciona por el centro).
- Placeholder para `Image` sin `resolveAssetSource` inyectado (no hay gestión de Assets todavía).
- Respeta `metadata.visible`/`metadata.locked` de Layer y Object (visibilidad y si el object es arrastrable).
- Stub propio de `CanvasRenderingContext2D` para testear Konva en jsdom sin el paquete nativo `canvas`.
- 62 tests, 100% de cobertura, sin dependencias circulares (madge).

### Fuera de alcance (deliberado)
Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Handles, Selection visual, Exportaciones, gestión de Assets/Fonts, lógica específica de Sticker Builder.
