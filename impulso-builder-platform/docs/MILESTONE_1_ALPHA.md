# Milestone 1 — Impulso Alpha

Primera versión funcional de Impulso Builder Platform que puede usarse de principio a fin: crear un documento, verlo en el canvas, editarlo (seleccionar/mover/redimensionar/rotar), deshacer/rehacer esos cambios, guardarlo localmente y volver a abrirlo — todo dentro de `apps/sticker-builder`. Ver [ADR-0009](adr/0009-local-persistence-alpha.md) para las decisiones de arquitectura de este milestone específicamente, y el [README de la app](../apps/sticker-builder/README.md) para el detalle técnico completo.

**Objetivo de este milestone:** integrar todo lo construido hasta ahora (Foundations 1-3, Editor 1-3, Editor Epic 1) en un flujo end-to-end real, y detectar problemas de integración ANTES de seguir agregando capacidades nuevas. No se buscaba una interfaz final — se buscaba validar que las piezas ya construidas encajan entre sí sin fricciones ocultas.

---

## 1. Cómo ejecutar el Alpha

```bash
pnpm install
pnpm --filter @impulso/sticker-builder build
pnpm --filter @impulso/sticker-builder preview
```

Abrir la URL que imprime `preview` (por defecto `http://localhost:4173`) en un navegador. También funciona en modo desarrollo (`pnpm --filter @impulso/sticker-builder dev`) para iterar más rápido.

## 2. Script de pruebas manuales

Reproduce, en orden, cada capacidad exigida por este milestone. Todos los pasos se hacen directamente sobre el canvas y los 5 botones de la barra superior — no hay ningún otro control.

| # | Capacidad | Cómo probarla | Qué esperar |
|---|---|---|---|
| 1 | Crear un documento | Click en **Nuevo** | El canvas se recarga con el documento de demostración (rectángulo amarillo + insignia naranja + texto "Impulso"); Deshacer/Rehacer quedan deshabilitados |
| 2 | Mostrar el Canvas | Al cargar la página | Un `<canvas>` de 320×320px visible bajo la barra de botones |
| 3 | Renderizar objetos | Al cargar la página | Rectángulo, ellipse y texto, en el orden de capas correcto |
| 4 | Seleccionar | Click sobre cualquier object | Aparece su caja de manipulación (contorno + 8 handles de resize + 1 de rotación) |
| 5 | Mover | Arrastrar un object seleccionado (o directamente, sin click previo) | El object sigue al puntero; la posición queda fija al soltar |
| 6 | Redimensionar | Arrastrar cualquiera de los 8 handles cuadrados | El object cambia de tamaño; los handles de esquina son libres, los de borde se deslizan sobre el borde real (incluso rotado) |
| 7 | Rotar | Arrastrar el handle circular (arriba del object) | El object rota siguiendo el ángulo del puntero respecto a su pivote |
| 8 | Undo | Click en **Deshacer** tras cualquier cambio | El último cambio se revierte; el botón se deshabilita cuando ya no queda nada que deshacer |
| 9 | Redo | Click en **Rehacer** tras un Deshacer | El cambio deshecho se vuelve a aplicar |
| 10 | Guardar localmente | Click en **Guardar** | Mensaje "Documento guardado localmente." junto a los botones |
| 11 | Abrir nuevamente el documento | Recargar la página completa (F5) y click en **Abrir** | El documento vuelve exactamente como quedó al guardar (mismas posiciones/tamaños/ángulos) — incluso tras cerrar y reabrir el navegador, porque `localStorage` sobrevive a la recarga |

### Verificación automatizada (Playwright, Chromium real)

Se ejecutó este mismo script contra un build de producción real (no solo tests unitarios con stubs), confirmando en cada paso el `transform` resultante del object afectado y el contenido de `localStorage`:

- Mover "background" (+10,+15) → `transform` refleja el desplazamiento exacto.
- Redimensionar "background" (-20,-20 desde la esquina inferior derecha) → `scaleX`/`scaleY` = 0.9286 (260/280), posición del anclaje sin cambios.
- Rotar "badge" (ellipse) ~90° → `transform.rotation = 90`.
- Deshacer → la rotación vuelve a 0; Rehacer → vuelve a 90.
- Guardar → `localStorage` contiene el Project serializado.
- **Recarga real de página** (no solo re-render en memoria) + Abrir → el `Project` restaurado es bit a bit el mismo que se guardó (movimiento + resize + rotación, los tres cambios).
- Nuevo → el documento vuelve al estado original de fábrica (x=20,y=20, sin escala, sin rotación), con Deshacer/Rehacer deshabilitados.

Sin errores de consola reales (solo un 404 de `favicon.ico`, inofensivo y no relacionado con esta funcionalidad).

## 3. Problemas de integración detectados durante este milestone

Ninguno bloqueante. Un hallazgo notable, ya corregido en Editor Epic 1 (no de este milestone, pero relevante para el historial): `selectionLayer` tenía `listening: false` a nivel de toda la Layer de Konva, heredado de cuando solo contenía overlays decorativos — bloqueaba silenciosamente los eventos de puntero de los handles de resize/rotación agregados después. Los tests con jsdom (`.fire(...)`) no lo detectaban porque no pasan por el hit-graph real de Konva; solo se detectó verificando en un Chromium real. Se corrigió en esa misma épica (ver [ADR-0008](adr/0008-manipulation-system.md), "Riesgos").

Para este milestone específicamente (persistencia + toolbar), la integración fue directa: `serializeProject`/`deserializeProject` (Foundation 1) y `mountCanvasRuntime(container, project?)` (Editor 1) ya estaban preparados para exactamente este caso de uso sin necesitar ningún cambio.

## 4. Limitaciones conocidas de este Alpha

- **Contenido fijo:** el único documento posible (al cargar, o al pulsar "Nuevo") es el Project de demostración — no hay forma de crear objects nuevos desde la UI ni de importar contenido externo.
- **Un solo slot de guardado:** cada "Guardar" sobrescribe el anterior sin aviso ni confirmación; no hay lista de documentos, nombres, ni "guardar como".
- **El historial de undo/redo no sobrevive** a Guardar+recargar+Abrir, ni a Nuevo — cada vez se empieza con un historial vacío. Es el comportamiento esperado (el historial en memoria siempre fue efímero desde Foundation 2), no un bug.
- **Sin manejo de cuota de `localStorage`** — un documento que excediera el límite del navegador haría fallar "Guardar" sin un mensaje específico para ese caso.
- **Sin Zoom/Pan:** un documento más grande que el Stage se corta.
- **El handle de rotación puede quedar fuera del área visible del Stage** para un object muy cerca del borde superior de la página (limitación ya documentada en ADR-0008, no nueva de este milestone).
- **UI sin diseño final:** los 5 botones son HTML plano, sin estilo — deliberado, esto no era el objetivo de este milestone.
- **Accesibilidad:** los botones son navegables por teclado (elementos `<button>` reales), pero el mensaje de estado no usa `aria-live`, y toda la edición dentro del canvas sigue siendo exclusivamente por puntero.

## 5. Qué queda validado

- El pipeline completo (`Document Schema → Engine → Renderer → Canvas`) funciona de punta a punta con contenido real, no solo en tests aislados por paquete.
- Selección, movimiento, resize y rotación — construidos en tres micro-sprints/épicas distintas a lo largo de varias semanas — siguen funcionando juntos sin conflictos al integrarse en un flujo real de usuario.
- Undo/redo (Foundation 2) sigue siendo correcto tras acumular cambios de todos los sistemas de edición construidos después (selección, transform, resize, rotación).
- Persistencia local es viable con la infraestructura ya existente (`serializeProject`/`deserializeProject`) sin requerir ningún cambio en Document Schema o Engine — confirma que esas APIs estaban bien diseñadas desde Foundation 1/2 para este caso de uso, aunque no se hubiera construido explícitamente pensando en él.
